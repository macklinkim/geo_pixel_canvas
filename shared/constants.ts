// Single source of truth for game-rule defaults (see project_plan_draft.md §11).

// Rectangular "drawing paper" board (3:2 landscape).
export const BOARD_W = 192;
export const BOARD_H = 128;
export const BOARD_AREA = BOARD_W * BOARD_H; // 24576

/** Value for an unpainted cell. Kept out of the 0..15 palette range. */
export const EMPTY = 255;

/** Palette indices are 0..31 (32 fixed colors). EMPTY (255) stays out of range. */
export const MIN_COLOR = 0;
export const MAX_COLOR = 31;

// Near-imperceptible cooldown (0.1s) — flood guard only, not a felt limit.
export const COOLDOWN_MS = 100;

/** Write gate: user must be within this many meters of the room center. */
export const WRITE_RADIUS_M = 100;

/**
 * Write gate: geolocation accuracy must be at most this many meters.
 * Loosened from 100m so real-world (incl. desktop/Wi-Fi) fixes can paint;
 * locality is still enforced by the distance check. v1 is casual deterrence.
 */
export const MAX_ACCURACY_M = 500;

export const GEOHASH_PRECISION = 8;

export const PALETTE_VERSION = 2;

/** Per-connection flood guard, independent of the cooldown. */
export const PAINT_RATE_PER_SEC = 1;

// Per-connection cell-based token bucket (flood guard layered over the cooldown).
// Measured in CELLS so it also bounds `stamp`, which writes many cells per action.
// Tuned to be invisible to a human painter (~10 cells/s via the 0.1s cooldown,
// far below the refill rate) while throttling scripted stamp-spam / board wipes.
/** Bucket capacity: how many cells a connection may write in a burst. */
export const WRITE_BURST_CELLS = 1500;
/** Sustained refill rate in cells per second once the burst is spent. */
export const WRITE_REFILL_CELLS_PER_SEC = 300;

/** Reject oversized inbound frames before parsing. */
export const MAX_WS_MESSAGE_BYTES = 16 * 1024;
