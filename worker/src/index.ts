import { Hono } from "hono";
import { isValidGeohash } from "@shared/room";
import { GEOHASH_PRECISION } from "@shared/constants";
import { registerRooms } from "./rooms";
import { registerAdmin, verifyAdminCookie } from "./admin";
import { RoomDurableObject } from "./room-do";
import { purgeExpiredRooms } from "./retention";
import { jsonError } from "./errors";
import { turnstileConfig } from "./turnstile";
import { SESSION_COOKIE, getCookie, verifySession } from "./session";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

registerRooms(app);
registerAdmin(app);

// WebSocket: /ws/:roomId -> the room's Durable Object.
app.get("/ws/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  // Rooms are always created at the fixed precision; reject other lengths so
  // arbitrary-precision geohashes can't spin up stray Durable Objects.
  if (!isValidGeohash(roomId) || roomId.length !== GEOHASH_PRECISION) {
    return jsonError(c, 400, "bad_room", "invalid room id");
  }
  if (c.req.header("Upgrade") !== "websocket") {
    return jsonError(c, 426, "upgrade_required", "expected websocket upgrade");
  }

  // Validate the human-session cookie here (trusted boundary) and pass the
  // verified-until timestamp to the DO. The DO is only reachable via the
  // Worker, so this param is trustworthy.
  let humanUntil = 0;
  const ts = turnstileConfig(c.env);
  if (!ts.enabled) {
    humanUntil = Number.MAX_SAFE_INTEGER; // gate off -> always "human"
  } else {
    const cookie = getCookie(c.req.header("Cookie") ?? null, SESSION_COOKIE);
    humanUntil = await verifySession(ts.secret, cookie, Date.now());
  }

  // Admin override window, verified here at the trusted boundary from the signed
  // gpb_admin cookie. The DO uses it to bypass ONLY the location gate.
  const adminUntil = await verifyAdminCookie(c.env, c.req.header("Cookie") ?? null, Date.now());

  const id = c.env.ROOM.idFromName(roomId);
  const stub = c.env.ROOM.get(id);

  // Forward the upgrade, telling the DO its own room id + human/admin windows.
  const url = new URL(c.req.url);
  url.searchParams.set("room", roomId);
  url.searchParams.set("human", String(humanUntil));
  url.searchParams.set("admin", String(adminUntil));
  return stub.fetch(new Request(url, c.req.raw));
});

// Entry gate (server-enforced): /app requires a valid human session, otherwise
// redirect to /verify. Client-side routing alone is not trusted.
app.get("/app", async (c) => {
  const ts = turnstileConfig(c.env);
  if (ts.enabled) {
    const cookie = getCookie(c.req.header("Cookie") ?? null, SESSION_COOKIE);
    const exp = await verifySession(ts.secret, cookie, Date.now());
    if (exp <= 0) return c.redirect("/verify", 302);
  }
  return c.env.ASSETS.fetch(c.req.raw); // SPA fallback serves index.html
});

// API 404 (non-matching /api/* paths). Static assets are handled by the
// ASSETS binding outside the Worker (run_worker_first only routes /api + /ws).
app.all("/api/*", (c) => jsonError(c, 404, "not_found", "unknown api route"));

// Fallback for anything else that reached the Worker: defer to static assets.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

// Cron-driven data retention runs alongside the HTTP/WebSocket app.
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(purgeExpiredRooms(env));
  },
} satisfies ExportedHandler<Env>;
export { RoomDurableObject };
