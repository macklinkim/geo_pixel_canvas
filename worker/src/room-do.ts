import { DurableObject } from "cloudflare:workers";
import {
  BOARD_W,
  BOARD_H,
  BOARD_AREA,
  EMPTY,
  COOLDOWN_MS,
  PALETTE_VERSION,
  MAX_WS_MESSAGE_BYTES,
  WRITE_BURST_CELLS,
  WRITE_REFILL_CELLS_PER_SEC,
} from "@shared/constants";
import { ClientMsg, type ServerMsg } from "@shared/protocol";
import { encodeSnapshot } from "@shared/snapshot";
import { checkLocationGate } from "@shared/geo/locationGate";
import { roomCenterFromGeohash } from "@shared/room";
import { reverseGeocodeName } from "./geocode";
import { turnstileConfig, verifyTurnstileToken } from "./turnstile";
import type { Env } from "./env";

interface ConnState {
  sessionId: string;
  cooldownUntil: number;
  /** Until when this connection counts as human-verified (ms epoch). */
  humanVerifiedUntil: number;
  /** Cell-based flood-guard bucket (capacity WRITE_BURST_CELLS). */
  tokens: number;
  /** Last time the flood-guard bucket was refilled (ms epoch). */
  lastRefill: number;
}

/** Strip control/zero-width/bidi chars and collapse whitespace in room names. */
function sanitizeRoomName(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    // Drop C0/C1 controls, DEL, zero-width / bidi marks, line/para separators, BOM.
    const control = code < 0x20 || code === 0x7f;
    const invisible =
      (code >= 0x200b && code <= 0x200f) ||
      code === 0x2028 ||
      code === 0x2029 ||
      code === 0xfeff;
    if (control || invisible) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 40);
}

type Row<T> = T & Record<string, SqlStorageValue>;

interface PixelRow {
  x: number;
  y: number;
  color: number;
}

/** One instance per geohash room. Owns the pixel SQLite and all live sockets. */
export class RoomDurableObject extends DurableObject<Env> {
  private initialized = false;
  private roomId: string | null = null;

  // ---------- lifecycle / schema ----------

  private ensureInit(): void {
    if (this.initialized) return;
    const sql = this.ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS pixels (
      x          INTEGER NOT NULL,
      y          INTEGER NOT NULL,
      color      INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (x, y)
    )`);
    sql.exec(`CREATE TABLE IF NOT EXISTS room_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    this.initialized = true;
  }

  private setRoomId(roomId: string): void {
    this.roomId = roomId;
    this.ctx.storage.sql.exec(
      `INSERT INTO room_meta (key, value) VALUES ('roomId', ?1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      roomId,
    );
  }

  private getRoomId(): string {
    if (this.roomId) return this.roomId;
    const cursor = this.ctx.storage.sql.exec<Row<{ value: string }>>(
      `SELECT value FROM room_meta WHERE key = 'roomId'`,
    );
    for (const row of cursor) {
      this.roomId = row.value;
      return row.value;
    }
    return "";
  }

  // ---------- HTTP -> WebSocket upgrade ----------

  async fetch(request: Request): Promise<Response> {
    this.ensureInit();

    const url = new URL(request.url);
    const roomId = url.searchParams.get("room");
    if (roomId) this.setRoomId(roomId);

    // Human-session window validated by the Worker (trusted boundary).
    const humanVerifiedUntil = Number(url.searchParams.get("human")) || 0;

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    const state: ConnState = {
      sessionId: crypto.randomUUID(),
      cooldownUntil: 0,
      humanVerifiedUntil,
      tokens: WRITE_BURST_CELLS,
      lastRefill: Date.now(),
    };
    server.serializeAttachment(state);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------- WebSocket message handling (hibernation API) ----------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.ensureInit();

    if (typeof message !== "string") {
      this.send(ws, { t: "ack", ok: false, reason: "invalid" });
      return;
    }
    if (message.length > MAX_WS_MESSAGE_BYTES) {
      this.send(ws, { t: "ack", ok: false, reason: "invalid" });
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(message);
    } catch {
      this.send(ws, { t: "ack", ok: false, reason: "invalid" });
      return;
    }

    const parsed = ClientMsg.safeParse(raw);
    if (!parsed.success) {
      this.send(ws, { t: "ack", ok: false, reason: "invalid" });
      return;
    }

    const msg = parsed.data;
    switch (msg.t) {
      case "join":
        return this.handleJoin(ws, msg.lat, msg.lng, msg.acc);
      case "paint":
        return this.handlePaint(ws, msg);
      case "stamp":
        return this.handleStamp(ws, msg);
      case "rename":
        return this.handleRename(ws, msg);
      case "ping":
        this.send(ws, { t: "pong", serverTime: Date.now() });
        return;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string, _clean: boolean): Promise<void> {
    try {
      ws.close(code, "closing");
    } catch {
      /* already closed */
    }
    this.broadcastPresence();
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    this.broadcastPresence();
  }

  // ---------- handlers ----------

  private async handleJoin(ws: WebSocket, lat: number, lng: number, acc: number): Promise<void> {
    const gate = this.gate(lat, lng, acc);
    const state = this.getConn(ws);
    const cooldownMs = Math.max(0, state.cooldownUntil - Date.now());
    const name = await this.fetchName();

    this.send(ws, {
      t: "snapshot",
      w: BOARD_W,
      h: BOARD_H,
      paletteVersion: PALETTE_VERSION,
      pixels: encodeSnapshot(this.buildSnapshot()),
      canWrite: gate.canWrite,
      cooldownMs,
      online: this.online(),
      name,
    });

    this.broadcastPresence();
  }

  private async handleRename(
    ws: WebSocket,
    msg: { name: string; lat: number; lng: number; acc: number; token?: string },
  ): Promise<void> {
    if (this.writesDisabled()) {
      this.send(ws, { t: "ack", ok: false, reason: "write_disabled" });
      return;
    }
    const gate = this.gate(msg.lat, msg.lng, msg.acc);
    if (!gate.canWrite) {
      this.send(ws, { t: "ack", ok: false, reason: gate.reason ?? "invalid" });
      return;
    }

    const human = await this.requireHuman(ws, msg.token);
    if (!human.ok) {
      this.send(ws, { t: "ack", ok: false, reason: human.reason });
      return;
    }

    const roomId = this.getRoomId();
    if (!roomId) return;
    const name = sanitizeRoomName(msg.name);
    if (!name) return;

    const center = roomCenterFromGeohash(roomId);
    const now = Date.now();
    try {
      await this.env.DB.prepare(
        `INSERT INTO rooms
           (geohash, precision, center_lat, center_lng, name, pixel_count, created_at, last_drawn_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6)
         ON CONFLICT(geohash) DO UPDATE SET name = ?5`,
      )
        .bind(roomId, roomId.length, center.lat, center.lng, name, now)
        .run();
    } catch {
      console.warn("room rename sync failed");
    }
    this.broadcast({ t: "meta", name });
  }

  private async fetchName(): Promise<string | null> {
    const roomId = this.getRoomId();
    if (!roomId) return null;
    try {
      const row = await this.env.DB.prepare(`SELECT name FROM rooms WHERE geohash = ?1`)
        .bind(roomId)
        .first<{ name: string | null }>();
      return row?.name ?? null;
    } catch {
      return null;
    }
  }

  private async handlePaint(
    ws: WebSocket,
    msg: { x: number; y: number; color: number; lat: number; lng: number; acc: number; token?: string },
  ): Promise<void> {
    if (this.writesDisabled()) {
      this.send(ws, { t: "ack", ok: false, reason: "write_disabled" });
      return;
    }
    const gate = this.gate(msg.lat, msg.lng, msg.acc);
    if (!gate.canWrite) {
      this.send(ws, { t: "ack", ok: false, reason: gate.reason ?? "invalid" });
      return;
    }

    const human = await this.requireHuman(ws, msg.token);
    if (!human.ok) {
      this.send(ws, { t: "ack", ok: false, reason: human.reason });
      return;
    }

    const state = this.getConn(ws);
    const now = Date.now();
    if (now < state.cooldownUntil) {
      this.send(ws, {
        t: "ack",
        ok: false,
        reason: "cooldown",
        cooldownMs: state.cooldownUntil - now,
      });
      return;
    }

    if (!this.consume(ws, state, 1, now)) {
      this.send(ws, { t: "ack", ok: false, reason: "rate_limited" });
      return;
    }

    const isNewCell = !this.cellExists(msg.x, msg.y);
    this.ctx.storage.sql.exec(
      `INSERT INTO pixels (x, y, color, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(x, y) DO UPDATE SET color = excluded.color, updated_at = excluded.updated_at`,
      msg.x,
      msg.y,
      msg.color,
      now,
    );

    // Update this connection's cooldown.
    state.cooldownUntil = now + COOLDOWN_MS;
    ws.serializeAttachment(state);

    // Broadcast the single-cell change to everyone (sender included).
    this.broadcast({ t: "pixel", x: msg.x, y: msg.y, color: msg.color, updatedAt: now });
    this.send(ws, { t: "ack", ok: true, cooldownMs: COOLDOWN_MS });

    // Best-effort global index sync (never blocks the realtime path on failure).
    await this.syncIndex(isNewCell ? 1 : 0, now);
  }

  private async handleStamp(
    ws: WebSocket,
    msg: { cells: { x: number; y: number; color: number }[]; lat: number; lng: number; acc: number; token?: string },
  ): Promise<void> {
    if (this.writesDisabled()) {
      this.send(ws, { t: "ack", ok: false, reason: "write_disabled" });
      return;
    }
    const gate = this.gate(msg.lat, msg.lng, msg.acc);
    if (!gate.canWrite) {
      this.send(ws, { t: "ack", ok: false, reason: gate.reason ?? "invalid" });
      return;
    }

    const human = await this.requireHuman(ws, msg.token);
    if (!human.ok) {
      this.send(ws, { t: "ack", ok: false, reason: human.reason });
      return;
    }

    const state = this.getConn(ws);
    const now = Date.now();
    if (now < state.cooldownUntil) {
      this.send(ws, { t: "ack", ok: false, reason: "cooldown", cooldownMs: state.cooldownUntil - now });
      return;
    }

    if (!this.consume(ws, state, msg.cells.length, now)) {
      this.send(ws, { t: "ack", ok: false, reason: "rate_limited" });
      return;
    }

    // A whole stamp costs a single cooldown.
    let newCells = 0;
    for (const c of msg.cells) {
      if (!this.cellExists(c.x, c.y)) newCells++;
      this.ctx.storage.sql.exec(
        `INSERT INTO pixels (x, y, color, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(x, y) DO UPDATE SET color = excluded.color, updated_at = excluded.updated_at`,
        c.x,
        c.y,
        c.color,
        now,
      );
      this.broadcast({ t: "pixel", x: c.x, y: c.y, color: c.color, updatedAt: now });
    }

    state.cooldownUntil = now + COOLDOWN_MS;
    ws.serializeAttachment(state);
    this.send(ws, { t: "ack", ok: true, cooldownMs: COOLDOWN_MS });

    await this.syncIndex(newCells, now);
  }

  // ---------- helpers ----------

  private gate(lat: number, lng: number, acc: number) {
    const center = roomCenterFromGeohash(this.getRoomId());
    return checkLocationGate({ roomCenter: center, lat, lng, acc });
  }

  private cellExists(x: number, y: number): boolean {
    const cursor = this.ctx.storage.sql.exec<Row<{ n: number }>>(
      `SELECT 1 AS n FROM pixels WHERE x = ?1 AND y = ?2 LIMIT 1`,
      x,
      y,
    );
    for (const _ of cursor) return true;
    return false;
  }

  private buildSnapshot(): Uint8Array {
    const arr = new Uint8Array(BOARD_AREA).fill(EMPTY);
    const cursor = this.ctx.storage.sql.exec<Row<PixelRow>>(`SELECT x, y, color FROM pixels`);
    for (const row of cursor) {
      const idx = row.y * BOARD_W + row.x;
      if (idx >= 0 && idx < BOARD_AREA) arr[idx] = row.color;
    }
    return arr;
  }

  private async syncIndex(inc: number, now: number): Promise<void> {
    const roomId = this.getRoomId();
    if (!roomId) return;
    const center = roomCenterFromGeohash(roomId);
    try {
      const existing = await this.env.DB.prepare(
        `SELECT name FROM rooms WHERE geohash = ?1`,
      )
        .bind(roomId)
        .first<{ name: string | null }>();

      if (!existing) {
        // First time this room appears in the global index: name it by area.
        const name = await reverseGeocodeName(center.lat, center.lng, this.env.GEOCODE_URL);
        await this.env.DB.prepare(
          `INSERT INTO rooms
             (geohash, precision, center_lat, center_lng, name, pixel_count, created_at, last_drawn_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
           ON CONFLICT(geohash) DO UPDATE SET
             pixel_count = pixel_count + ?6,
             last_drawn_at = ?7`,
        )
          .bind(roomId, roomId.length, center.lat, center.lng, name, inc, now)
          .run();
        return;
      }

      await this.env.DB.prepare(
        `UPDATE rooms SET pixel_count = pixel_count + ?2, last_drawn_at = ?3 WHERE geohash = ?1`,
      )
        .bind(roomId, inc, now)
        .run();

      // Backfill a missing name once, if geocoding is available.
      if (!existing.name) {
        const name = await reverseGeocodeName(center.lat, center.lng, this.env.GEOCODE_URL);
        if (name) {
          await this.env.DB.prepare(
            `UPDATE rooms SET name = ?2 WHERE geohash = ?1 AND name IS NULL`,
          )
            .bind(roomId, name)
            .run();
        }
      }
    } catch {
      // Pixel is already persisted in the DO; only the index lagged.
      console.warn("room index metadata sync failed");
    }
  }

  private getConn(ws: WebSocket): ConnState {
    const att = ws.deserializeAttachment() as ConnState | null;
    return (
      att ?? {
        sessionId: "unknown",
        cooldownUntil: 0,
        humanVerifiedUntil: 0,
        tokens: WRITE_BURST_CELLS,
        lastRefill: 0,
      }
    );
  }

  /**
   * Enforce human verification for a write. Passes when Turnstile is disabled,
   * when this connection has a live human window, or when a fresh token verifies
   * (which then opens a new window). Otherwise returns the ack reason to send.
   */
  private async requireHuman(
    ws: WebSocket,
    token: string | undefined,
  ): Promise<{ ok: true } | { ok: false; reason: "human_required" | "turnstile_failed" }> {
    const cfg = turnstileConfig(this.env);
    if (!cfg.enabled) return { ok: true };

    const state = this.getConn(ws);
    const now = Date.now();
    if (state.humanVerifiedUntil > now) return { ok: true };

    if (!token) return { ok: false, reason: "human_required" };
    const ok = await verifyTurnstileToken(token, cfg.secret);
    if (!ok) return { ok: false, reason: "turnstile_failed" };

    state.humanVerifiedUntil = now + cfg.ttlMs;
    ws.serializeAttachment(state);
    return { ok: true };
  }

  private writesDisabled(): boolean {
    return this.env.WRITE_DISABLED === "true";
  }

  /** Refill then try to spend `cost` cells from this connection's flood bucket. */
  private consume(ws: WebSocket, state: ConnState, cost: number, now: number): boolean {
    if (!Number.isFinite(state.tokens)) state.tokens = WRITE_BURST_CELLS;
    const last = Number.isFinite(state.lastRefill) ? state.lastRefill : now;
    const refilled = ((now - last) / 1000) * WRITE_REFILL_CELLS_PER_SEC;
    state.tokens = Math.min(WRITE_BURST_CELLS, state.tokens + Math.max(0, refilled));
    state.lastRefill = now;
    if (state.tokens < cost) {
      ws.serializeAttachment(state);
      return false;
    }
    state.tokens -= cost;
    ws.serializeAttachment(state);
    return true;
  }

  private online(): number {
    return this.ctx.getWebSockets().length;
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket gone */
    }
  }

  private broadcast(msg: ServerMsg): void {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        /* skip dead socket */
      }
    }
  }

  private broadcastPresence(): void {
    this.broadcast({ t: "presence", online: this.online() });
  }
}
