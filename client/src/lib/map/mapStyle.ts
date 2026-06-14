import type { RasterSourceSpecification, StyleSpecification } from "maplibre-gl";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Free, no-key aerial imagery (Esri World Imagery). Attribution required.
export const SATELLITE_SOURCE: RasterSourceSpecification = {
  type: "raster",
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  ],
  tileSize: 256,
  maxzoom: 19,
  attribution:
    "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
};

export const SATELLITE_SOURCE_ID = "satellite";
export const SATELLITE_LAYER_ID = "satellite-layer";

/**
 * If a style URL is configured (server-controlled tile provider), use it.
 * Otherwise fall back to the OSM raster tiles — for low-traffic dev/demo only
 * (see project_plan_draft.md §8). Attribution is always rendered.
 */
export function buildStyle(styleUrl: string | null): StyleSpecification | string {
  if (styleUrl) return styleUrl;
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        // OSM serves up to z19; cap here so MapLibre over-zooms the z19 tile
        // instead of requesting non-existent z20+ tiles.
        maxzoom: 19,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  } satisfies StyleSpecification;
}
