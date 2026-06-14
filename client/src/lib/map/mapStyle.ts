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

// Public-grade keyless OpenFreeMap vector styles.
// liberty = detailed OSM-bright basemap (buildings, POIs, labels);
// positron = clean minimal light basemap.
export const OPENFREEMAP_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";
export const OPENFREEMAP_POSITRON = "https://tiles.openfreemap.org/styles/positron";

/** Selectable base maps, in display order. */
export type BaseMapId = "satellite" | "detailed" | "simple";

export const BASEMAPS: { id: BaseMapId; label: string }[] = [
  { id: "satellite", label: "항공" },
  { id: "detailed", label: "상세" },
  { id: "simple", label: "심플" },
];

export const DEFAULT_BASEMAP: BaseMapId = "satellite";

/** Standalone aerial style: Esri imagery as the base layer. */
export function buildSatelliteStyle(): StyleSpecification {
  return {
    version: 8,
    sources: { [SATELLITE_SOURCE_ID]: SATELLITE_SOURCE },
    layers: [{ id: SATELLITE_LAYER_ID, type: "raster", source: SATELLITE_SOURCE_ID }],
  } satisfies StyleSpecification;
}

/**
 * Dev/demo fallback when no vector style URL is configured: plain OSM raster.
 * Low-traffic only (see project_plan_draft.md §8). Attribution always rendered.
 */
export function osmFallbackStyle(): StyleSpecification {
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
