// Board snapshot codec. The board is a flat Uint8Array of length BOARD_AREA,
// each byte a palette index (0..15) or EMPTY (255). We ship it base64-encoded
// inside the snapshot message.

import { BOARD_AREA } from "./constants";

// Provided as globals by both browsers and the Workers runtime.
declare function btoa(data: string): string;
declare function atob(data: string): string;

export function encodeSnapshot(pixels: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < pixels.length; i += chunk) {
    const slice = pixels.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function decodeSnapshot(base64: string, expectedLength = BOARD_AREA): Uint8Array {
  const binary = atob(base64);
  if (binary.length !== expectedLength) {
    throw new Error(
      `snapshot length mismatch: got ${binary.length}, expected ${expectedLength}`,
    );
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
