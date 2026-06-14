# Artwork Gallery / Export Backlog

## Current State

Geo Pixel Board already persists each room's pixel state internally:

- Each geohash room is a Cloudflare Durable Object.
- Each room owns a local SQLite `pixels(x, y, color, updated_at)` table.
- New visitors receive the current board through a WebSocket `snapshot`.
- D1 stores only lightweight room metadata: geohash, center coordinates, name, pixel count, and timestamps.

This means drawings survive reconnection and can be viewed again by reopening the same room.

## Missing User-Facing Features

The app does not yet provide artwork-oriented discovery or saving features:

- No PNG/image export from the board canvas.
- No download button for the current room artwork.
- No shareable room URL that opens a specific drawing directly.
- No gallery, feed, or list of recent/popular artworks.
- No thumbnail/preview stored in D1 or R2.
- No endpoint that returns a room's rendered image or thumbnail.

Currently, users can discover other drawings only by panning the map, loading room pins via
`GET /api/rooms`, and clicking a pin to join that room.

## Desired Direction

Add lightweight discovery before building a full gallery:

1. Add a "Recent drawings" control near the map controls.
2. Show a compact overlay with about 5 recently active rooms.
3. Each item should show room name, rough location metadata, activity info, and eventually a thumbnail.
4. Clicking an item should move the map to that room and open the board in read/view mode.
5. Later, add image export and generated thumbnails.

## Implementation Notes

- D1 already has `last_drawn_at`, `pixel_count`, `center_lat`, `center_lng`, and `name`, so a first version can use metadata only.
- A first endpoint can be `GET /api/rooms/recent?limit=5`.
- Avoid reading every Durable Object just to render the recent list; that would be expensive and slow.
- For true visual previews, add a later thumbnail pipeline:
  - Option A: generate small thumbnails in the Durable Object after paint/stamp and store base64 or compact pixel data in D1.
  - Option B: render PNG thumbnails and store them in R2, with `thumbnail_r2_key` in D1.
- Keep privacy constraints: do not expose user coordinates, IP addresses, or painter identity.

## Open Product Questions

- Should "recent" mean recently created rooms, recently drawn rooms, or both?
- Should empty rooms appear in the list?
- Should the list be global, viewport-local, or near the user's current map center?
- Should clicking an item only fly to the map pin, or also open the room modal immediately?
- Should exported images include room name/date/map location attribution?
