// Reverse-geocode a geohash cell center into a short area name for the room.
//
// Privacy: we only ever geocode the *cell center* (public, derived from the
// geohash we already store) — never the user's raw coordinates.
//
// Policy: called at most once per room (on first creation) and the result is
// cached permanently in D1, keeping us well under Nominatim's 1 req/s limit.
// A descriptive User-Agent is required by Nominatim's usage policy.

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
}

interface NominatimResult {
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name?: string;
}

export interface GeocodeHit {
  lat: number;
  lng: number;
  label: string;
}

/** Forward geocode (address/place text -> coordinate). Never throws. */
export async function forwardGeocode(
  query: string,
  baseUrl: string | undefined,
): Promise<GeocodeHit | null> {
  if (!baseUrl || !query.trim()) return null;
  const url =
    `${baseUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}` +
    `&format=jsonv2&limit=1&accept-language=ko`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "geo-pixel-board/0.1 (https://github.com/geo-pixel-board)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as NominatimSearchResult[];
    const hit = arr[0];
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: hit.display_name ?? query };
  } catch {
    return null;
  }
}

/**
 * Returns a short room name (street/area) for the given cell center, or null
 * if geocoding is disabled (no baseUrl) or fails. Never throws.
 */
export async function reverseGeocodeName(
  lat: number,
  lng: number,
  baseUrl: string | undefined,
): Promise<string | null> {
  if (!baseUrl) return null;
  const url =
    `${baseUrl.replace(/\/$/, "")}/reverse?lat=${lat}&lon=${lng}` +
    `&format=jsonv2&zoom=18&addressdetails=1&accept-language=ko`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "geo-pixel-board/0.1 (https://github.com/geo-pixel-board)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult;
    const a = data.address ?? {};
    const name =
      a.road ??
      a.pedestrian ??
      a.neighbourhood ??
      a.suburb ??
      a.city_district ??
      a.town ??
      a.village ??
      data.name ??
      null;
    if (!name) return null;
    return name.length > 40 ? name.slice(0, 40) : name;
  } catch {
    return null;
  }
}
