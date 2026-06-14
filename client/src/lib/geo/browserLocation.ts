// Thin wrapper around the Geolocation API. Coordinates are used only for the
// write-permission check and never logged.

export interface Position {
  lat: number;
  lng: number;
  acc: number;
}

function toPosition(p: GeolocationPosition): Position {
  return { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
}

export function getCurrentPosition(timeoutMs = 10000): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toPosition(p)),
      (e) => reject(e),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export function watchPosition(
  onUpdate: (p: Position) => void,
  onError: (e: GeolocationPositionError) => void,
): () => void {
  if (!navigator.geolocation) {
    onError({ code: 2, message: "geolocation unavailable" } as GeolocationPositionError);
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onUpdate(toPosition(p)),
    onError,
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
