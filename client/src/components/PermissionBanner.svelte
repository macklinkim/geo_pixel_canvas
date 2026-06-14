<script lang="ts">
  import { MapPin, WifiOff, AlertTriangle, Check } from "lucide-svelte";
  import type { LocStatus, ConnStatus } from "../lib/state/roomState.svelte";

  let {
    locStatus,
    connStatus,
    canWrite,
    onEnable,
  }: {
    locStatus: LocStatus;
    connStatus: ConnStatus;
    canWrite: boolean;
    onEnable: () => void;
  } = $props();

  type Banner = { tone: "ok" | "warn" | "danger" | "info"; text: string; action?: string };

  let banner = $derived.by((): Banner | null => {
    if (connStatus === "reconnecting" || connStatus === "connecting") {
      return { tone: "warn", text: "연결 중… 그리기가 잠시 비활성화됩니다." };
    }
    switch (locStatus) {
      case "denied":
        return { tone: "danger", text: "위치 권한이 거부되어 보기 전용입니다.", action: "다시 시도" };
      case "low_accuracy":
        return { tone: "warn", text: "위치 정확도가 낮아 그릴 수 없습니다.", action: "다시 시도" };
      case "out_of_range":
        return { tone: "warn", text: "이 장소 근처에서만 그릴 수 있습니다." };
      case "error":
        return { tone: "danger", text: "위치를 가져오지 못했습니다.", action: "다시 시도" };
      case "locating":
        return { tone: "info", text: "위치 확인 중…" };
      case "idle":
        return { tone: "info", text: "그리려면 위치 권한이 필요합니다.", action: "위치 허용" };
      case "ok":
        return canWrite ? { tone: "ok", text: "이 장소에서 그릴 수 있어요." } : null;
    }
  });
</script>

{#if banner}
  <div class="banner" class:ok={banner.tone === "ok"} class:warn={banner.tone === "warn"}
       class:danger={banner.tone === "danger"} class:info={banner.tone === "info"} role="status">
    <span class="icon">
      {#if banner.tone === "ok"}<Check size={16} />
      {:else if connStatus === "reconnecting" || connStatus === "connecting"}<WifiOff size={16} />
      {:else if banner.tone === "danger"}<AlertTriangle size={16} />
      {:else}<MapPin size={16} />{/if}
    </span>
    <span class="text">{banner.text}</span>
    {#if banner.action}
      <button class="btn action" onclick={onEnable}>{banner.action}</button>
    {/if}
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface-2);
    font-size: 13px;
  }
  .banner .icon { display: inline-flex; color: var(--text-dim); }
  .banner.ok { border-color: rgba(61, 220, 132, 0.4); }
  .banner.ok .icon { color: var(--ok); }
  .banner.warn { border-color: rgba(255, 205, 117, 0.4); }
  .banner.warn .icon { color: var(--warn); }
  .banner.danger { border-color: rgba(239, 93, 107, 0.45); }
  .banner.danger .icon { color: var(--danger); }
  .text { flex: 1; }
  .action { padding: 4px 10px; white-space: nowrap; }
</style>
