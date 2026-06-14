import maplibregl from "maplibre-gl";
import type { Map as MLMap, StyleSpecification } from "maplibre-gl";
import {
  buildSatelliteStyle,
  OPENFREEMAP_LIBERTY,
  OPENFREEMAP_POSITRON,
  DEFAULT_BASEMAP,
  type BaseMapId,
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
const BASEMAP_KEY = "gpb:basemap";
const DEBOUNCE_MS = 350;

function loadView(): SavedView | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedView) : null;
  } catch {
    return null;
  }
}

function loadBaseMap(): BaseMapId {
  try {
    const v = localStorage.getItem(BASEMAP_KEY);
    if (v === "satellite" || v === "detailed" || v === "simple") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_BASEMAP;
}

export class MapController {
  readonly map: MLMap;
  private geolocate!: maplibregl.GeolocateControl;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Server-configured vector style URL, used for the "simple" base map. */
  private readonly vectorUrl: string | null;
  private base: BaseMapId;

  constructor(container: HTMLElement, styleUrl: string | null, private handlers: MapHandlers) {
    this.vectorUrl = styleUrl;
    this.base = loadBaseMap();
    const saved = loadView();
    this.map = new maplibregl.Map({
      container,
      style: this.styleFor(this.base),
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

    this.map.on("load", () => this.emitBbox());
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

  private styleFor(id: BaseMapId): StyleSpecification | string {
    if (id === "satellite") return buildSatelliteStyle();
    if (id === "detailed") return OPENFREEMAP_LIBERTY;
    // "simple": server-configured vector style, else the positron default.
    return this.vectorUrl ?? OPENFREEMAP_POSITRON;
  }

  get baseMap(): BaseMapId {
    return this.base;
  }

  /**
   * Switch the base map. Room pins are DOM markers and survive setStyle, so the
   * pin layer does not need to be rebuilt; the saved center/zoom is preserved.
   */
  setBaseMap(id: BaseMapId): void {
    if (id === this.base) return;
    this.base = id;
    try {
      localStorage.setItem(BASEMAP_KEY, id);
    } catch {
      /* ignore quota/private-mode errors */
    }
    this.map.setStyle(this.styleFor(id));
  }

  destroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.map.remove();
  }
}
