import { BOARD_AREA } from "@shared/constants";
import type { Env } from "./env";

// Retention policy (server-only — the client never needs these). A board is
// "substantial" at >= 50% fill and earns a much longer grace period; sparse
// boards are reclaimed quickly once they go quiet. Both windows measure
// inactivity from the room's last paint (`last_drawn_at`).
export const RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 2 weeks
export const PRESERVED_RETENTION_MS = 180 * 24 * 60 * 60 * 1000; // ~6 months
export const PRESERVE_MIN_PIXELS = Math.ceil(BOARD_AREA * 0.5); // 50% of the canvas

// Cap rooms reclaimed per run so a backlog can't make one cron tick run long;
// the next tick continues where this left off.
const PURGE_BATCH = 500;

/**
 * Delete boards whose last activity is older than their retention window.
 *
 * Order matters: each room's Durable Object storage is wiped FIRST, and only on
 * success is the D1 index row removed. The reverse would orphan the DO — it would
 * keep consuming storage with no index row left to reach it.
 */
export async function purgeExpiredRooms(env: Env): Promise<{ purged: number; skipped: number }> {
  const now = Date.now();
  const sparseBefore = now - RETENTION_MS;
  const preservedBefore = now - PRESERVED_RETENTION_MS;

  const { results } = await env.DB.prepare(
    `SELECT geohash FROM rooms
     WHERE (pixel_count < ?1 AND last_drawn_at < ?2)
        OR (pixel_count >= ?1 AND last_drawn_at < ?3)
     LIMIT ?4`,
  )
    .bind(PRESERVE_MIN_PIXELS, sparseBefore, preservedBefore, PURGE_BATCH)
    .all<{ geohash: string }>();

  let purged = 0;
  let skipped = 0;
  for (const { geohash } of results) {
    try {
      const stub = env.ROOM.get(env.ROOM.idFromName(geohash));
      const wiped = await stub.purge();
      if (!wiped) {
        skipped++; // someone is connected — leave it for the next run
        continue;
      }
      await env.DB.prepare(`DELETE FROM rooms WHERE geohash = ?1`).bind(geohash).run();
      purged++;
    } catch {
      // DO or D1 hiccup: leave the index row so the room is retried next run
      // rather than orphaning its storage.
      skipped++;
    }
  }

  if (purged || skipped) {
    console.log(`retention: purged ${purged}, skipped ${skipped} of ${results.length}`);
  }
  return { purged, skipped };
}
