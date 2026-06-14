// WebSocket message protocol (JSON text frames). Shared Zod schemas used by
// client, worker, and MCP. See project_plan_draft.md §12.

import { z } from "zod";
import { BOARD_W, BOARD_H, MAX_COLOR, MIN_COLOR } from "./constants";

// Bounded geo fields — reject garbage/out-of-range coordinates before they ever
// reach the geohash/gate math. Shared by every location-bearing client message.
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const acc = z.number().nonnegative().max(100_000);

// ---------- Client -> Server ----------

export const JoinMsg = z.object({
  t: z.literal("join"),
  lat,
  lng,
  acc,
});

export const PaintMsg = z.object({
  t: z.literal("paint"),
  x: z.number().int().min(0).max(BOARD_W - 1),
  y: z.number().int().min(0).max(BOARD_H - 1),
  color: z.number().int().min(MIN_COLOR).max(MAX_COLOR),
  lat,
  lng,
  acc,
  // Optional Turnstile token, only sent when the server asks (human_required).
  token: z.string().max(2048).optional(),
});

export const StampCell = z.object({
  x: z.number().int().min(0).max(BOARD_W - 1),
  y: z.number().int().min(0).max(BOARD_H - 1),
  color: z.number().int().min(MIN_COLOR).max(MAX_COLOR),
});

// A stamp places many cells at once and costs a single cooldown.
export const StampMsg = z.object({
  t: z.literal("stamp"),
  cells: z.array(StampCell).min(1).max(512),
  lat,
  lng,
  acc,
  token: z.string().max(2048).optional(),
});

export const RenameMsg = z.object({
  t: z.literal("rename"),
  name: z.string().trim().min(1).max(40),
  lat,
  lng,
  acc,
  token: z.string().max(2048).optional(),
});

export const PingMsg = z.object({
  t: z.literal("ping"),
  clientTime: z.number(),
});

export const ClientMsg = z.discriminatedUnion("t", [
  JoinMsg,
  PaintMsg,
  StampMsg,
  RenameMsg,
  PingMsg,
]);

// ---------- Server -> Client ----------

export const SnapshotMsg = z.object({
  t: z.literal("snapshot"),
  w: z.number().int(),
  h: z.number().int(),
  paletteVersion: z.number().int(),
  pixels: z.string(), // base64 Uint8Array
  canWrite: z.boolean(),
  cooldownMs: z.number().int().nonnegative(),
  online: z.number().int().nonnegative(),
  name: z.string().nullable(),
});

export const PixelMsg = z.object({
  t: z.literal("pixel"),
  x: z.number().int(),
  y: z.number().int(),
  color: z.number().int(),
  updatedAt: z.number().int(),
});

export const AckReason = z.enum([
  "cooldown",
  "out_of_range",
  "low_accuracy",
  "invalid",
  "rate_limited",
  "write_disabled",
  "human_required",
  "turnstile_failed",
]);

export const AckMsg = z.object({
  t: z.literal("ack"),
  ok: z.boolean(),
  reason: AckReason.optional(),
  cooldownMs: z.number().int().nonnegative().optional(),
});

export const PresenceMsg = z.object({
  t: z.literal("presence"),
  online: z.number().int().nonnegative(),
});

export const MetaMsg = z.object({
  t: z.literal("meta"),
  name: z.string().nullable(),
});

export const PongMsg = z.object({
  t: z.literal("pong"),
  serverTime: z.number(),
});

export const ServerMsg = z.discriminatedUnion("t", [
  SnapshotMsg,
  PixelMsg,
  AckMsg,
  PresenceMsg,
  MetaMsg,
  PongMsg,
]);

// ---------- Inferred types ----------

export type JoinMsg = z.infer<typeof JoinMsg>;
export type PaintMsg = z.infer<typeof PaintMsg>;
export type RenameMsg = z.infer<typeof RenameMsg>;
export type PingMsg = z.infer<typeof PingMsg>;
export type ClientMsg = z.infer<typeof ClientMsg>;

export type SnapshotMsg = z.infer<typeof SnapshotMsg>;
export type PixelMsg = z.infer<typeof PixelMsg>;
export type AckMsg = z.infer<typeof AckMsg>;
export type AckReason = z.infer<typeof AckReason>;
export type PresenceMsg = z.infer<typeof PresenceMsg>;
export type MetaMsg = z.infer<typeof MetaMsg>;
export type PongMsg = z.infer<typeof PongMsg>;
export type ServerMsg = z.infer<typeof ServerMsg>;
