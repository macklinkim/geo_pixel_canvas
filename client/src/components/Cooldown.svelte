<script lang="ts">
  import { COOLDOWN_MS } from "@shared/constants";

  let { until }: { until: number } = $props();

  let now = $state(Date.now());

  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 100);
    return () => clearInterval(id);
  });

  let remaining = $derived(Math.max(0, until - now));
  let pct = $derived(Math.min(100, (remaining / COOLDOWN_MS) * 100));
</script>

{#if remaining > 0}
  <div class="cooldown" aria-live="polite">
    <div class="track"><div class="fill" style:width={`${pct}%`}></div></div>
    <span class="label">{(remaining / 1000).toFixed(1)}s</span>
  </div>
{/if}

<style>
  .cooldown {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  .track {
    flex: 1;
    height: 6px;
    background: var(--surface-2);
    border-radius: 3px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--warn);
    transition: width 0.1s linear;
  }
  .label {
    font-variant-numeric: tabular-nums;
    color: var(--text-dim);
    font-size: 12px;
    min-width: 32px;
    text-align: right;
  }
</style>
