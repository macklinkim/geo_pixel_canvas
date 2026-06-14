// Cloudflare Turnstile server-side validation.
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// Security notes:
// - The client token is NEVER trusted on its own; every token is verified here
//   against the Siteverify API before any write is allowed.
// - The secret key lives only on the server (env / wrangler secret), never sent
//   to the client. Only the site key is exposed (via /api/config).
// - We do not send the user's IP (remoteip is optional) — keeps this path from
//   handling/storing personal data, consistent with the project's privacy rules.

import type { Env } from "./env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_TTL_MS = 1_800_000; // 30 minutes

export interface TurnstileConfig {
  /** Effective: only true when enabled AND both keys are present. */
  enabled: boolean;
  /** Raw enabled flag — true even if misconfigured (keys missing). */
  flag: boolean;
  siteKey: string;
  secret: string;
  ttlMs: number;
}

export function turnstileConfig(env: Env): TurnstileConfig {
  const flag = env.TURNSTILE_ENABLED === "true";
  const siteKey = env.TURNSTILE_SITE_KEY ?? "";
  const secret = env.TURNSTILE_SECRET_KEY ?? "";
  const ttlMs = Number(env.TURNSTILE_SESSION_TTL_MS) || DEFAULT_TTL_MS;

  // Fail open in dev when misconfigured so the app keeps working, but make the
  // misconfiguration loud for operators.
  if (flag && (!siteKey || !secret)) {
    console.error(
      "TURNSTILE_ENABLED=true but TURNSTILE_SITE_KEY/SECRET_KEY missing — human verification is DISABLED until configured.",
    );
  }

  return { enabled: flag && !!siteKey && !!secret, flag, siteKey, secret, ttlMs };
}

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/** Verify a Turnstile token. Returns true only when Siteverify says success. */
export async function verifyTurnstileToken(token: string, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  try {
    const body = new FormData();
    body.append("secret", secret);
    body.append("response", token);
    const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
    if (!res.ok) return false;
    const data = (await res.json()) as SiteverifyResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
