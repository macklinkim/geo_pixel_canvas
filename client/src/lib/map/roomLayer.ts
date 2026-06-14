import maplibregl from "maplibre-gl";
import type { Map as MLMap, Marker } from "maplibre-gl";
import type { RoomMeta } from "@shared/room";

const HOT_RECENT_MS = 60 * 60 * 1000; // active within last hour
const HOT_PIXELS = 50;

function isHot(r: RoomMeta): boolean {
  return r.pixelCount >= HOT_PIXELS || Date.now() - r.lastDrawnAt < HOT_RECENT_MS;
}

/** Manages room pin markers on the map, diffing against the latest room list. */
export class RoomLayer {
  private markers = new Map<string, Marker>();

  constructor(
    private readonly map: MLMap,
    private readonly onOpen: (geohash: string) => void,
  ) {}

  update(rooms: RoomMeta[]): void {
    const next = new Set(rooms.map((r) => r.geohash));

    for (const [gh, m] of this.markers) {
      if (!next.has(gh)) {
        m.remove();
        this.markers.delete(gh);
      }
    }

    for (const r of rooms) {
      const existing = this.markers.get(r.geohash);
      if (existing) {
        this.styleEl(existing.getElement(), r);
        continue;
      }
      const el = document.createElement("div");
      this.styleEl(el, r);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.onOpen(r.geohash);
      });
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([r.centerLng, r.centerLat])
        .addTo(this.map);
      this.markers.set(r.geohash, marker);
    }
  }

  private styleEl(el: HTMLElement, r: RoomMeta): void {
    el.className = `room-pin ${isHot(r) ? "room-pin--hot" : ""}`;
    el.title = r.name ?? `Cell ${r.geohash}`;
  }

  destroy(): void {
    for (const m of this.markers.values()) m.remove();
    this.markers.clear();
  }
}
