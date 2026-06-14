-- Global room index (D1). Holds only lightweight pin metadata, never pixel data.
CREATE TABLE IF NOT EXISTS rooms (
  geohash       TEXT PRIMARY KEY,
  precision     INTEGER NOT NULL DEFAULT 8,
  center_lat    REAL NOT NULL,
  center_lng    REAL NOT NULL,
  name          TEXT,
  pixel_count   INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  last_drawn_at INTEGER NOT NULL,
  last_seen_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_rooms_bbox ON rooms (center_lat, center_lng);
CREATE INDEX IF NOT EXISTS idx_rooms_recent ON rooms (last_drawn_at DESC);
