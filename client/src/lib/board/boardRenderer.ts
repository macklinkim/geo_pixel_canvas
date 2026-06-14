import { BOARD_W, BOARD_H, BOARD_AREA, EMPTY } from "@shared/constants";
import { PALETTE } from "@shared/palette";

// Unpainted cells render as white "paper" so the board starts all white.
const BOARD_BG = "#ffffff";

/**
 * Imperative single-canvas renderer. Lives outside Svelte; Svelte owns only
 * UI state and forwards snapshot/pixel updates here.
 *
 * The canvas backing store is exactly BOARD_W x BOARD_H. CSS scales it up with
 * nearest-neighbor (image-rendering: pixelated) so cells stay crisp.
 */
export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private pixels = new Uint8Array(BOARD_AREA).fill(EMPTY);

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = BOARD_W;
    canvas.height = BOARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this.renderAll();
  }

  setSnapshot(pixels: Uint8Array): void {
    this.pixels = pixels.slice(0, BOARD_AREA);
    if (this.pixels.length < BOARD_AREA) {
      const padded = new Uint8Array(BOARD_AREA).fill(EMPTY);
      padded.set(this.pixels);
      this.pixels = padded;
    }
    this.renderAll();
  }

  setPixel(x: number, y: number, color: number): void {
    if (x < 0 || x >= BOARD_W || y < 0 || y >= BOARD_H) return;
    this.pixels[y * BOARD_W + x] = color;
    this.drawCell(x, y, color);
  }

  private drawCell(x: number, y: number, color: number): void {
    if (color === EMPTY) {
      this.ctx.fillStyle = BOARD_BG;
    } else {
      this.ctx.fillStyle = PALETTE[color] ?? BOARD_BG;
    }
    this.ctx.fillRect(x, y, 1, 1);
  }

  private renderAll(): void {
    this.ctx.fillStyle = BOARD_BG;
    this.ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    for (let y = 0; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        const color = this.pixels[y * BOARD_W + x];
        if (color !== undefined && color !== EMPTY) {
          this.drawCell(x, y, color);
        }
      }
    }
  }
}
