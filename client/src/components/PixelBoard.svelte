<script lang="ts">
  import { onMount } from "svelte";
  import { ZoomIn, ZoomOut, Move } from "lucide-svelte";
  import { BoardRenderer } from "../lib/board/boardRenderer";
  import { pointerToCell } from "../lib/board/boardMath";
  import { BOARD_W, BOARD_H } from "@shared/constants";
  import { boardView } from "../lib/state/boardView.svelte";

  let {
    onpaint,
    disabled = false,
    tool = "pen",
  }: {
    onpaint: (x: number, y: number) => void;
    disabled?: boolean;
    tool?: "pen" | "stamp";
  } = $props();

  const DRAG_THRESHOLD = 9; // px movement that turns a tap into a pan (touch-friendly)

  // --- Custom cursors: one per interaction, built as data URIs at runtime so
  // encoding is always correct. Each has a native fallback keyword. ---
  const PAINT_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><g fill='none' stroke='#ffffff' stroke-width='3.5' stroke-linecap='round'><rect x='8.5' y='8.5' width='7' height='7'/><path d='M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4'/></g><g fill='none' stroke='#1b4fd6' stroke-width='1.6' stroke-linecap='round'><rect x='8.5' y='8.5' width='7' height='7'/><path d='M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4'/></g><rect x='11' y='11' width='2' height='2' fill='#1b4fd6'/></svg>`;
  const STAMP_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><g stroke='#ffffff' stroke-width='3.2' stroke-linejoin='round' fill='#ffffff'><path d='M6 17 L8 9 H16 L18 17 Z'/><rect x='4' y='18.5' width='16' height='3' rx='1'/><rect x='9.5' y='3' width='5' height='6' rx='1.5'/></g><g stroke='#1b4fd6' stroke-width='1.4' stroke-linejoin='round' fill='#4f8cff'><path d='M6 17 L8 9 H16 L18 17 Z'/><rect x='4' y='18.5' width='16' height='3' rx='1'/><rect x='9.5' y='3' width='5' height='6' rx='1.5'/></g></svg>`;
  const MOVE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><g fill='none' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round' stroke='#ffffff'><path d='M12 2v20M2 12h20'/><path d='M12 2 9 5M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3'/></g><g fill='none' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' stroke='#0b0d12'><path d='M12 2v20M2 12h20'/><path d='M12 2 9 5M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3'/></g></svg>`;

  const cur = (svg: string, hx: number, hy: number, fallback: string) =>
    `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hx} ${hy}, ${fallback}`;
  const paintCursor = cur(PAINT_SVG, 12, 12, "crosshair");
  const stampCursor = cur(STAMP_SVG, 12, 20, "copy");
  const moveCursor = cur(MOVE_SVG, 12, 12, "move");

  let canvas: HTMLCanvasElement;
  let renderer: BoardRenderer | null = null;

  // Local viewport dims (bound), mirrored into the shared store.
  let vpW = $state(0);
  let vpH = $state(0);

  let dragging = $state(false);
  let down = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;

  let cursor = $derived(
    dragging || disabled
      ? moveCursor
      : tool === "stamp"
        ? stampCursor
        : paintCursor,
  );

  $effect(() => {
    boardView.vpW = vpW;
    boardView.vpH = vpH;
    boardView.clampPan();
  });

  const zoomIn = () => boardView.setZoom(boardView.zoom * 1.5);
  const zoomOut = () => boardView.setZoom(boardView.zoom / 1.5);
  const zoomReset = () => boardView.reset();

  onMount(() => {
    renderer = new BoardRenderer(canvas);
    boardView.reset();
    boardView.mainCanvas = canvas;
  });

  // Exposed to the parent via bind:this — the imperative renderer bridge.
  export function applySnapshot(bytes: Uint8Array): void {
    renderer?.setSnapshot(bytes);
    boardView.rev++;
  }
  export function applyPixel(x: number, y: number, color: number): void {
    renderer?.setPixel(x, y, color);
    boardView.rev++;
  }

  function onPointerDown(e: PointerEvent): void {
    down = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = boardView.panX;
    startPanY = boardView.panY;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic / already-released pointer */
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!down) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      moved = true;
      dragging = true;
    }
    if (moved) {
      boardView.panX = startPanX + dx;
      boardView.panY = startPanY + dy;
      boardView.clampPan();
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!down) return;
    down = false;
    dragging = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    // A tap (no drag) paints the cell under the pointer.
    if (!moved && !disabled) {
      const hit = pointerToCell(canvas.getBoundingClientRect(), e.clientX, e.clientY);
      if (hit) onpaint(hit.x, hit.y);
    }
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    boardView.setZoom(boardView.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }
</script>

<div class="board-wrap">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="viewport"
    style:cursor={cursor}
    bind:clientWidth={vpW}
    bind:clientHeight={vpH}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onwheel={onWheel}
  >
    <!-- Pan via translate only (no transform scale, which would blur the pixels).
         Zoom changes the canvas display size so image-rendering:pixelated stays crisp. -->
    <div
      class="pan-layer"
      style:transform={`translate(${boardView.panX}px, ${boardView.panY}px)`}
    >
      <div
        class="board-frame"
        style:width={`${boardView.baseW * boardView.zoom}px`}
        style:aspect-ratio={`${BOARD_W} / ${BOARD_H}`}
      >
        <canvas
          bind:this={canvas}
          class="board"
          aria-label={`픽셀 보드 ${BOARD_W}x${BOARD_H}. 드래그로 이동, 휠/버튼으로 확대, 칸을 눌러 그립니다.`}
        ></canvas>
        <div
          class="grid"
          aria-hidden="true"
          style:background-size={`${100 / BOARD_W}% ${100 / BOARD_H}%`}
        ></div>
      </div>
    </div>
  </div>

  <div class="zoom-controls">
    <span class="hint"><Move size={13} /> 드래그로 이동</span>
    <button
      class="btn btn-icon"
      onclick={zoomOut}
      disabled={boardView.zoom <= boardView.minZoom}
      aria-label="축소"
    >
      <ZoomOut size={16} />
    </button>
    <button class="btn zoom-label" onclick={zoomReset} aria-label="원래 크기">
      {Math.round(boardView.zoom * 100)}%
    </button>
    <button
      class="btn btn-icon"
      onclick={zoomIn}
      disabled={boardView.zoom >= boardView.maxZoom}
      aria-label="확대"
    >
      <ZoomIn size={16} />
    </button>
  </div>
</div>

<style>
  .board-wrap {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  /* Pan/zoom viewport — no scrollbars; move only via drag + zoom. */
  .viewport {
    position: relative;
    width: 100%;
    height: 56vh;
    overflow: hidden;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
  }
  .pan-layer {
    transform-origin: center center;
    will-change: transform;
    display: flex;
  }
  .board-frame {
    position: relative;
    border-radius: 4px;
    border: 1px solid var(--border);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.06),
      0 8px 24px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    background: #ffffff;
  }
  .board {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    pointer-events: none; /* taps handled on the viewport */
  }
  .grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(to right, rgba(0, 0, 0, 0.06) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
  }
  .zoom-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .hint {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-dim);
    font-size: 12px;
    margin-right: 6px;
  }
  .zoom-label {
    min-width: 56px;
    justify-content: center;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
  }
</style>
