import type { RoomDurableObject } from "./room-do";

export interface Env {
  DB: D1Database;
  ROOM: DurableObjectNamespace<RoomDurableObject>;
  ASSETS: Fetcher;
  MAP_STYLE_URL: string;
  APP_VERSION: string;
  /** Reverse-geocoder base URL (e.g. Nominatim). Empty disables auto-naming. */
  GEOCODE_URL: string;

  // Cloudflare Turnstile (human verification for write actions).
  TURNSTILE_ENABLED: string; // "true" to enable
  TURNSTILE_SITE_KEY: string; // public; exposed via /api/config
  TURNSTILE_SECRET_KEY: string; // secret; .dev.vars locally, `wrangler secret` in prod
  TURNSTILE_SESSION_TTL_MS: string; // how long one verification lasts (default 1800000)
}
