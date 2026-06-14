import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { encodeGeohash } from "@shared/geo/geohash";
import { checkLocationGate } from "@shared/geo/locationGate";
import { roomCenterFromGeohash, type RoomMeta } from "@shared/room";
import { GEOHASH_PRECISION } from "@shared/constants";
import type { Env } from "./env";
import { jsonError } from "./errors";
import { forwardGeocode } from "./geocode";
import { turnstileConfig, verifyTurnstileToken } from "./turnstile";
import {
  SESSION_COOKIE,
  getCookie,
  signSession,
  verifySession,
  setSessionCookie,
} from "./session";

const bboxQuery = z
  .object({
    minLat: z.coerce.number().min(-90).max(90),
    maxLat: z.coerce.number().min(-90).max(90),
    minLng: z.coerce.number().min(-180).max(180),
    maxLng: z.coerce.number().min(-180).max(180),
  })
  .refine((q) => q.minLat <= q.maxLat && q.minLng <= q.maxLng, {
    message: "min must be <= max",
  });

const createBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  acc: z.number().nonnegative().max(100_000),
  name: z.string().trim().max(40).nullish(),
  token: z.string().max(2048).optional(),
});

const verifyBody = z.object({ token: z.string().max(2048).optional() });

const recentQuery = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

interface RoomRow {
  geohash: string;
  precision: number;
  center_lat: number;
  center_lng: number;
  name: string | null;
  pixel_count: number;
  last_drawn_at: number;
}

function rowToMeta(r: RoomRow): RoomMeta {
  return {
    geohash: r.geohash,
    precision: r.precision,
    centerLat: r.center_lat,
    centerLng: r.center_lng,
    name: r.name,
    pixelCount: r.pixel_count,
    lastDrawnAt: r.last_drawn_at,
  };
}

export function registerRooms(app: Hono<{ Bindings: Env }>): void {
  app.get("/api/health", (c) =>
    c.json({ ok: true, version: c.env.APP_VERSION || "0.1.0" }),
  );

  // Map style + Turnstile config for the client. Only the public site key is
  // exposed — the secret never leaves the server.
  app.get("/api/config", (c) => {
    const ts = turnstileConfig(c.env);
    return c.json({
      mapStyleUrl: c.env.MAP_STYLE_URL || null,
      turnstileEnabled: ts.enabled,
      turnstileSiteKey: ts.enabled ? ts.siteKey : null,
      sessionTtlMs: ts.ttlMs,
    });
  });

  // Is there a valid human session? (Used by the client entry gate.)
  app.get("/api/session", async (c) => {
    const ts = turnstileConfig(c.env);
    if (!ts.enabled) return c.json({ enabled: false, valid: true, expiresAt: null });
    const cookie = getCookie(c.req.header("Cookie") ?? null, SESSION_COOKIE);
    const exp = await verifySession(ts.secret, cookie, Date.now());
    return c.json({ enabled: true, valid: exp > 0, expiresAt: exp > 0 ? exp : null });
  });

  // Entry gate: verify a Turnstile token and issue a human-session cookie.
  app.post("/api/verify", zValidator("json", verifyBody), async (c) => {
    const ts = turnstileConfig(c.env);
    if (!ts.enabled) {
      // Gate is off (disabled or misconfigured) — nothing to verify.
      return c.json({ ok: true, enabled: false, expiresAt: null });
    }
    const { token } = c.req.valid("json");
    if (!token) return jsonError(c, 400, "human_required", "turnstile token required");

    const ok = await verifyTurnstileToken(token, ts.secret);
    if (!ok) return jsonError(c, 403, "turnstile_failed", "human verification failed");

    const expiresAt = Date.now() + ts.ttlMs;
    const value = await signSession(ts.secret, expiresAt);
    const secure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", setSessionCookie(value, ts.ttlMs, secure));
    return c.json({ ok: true, enabled: true, expiresAt });
  });

  // Address/place search -> coordinate (server-side, free Nominatim).
  // Cached at the edge so repeat searches don't re-hit the rate-limited geocoder
  // (Nominatim's policy is ~1 req/s); search is submit-only, never autocomplete.
  app.get(
    "/api/geocode",
    zValidator("query", z.object({ q: z.string().trim().min(1).max(120) })),
    async (c) => {
      const { q } = c.req.valid("query");
      const norm = q.trim().toLowerCase();
      const cache = caches.default;
      const cacheKey = new Request(
        `https://gpb-geocode.internal/?q=${encodeURIComponent(norm)}`,
      );
      try {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
      } catch {
        /* cache unavailable — fall through to a live lookup */
      }

      const result = await forwardGeocode(q, c.env.GEOCODE_URL);
      const res = c.json({ result });
      res.headers.set("Cache-Control", "public, max-age=86400");
      try {
        c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
      } catch {
        /* cache write best-effort */
      }
      return res;
    },
  );

  app.get("/api/rooms", zValidator("query", bboxQuery), async (c) => {
    const q = c.req.valid("query");
    const { results } = await c.env.DB.prepare(
      `SELECT geohash, precision, center_lat, center_lng, name, pixel_count, last_drawn_at
       FROM rooms
       WHERE center_lat BETWEEN ?1 AND ?2 AND center_lng BETWEEN ?3 AND ?4
       ORDER BY last_drawn_at DESC
       LIMIT 500`,
    )
      .bind(q.minLat, q.maxLat, q.minLng, q.maxLng)
      .all<RoomRow>();

    return c.json({ rooms: results.map(rowToMeta) });
  });

  // Recently created drawings (global), newest first. Read-only discovery — no
  // Turnstile. Filters out empty cells so the list is actual artwork. Reads only
  // the lightweight D1 index, never the per-room Durable Objects.
  app.get("/api/rooms/recent", zValidator("query", recentQuery), async (c) => {
    const { limit } = c.req.valid("query");
    const { results } = await c.env.DB.prepare(
      `SELECT geohash, precision, center_lat, center_lng, name, pixel_count, last_drawn_at
       FROM rooms
       WHERE pixel_count > 0
       ORDER BY created_at DESC
       LIMIT ?1`,
    )
      .bind(limit)
      .all<RoomRow>();

    return c.json({ rooms: results.map(rowToMeta) });
  });

  app.post("/api/rooms", zValidator("json", createBody), async (c) => {
    if (c.env.WRITE_DISABLED === "true") {
      return jsonError(c, 403, "write_disabled", "writes are temporarily disabled");
    }
    const body = c.req.valid("json");

    // Human check: a valid session cookie, or a fresh Turnstile token.
    const ts = turnstileConfig(c.env);
    if (ts.enabled) {
      const cookie = getCookie(c.req.header("Cookie") ?? null, SESSION_COOKIE);
      let human = (await verifySession(ts.secret, cookie, Date.now())) > 0;
      if (!human && body.token) {
        human = await verifyTurnstileToken(body.token, ts.secret);
      }
      if (!human) return jsonError(c, 403, "human_required", "human verification required");
    }

    const geohash = encodeGeohash(body.lat, body.lng, GEOHASH_PRECISION);
    const center = roomCenterFromGeohash(geohash);

    // Room creation is location-gated, just like painting.
    const gate = checkLocationGate({
      roomCenter: center,
      lat: body.lat,
      lng: body.lng,
      acc: body.acc,
    });
    if (!gate.canWrite) {
      return jsonError(c, 403, gate.reason ?? "forbidden", "outside write area");
    }

    const existing = await c.env.DB.prepare(
      `SELECT geohash FROM rooms WHERE geohash = ?1`,
    )
      .bind(geohash)
      .first<{ geohash: string }>();

    if (existing) {
      // Idempotent: return the existing room.
      return c.json({ ok: true, geohash, created: false });
    }

    const now = Date.now();
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO rooms
        (geohash, precision, center_lat, center_lng, name, pixel_count, created_at, last_drawn_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6)`,
    )
      .bind(geohash, GEOHASH_PRECISION, center.lat, center.lng, body.name ?? null, now)
      .run();

    return c.json({ ok: true, geohash, created: true });
  });
}
