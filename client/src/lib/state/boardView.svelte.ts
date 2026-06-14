import { BOARD_W, BOARD_H } from "@shared/constants";

const ASPECT = BOARD_W / BOARD_H;
const MIN_ZOOM = 1;
const MAX_ZOOM = 12;

// Shared pan/zoom + canvas reference so PixelBoard and MiniMap stay in sync.
class BoardView {
  zoom = $state(1);
  panX = $state(0);
  panY = $state(0);
  vpW = $state(0);
  vpH = $state(0);

  /** Live reference to the main board canvas (for the minimap to sample). */
  mainCanvas = $state<HTMLCanvasElement | null>(null);
  /** Bumped on every pixel/snapshot change to trigger a minimap redraw. */
  rev = $state(0);

  // At zoom 1 the whole board fits inside the viewport (letterboxed).
  baseW = $derived(Math.max(0, Math.min(this.vpW, this.vpH * ASPECT) * 0.98));
  baseH = $derived(this.baseW / ASPECT);

  clampPan(): void {
    const maxX = Math.max(0, (this.baseW * this.zoom - this.vpW) / 2);
    const maxY = Math.max(0, (this.baseH * this.zoom - this.vpH) / 2);
    this.panX = Math.min(maxX, Math.max(-maxX, this.panX));
    this.panY = Math.min(maxY, Math.max(-maxY, this.panY));
  }

  setZoom(next: number): void {
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 100) / 100));
    this.clampPan();
  }

  reset(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  get minZoom(): number {
    return MIN_ZOOM;
  }
  get maxZoom(): number {
    return MAX_ZOOM;
  }
}

export const boardView = new BoardView();
