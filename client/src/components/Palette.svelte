<script lang="ts">
  import { PALETTE } from "@shared/palette";

  let { selected, onselect }: { selected: number; onselect: (color: number) => void } =
    $props();
</script>

<div class="palette" role="listbox" aria-label="색 팔레트">
  {#each PALETTE as color, i (i)}
    <button
      class="swatch"
      class:active={selected === i}
      style:background={color}
      role="option"
      aria-selected={selected === i}
      aria-label={`색 ${i}`}
      onclick={() => onselect(i)}
    ></button>
  {/each}
</div>

<style>
  /* Compact 16-col grid → 32 colors in two short rows. */
  .palette {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 4px;
    width: 100%;
    max-width: 360px;
  }
  .swatch {
    aspect-ratio: 1 / 1;
    border-radius: 4px;
    border: 2px solid transparent;
    padding: 0;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
  }
  .swatch.active {
    border-color: var(--text);
    transform: scale(1.12);
  }
</style>
