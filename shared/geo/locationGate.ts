import { MAX_ACCURACY_M, WRITE_RADIUS_M } from "../constants";
import { haversineMeters } from "./haversine";
import type { LatLng } from "./geohash";

export type GateReason = "out_of_range" | "low_accuracy";

export interface GateInput {
  roomCenter: LatLng;
  lat: number;
  lng: number;
  acc: number;
}

export interface GateResult {
  canWrite: boolean;
  reason: GateReason | null;
  distanceM: number;
  accuracyM: number;
}

/**
 * Shared write-permission rule. The Durable Object is authoritative; the client
 * and MCP tools call this same function so their hints match the server.
 *
 * Order matters: accuracy is checked first, then range.
 */
export function checkLocationGate(input: GateInput): GateResult {
  const accuracyM = input.acc;
  const distanceM = haversineMeters(input.roomCenter, {
    lat: input.lat,
    lng: input.lng,
  });

  if (!(accuracyM <= MAX_ACCURACY_M)) {
    return { canWrite: false, reason: "low_accuracy", distanceM, accuracyM };
  }
  if (!(distanceM <= WRITE_RADIUS_M)) {
    return { canWrite: false, reason: "out_of_range", distanceM, accuracyM };
  }
  return { canWrite: true, reason: null, distanceM, accuracyM };
}
