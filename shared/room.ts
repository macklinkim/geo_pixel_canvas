import { decodeGeohash, type LatLng } from "./geo/geohash";

const GEOHASH_RE = /^[0-9bcdefghjkmnpqrstuvwxyz]+$/;

/** Lightweight room metadata for map pins (mirrors the D1 rooms row, camelCased). */
export interface RoomMeta {
  geohash: string;
  precision: number;
  centerLat: number;
  centerLng: number;
  name: string | null;
  pixelCount: number;
  lastDrawnAt: number;
}

/** Validate a roomId against geohash charset and a sane length range. */
export function isValidGeohash(s: string): boolean {
  return typeof s === "string" && s.length >= 1 && s.length <= 12 && GEOHASH_RE.test(s);
}

export function roomCenterFromGeohash(geohash: string): LatLng {
  return decodeGeohash(geohash);
}
