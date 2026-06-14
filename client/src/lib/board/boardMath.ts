import { BOARD_W, BOARD_H } from "@shared/constants";

export interface CellHit {
  x: number;
  y: number;
}

/** Map a pointer position (within the canvas client rect) to a board cell. */
export function pointerToCell(rect: DOMRect, clientX: number, clientY: number): CellHit | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;
  if (px < 0 || px >= 1 || py < 0 || py >= 1) return null;
  return {
    x: Math.min(BOARD_W - 1, Math.floor(px * BOARD_W)),
    y: Math.min(BOARD_H - 1, Math.floor(py * BOARD_H)),
  };
}
