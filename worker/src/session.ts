// Server-issued "human session": an HMAC-signed, httpOnly cookie proving the
// user passed Turnstile once. Stateless (no DB) — the signature + expiry are
// self-validating. Signed with the Turnstile secret (server-only).
//
// Privacy: the session encodes only an expiry timestamp — no coordinates, no
// IP, no user identity.

export const SESSION_COOKIE = "gpb_human";

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Create a session value `${expiresMs}.${hmac}`. */
export async function signSession(secret: string, expiresMs: number): Promise<string> {
  const mac = await hmacHex(secret, String(expiresMs));
  return `${expiresMs}.${mac}`;
}

/** Returns the expiry (ms) if the session is valid and unexpired, else 0. */
export async function verifySession(
  secret: string,
  value: string | undefined,
  now: number,
): Promise<number> {
  if (!value || !secret) return 0;
  const dot = value.indexOf(".");
  if (dot <= 0) return 0;
  const expStr = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= now) return 0;
  const expected = await hmacHex(secret, expStr);
  return timingSafeEqual(mac, expected) ? exp : 0;
}

export function getCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return undefined;
}

export function setSessionCookie(value: string, ttlMs: number, secure: boolean): string {
  const maxAge = Math.floor(ttlMs / 1000);
  const flags = ["Path=/", `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax"];
  if (secure) flags.push("Secure");
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; ${flags.join("; ")}`;
}
