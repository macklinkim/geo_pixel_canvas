import maplibregl from "maplibre-gl";
import type { Map as MLMap } from "maplibre-gl";
import {
  buildStyle,
  SATELLITE_SOURCE,
  SATELLITE_SOURCE_ID,
  SATELLITE_LAYER_ID,
} from "./mapStyle";

export interface Bbox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface MapHandlers {
  onMoveEnd: (bbox: Bbox) => void;
  onMapClick: (lat: number, lng: number) => void;
}

interface SavedView {
  center: [number, number];
  zoom: number;
}

const DEFAULT_CENTER: [number, number] = [126.9706, 37.5547]; // Seoul Station [lng,lat]
const DEFAULT_ZOOM = 16;
const STORAGE_KEY = "gpb:lastView";
const DEBOUNCE_MS = 350;

function loadView(): SavedView | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedView) : null;
  } catch {
    return null;
  }
}

export class MapController {
  readonly map: MLMap;
  private geolocate!: maplibregl.GeolocateControl;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private satellite = false;

  constructor(container: HTMLElement, styleUrl: string | null, private handlers: MapHandlers) {
    const saved = loadView();
    this.map = new maplibregl.Map({
      container,
      style: buildStyle(styleUrl),
      center: saved?.center ?? DEFAULT_CENTER,
      zoom: Math.min(saved?.zoom ?? DEFAULT_ZOOM, 19),
      maxZoom: 19,
      attributionControl: { compact: true },
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // "내 위치로 이동" — recenters the map to where the user can actually draw.
    this.geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserLocation: true,
      fitBoundsOptions: { maxZoom: 18 },
    });
    this.map.addControl(this.geolocate, "top-right");

    this.map.on("load", () => {
      this.addSatelliteLayer();
      this.emitBbox();
    });
    this.map.on("moveend", () => {
      this.saveView();
      this.emitBbox();
    });
    this.map.on("click", (e) => this.handlers.onMapClick(e.lngLat.lat, e.lngLat.lng));
  }

  private emitBbox(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const b = this.map.getBounds();
      this.handlers.onMoveEnd({
        minLat: b.getSouth(),
        minLng: b.getWest(),
        maxLat: b.getNorth(),
        maxLng: b.getEast(),
      });
    }, DEBOUNCE_MS);
  }

  private saveView(): void {
    try {
      const c = this.map.getCenter();
      const view: SavedView = { center: [c.lng, c.lat], zoom: this.map.getZoom() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
    } catch {
      /* ignore quota/private-mode errors */
    }
  }

  /** Programmatically trigger "go to my location" (same as the map button). */
  locate(): void {
    this.geolocate.trigger();
  }

  /** Fly to a coordinate (used by address search). */
  flyTo(lat: number, lng: number, zoom = 17): void {
    this.map.flyTo({ center: [lng, lat], zoom, essential: true });
  }

  private addSatelliteLayer(): void {
    if (this.map.getSource(SATELLITE_SOURCE_ID)) return;
    this.map.addSource(SATELLITE_SOURCE_ID, SATELLITE_SOURCE);
    this.map.addLayer({
      id: SATELLITE_LAYER_ID,
      type: "raster",
      source: SATELLITE_SOURCE_ID,
      layout: { visibility: "none" },
    });
  }

  /** Toggle aerial imagery on top of the base map. Returns the new state. */
  toggleSatellite(): boolean {
    this.satellite = !this.satellite;
    if (this.map.getLayer(SATELLITE_LAYER_ID)) {
      this.map.setLayoutProperty(
        SATELLITE_LAYER_ID,
        "visibility",
        this.satellite ? "visible" : "none",
      );
    }
    return this.satellite;
  }

  get isSatellite(): boolean {
    return this.satellite;
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.map.remove();
  }
}
