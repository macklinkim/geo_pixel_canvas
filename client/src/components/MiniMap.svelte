<script lang="ts">
  import { boardView } from "../lib/state/boardView.svelte";

  // Minimap backing resolution (board aspect 3:2).
  const MW = 96;
  const MH = 64;

  let mini: HTMLCanvasElement;

  $effect(() => {
    // Redraw on board change (rev) and on view change (pan/zoom/size).
    void boardView.rev;
    const src = boardView.mainCanvas;
    const ctx = mini?.getContext("2d");
    if (!src || !ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, MW, MH);
    ctx.drawImage(src, 0, 0, MW, MH);

    const { zoom, panX, panY, baseW, baseH, vpW, vpH } = boardView;
    if (baseW > 0 && zoom > 0) {
      const scaledW = baseW * zoom;
      const scaledH = baseH * zoom;
      const fw = Math.min(1, vpW / scaledW);
      const fh = Math.min(1, vpH / scaledH);
      const cx = 0.5 - panX / scaledW;
      const cy = 0.5 - panY / scaledH;
      const rx = (cx - fw / 2) * MW;
      const ry = (cy - fh / 2) * MH;
      ctx.fillStyle = "rgba(79,140,255,0.14)";
      ctx.fillRect(rx, ry, fw * MW, fh * MH);
      ctx.strokeStyle = "rgba(79,140,255,0.95)";
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 0.5, ry + 0.5, Math.max(1, fw * MW - 1), Math.max(1, fh * MH - 1));
    }
  });

  function recenter(clientX: number, clientY: number): void {
    const rect = mini.getBoundingClientRect();
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    const scaledW = boardView.baseW * boardView.zoom;
    const scaledH = boardView.baseH * boardView.zoom;
    boardView.panX = (0.5 - fx) * scaledW;
    boardView.panY = (0.5 - fy) * scaledH;
    boardView.clampPan();
  }
</script>

<button
  class="minimap-btn"
  onclick={(e) => recenter(e.clientX, e.clientY)}
  aria-label="미니맵: 눌러서 보는 위치 이동"
  title="미니맵"
>
  <canvas bind:this={mini} width={MW} height={MH} class="minimap"></canvas>
</button>

<style>
  .minimap-btn {
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: #fff;
    line-height: 0;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }
  .minimap {
    width: 92px;
    aspect-ratio: 3 / 2;
    display: block;
    image-rendering: pixelated;
    border-radius: 5px;
  }
</style>
