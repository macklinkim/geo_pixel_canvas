import type { RoomDurableObject } from "./room-do";

export interface Env {
  DB: D1Database;
  ROOM: DurableObjectNamespace<RoomDurableObject>;
  ASSETS: Fetcher;
  MAP_STYLE_URL: string;
  APP_VERSION: string;
  /** Reverse-geocoder base URL (e.g. Nominatim). Empty disables auto-naming. */
  GEOCODE_URL: string;
  /** Emergency kill switch: "true" rejects all writes (paint/stamp/rename/create). */
  WRITE_DISABLED: string;

  // Cloudflare Turnstile (human verification for write actions).
  TURNSTILE_ENABLED: string; // "true" to enable
  TURNSTILE_SITE_KEY: string; // public; exposed via /api/config
  TURNSTILE_SECRET_KEY: string; // secret; .dev.vars locally, `wrangler secret` in prod
  TURNSTILE_SESSION_TTL_MS: string; // how long one verification lasts (default 1800000)

  // Operator Admin Override (server-verified; bypasses ONLY the location gate).
  ADMIN_OVERRIDE_ENABLED: string; // "true" to enable
  ADMIN_SESSION_TTL_MS: string; // admin session lifetime (default 3600000)
  // Secret never reaches the client. Prefer ADMIN_SECRET_HASH (sha-256 hex of the
  // code); ADMIN_SECRET (plaintext) is hashed server-side as a fallback. Set via
  // .dev.vars locally or `wrangler secret put` in prod.
  ADMIN_SECRET_HASH?: string;
  ADMIN_SECRET?: string;
}
