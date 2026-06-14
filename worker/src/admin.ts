// Operator Admin Override.
//
// An explicit, server-verified admin mode — NOT a hidden backdoor. The operator
// proves knowledge of a secret code via POST /api/admin/login; on success we
// issue an HMAC-signed, httpOnly `gpb_admin` cookie (same scheme as the human
// session). The Worker re-verifies that cookie on the WebSocket upgrade and tells
// the Durable Object how long admin is valid; the DO then bypasses ONLY the
// location gate (every other check — WRITE_DISABLED, Zod, rate/flood limits,
// human verification — still applies).
//
// Security:
// - The secret never reaches the client. We compare a sha-256 hash, not plaintext.
// - The same hash doubles as the HMAC signing key for the cookie (server-only).
// - Failed logins are rate-limited per client IP.

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "./env";
import { jsonError } from "./errors";
import { signSession, verifySession, getCookie } from "./session";

export const ADMIN_COOKIE = "gpb_admin";
const DEFAULT_TTL_MS = 3_600_000; // 1 hour

const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Effective enabled = flag on AND a secret (hash or plaintext) is configured. */
export function adminEnabled(env: Env): boolean {
  const flag = env.ADMIN_OVERRIDE_ENABLED === "true";
  const hasSecret = !!(env.ADMIN_SECRET_HASH || env.ADMIN_SECRET);
  if (flag && !hasSecret) {
    console.error(
      "ADMIN_OVERRIDE_ENABLED=true but no ADMIN_SECRET_HASH/ADMIN_SECRET set — admin override is DISABLED until configured.",
    );
  }
  return flag && hasSecret;
}

function adminTtlMs(env: Env): number {
  return Number(env.ADMIN_SESSION_TTL_MS) || DEFAULT_TTL_MS;
}

/**
 * The sha-256 hex of the admin code. Prefers ADMIN_SECRET_HASH; otherwise hashes
 * ADMIN_SECRET. Used both to compare logins and as the cookie HMAC signing key.
 */
async function secretHash(env: Env): Promise<string> {
  if (env.ADMIN_SECRET_HASH) return env.ADMIN_SECRET_HASH.trim().toLowerCase();
  if (env.ADMIN_SECRET) return sha256Hex(env.ADMIN_SECRET);
  return "";
}

/** Verify the admin cookie. Returns expiry (ms) if valid+unexpired, else 0. */
export async function verifyAdminCookie(
  env: Env,
  cookieHeader: string | null,
  now: number,
): Promise<number> {
  if (!adminEnabled(env)) return 0;
  const value = getCookie(cookieHeader, ADMIN_COOKIE);
  const hash = await secretHash(env);
  return verifySession(hash, value, now);
}

// ---- failed-login rate limiting (per client IP) ----
// In-memory, best-effort: caps brute-force against the (high-entropy) secret as
// defense in depth. Not shared across isolates, which is acceptable given the
// secret itself is the primary protection.
const MAX_FAILS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const attempts = new Map<string, { fails: number; lockUntil: number }>();

function clientKey(ipHeader: string | null): string {
  return ipHeader?.split(",")[0]?.trim() || "unknown";
}

function isLocked(key: string, now: number): boolean {
  const a = attempts.get(key);
  return !!a && a.lockUntil > now;
}

function recordFail(key: string, now: number): void {
  const a = attempts.get(key) ?? { fails: 0, lockUntil: 0 };
  a.fails += 1;
  if (a.fails >= MAX_FAILS) {
    a.lockUntil = now + LOCKOUT_MS;
    a.fails = 0;
  }
  attempts.set(key, a);
}

function clearFails(key: string): void {
  attempts.delete(key);
}

function adminCookie(value: string, ttlMs: number, secure: boolean): string {
  const maxAge = Math.floor(ttlMs / 1000);
  const flags = ["Path=/", `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (secure) flags.push("Secure");
  return `${ADMIN_COOKIE}=${encodeURIComponent(value)}; ${flags.join("; ")}`;
}

function clearAdminCookie(secure: boolean): string {
  const flags = ["Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (secure) flags.push("Secure");
  return `${ADMIN_COOKIE}=; ${flags.join("; ")}`;
}

const loginBody = z.object({ code: z.string().min(1).max(512) });

export function registerAdmin(app: Hono<{ Bindings: Env }>): void {
  // Is admin override available, and does the caller hold a valid session?
  app.get("/api/admin/session", async (c) => {
    if (!adminEnabled(c.env)) return c.json({ enabled: false, valid: false, expiresAt: null });
    const exp = await verifyAdminCookie(c.env, c.req.header("Cookie") ?? null, Date.now());
    return c.json({ enabled: true, valid: exp > 0, expiresAt: exp > 0 ? exp : null });
  });

  app.post("/api/admin/login", zValidator("json", loginBody), async (c) => {
    if (!adminEnabled(c.env)) {
      return jsonError(c, 403, "admin_disabled", "admin override is not enabled");
    }
    const now = Date.now();
    const key = clientKey(c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null);
    if (isLocked(key, now)) {
      return jsonError(c, 429, "rate_limited", "too many attempts; try again later");
    }

    const { code } = c.req.valid("json");
    const submitted = await sha256Hex(code);
    const expected = await secretHash(c.env);
    if (!expected || !timingSafeEqual(submitted, expected)) {
      recordFail(key, now);
      return jsonError(c, 401, "invalid_code", "incorrect admin code");
    }

    clearFails(key);
    const ttlMs = adminTtlMs(c.env);
    const expiresAt = now + ttlMs;
    // Sign with the secret hash (server-only) so the cookie is self-validating.
    const value = await signSession(expected, expiresAt);
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", adminCookie(value, ttlMs, secure));
    console.log(`admin login ok at ${now}`);
    return c.json({ ok: true, expiresAt });
  });

  app.post("/api/admin/logout", (c) => {
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", clearAdminCookie(secure));
    return c.json({ ok: true });
  });
}
