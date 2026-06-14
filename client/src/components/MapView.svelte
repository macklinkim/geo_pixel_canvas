<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { MapController, type Bbox } from "../lib/map/mapController";
  import { RoomLayer } from "../lib/map/roomLayer";
  import { app } from "../lib/state/appState.svelte";
  import { encodeGeohash } from "@shared/geo/geohash";
  import { GEOHASH_PRECISION } from "@shared/constants";
  import type { RoomMeta } from "@shared/room";
  import { getCurrentPosition } from "../lib/geo/browserLocation";
  import { BASEMAPS, DEFAULT_BASEMAP, type BaseMapId } from "../lib/map/mapStyle";
  import { LocateFixed, Layers, Search, Brush, Images } from "lucide-svelte";

  let container: HTMLDivElement;
  let controller: MapController | null = null;
  let layer: RoomLayer | null = null;
  let reqSeq = 0;

  let baseMap = $state<BaseMapId>(DEFAULT_BASEMAP);
  let query = $state("");
  let searching = $state(false);
  let searchError = $state(false);

  // "최근 그림" discovery overlay.
  let recentOpen = $state(false);
  let recentRooms = $state<RoomMeta[]>([]);
  let recentLoading = $state(false);
  let recentError = $state(false);
  let recentWrap = $state<HTMLDivElement | null>(null);

  async function fetchRooms(b: Bbox): Promise<void> {
    const seq = ++reqSeq;
    const url = `/api/rooms?minLat=${b.minLat}&minLng=${b.minLng}&maxLat=${b.maxLat}&maxLng=${b.maxLng}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        app.roomsError = true;
        return;
      }
      const data = (await res.json()) as { rooms: RoomMeta[] };
      if (seq !== reqSeq) return; // a newer bbox request superseded this one
      app.setRooms(data.rooms ?? []);
    } catch {
      app.roomsError = true;
    }
  }

  async function search(e: Event): Promise<void> {
    e.preventDefault();
    const q = query.trim();
    if (!q || searching) return;
    searching = true;
    searchError = false;
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { result: { lat: number; lng: number } | null };
      if (data.result) {
        controller?.flyTo(data.result.lat, data.result.lng, 17);
      } else {
        searchError = true;
      }
    } catch {
      searchError = true;
    } finally {
      searching = false;
    }
  }

  function selectBaseMap(id: BaseMapId): void {
    baseMap = id;
    controller?.setBaseMap(id);
  }

  let locating = $state(false);

  // Open the board for the user's *own* cell, pre-seeding the position so they
  // can paint right away (no separate permission re-grant).
  async function drawHere(): Promise<void> {
    if (locating) return;
    locating = true;
    try {
      const p = await getCurrentPosition();
      controller?.flyTo(p.lat, p.lng, 18);
      app.openRoomAt(encodeGeohash(p.lat, p.lng, GEOHASH_PRECISION), p);
    } catch {
      // permission denied / unavailable — user can still browse
    } finally {
      locating = false;
    }
  }

  // ---- Recent drawings overlay ----
  async function fetchRecent(): Promise<void> {
    recentLoading = true;
    recentError = false;
    try {
      const res = await fetch("/api/rooms/recent?limit=5");
      if (!res.ok) {
        recentError = true;
        return;
      }
      const data = (await res.json()) as { rooms: RoomMeta[] };
      recentRooms = data.rooms ?? [];
    } catch {
      recentError = true;
    } finally {
      recentLoading = false;
    }
  }

  function toggleRecent(): void {
    recentOpen = !recentOpen;
    if (recentOpen) fetchRecent();
  }

  // Fly to the picked drawing and open its board in view mode.
  function openRecent(room: RoomMeta): void {
    recentOpen = false;
    controller?.flyTo(room.centerLat, room.centerLng, 18);
    app.openRoom(room.geohash);
  }

  function timeAgo(ts: number): string {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return "방금 전";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  }

  // Close the overlay on outside click or Escape.
  $effect(() => {
    if (!recentOpen) return;
    const onDown = (e: PointerEvent) => {
      if (recentWrap && !recentWrap.contains(e.target as Node)) recentOpen = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") recentOpen = false;
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  });

  onMount(() => {
    controller = new MapController(container, app.mapStyleUrl, {
      onMoveEnd: (b) => fetchRooms(b),
      onMapClick: (lat, lng) => app.openRoom(encodeGeohash(lat, lng, GEOHASH_PRECISION)),
    });
    // Reflect the persisted choice (defaults to aerial) in the selector.
    baseMap = controller.baseMap;
    layer = new RoomLayer(controller.map, (gh) => app.openRoom(gh));
  });

  // Re-render pins whenever the room list changes.
  $effect(() => {
    const rooms = app.rooms;
    layer?.update(rooms);
  });

  onDestroy(() => {
    layer?.destroy();
    controller?.destroy();
  });
</script>

<div class="map" bind:this={container}></div>

<!-- Address search (top center) -->
<form class="search" onsubmit={search} class:error={searchError}>
  <Search size={16} class="search-ic" />
  <input
    type="text"
    bind:value={query}
    placeholder="주소·장소 검색"
    aria-label="주소 또는 장소 검색"
    oninput={() => (searchError = false)}
  />
  <button class="btn search-go" type="submit" disabled={searching}>이동</button>
</form>

<div class="map-controls">
  <div class="basemap-switch" role="group" aria-label="지도 종류">
    <Layers size={15} class="basemap-ic" />
    {#each BASEMAPS as bm (bm.id)}
      <button
        class="basemap-opt"
        class:active={baseMap === bm.id}
        aria-pressed={baseMap === bm.id}
        onclick={() => selectBaseMap(bm.id)}
      >
        {bm.label}
      </button>
    {/each}
  </div>
  <button class="btn" onclick={() => controller?.locate()}>
    <LocateFixed size={16} /> 내 위치로
  </button>
  <button class="btn primary" onclick={drawHere} disabled={locating}>
    <Brush size={16} /> 내 위치에 그리기
  </button>

  <div class="recent-wrap" bind:this={recentWrap}>
    {#if recentOpen}
      <div class="recent-panel" role="dialog" aria-label="최근 생성된 그림">
        <div class="recent-head">최근 생성된 그림</div>
        {#if recentLoading}
          <p class="recent-msg">불러오는 중…</p>
        {:else if recentError}
          <p class="recent-msg">
            불러오지 못했어요.
            <button class="recent-retry" onclick={fetchRecent}>다시 시도</button>
          </p>
        {:else if recentRooms.length === 0}
          <p class="recent-msg">아직 그림이 없어요.</p>
        {:else}
          <ul class="recent-list">
            {#each recentRooms as room (room.geohash)}
              <li>
                <button class="recent-item" onclick={() => openRecent(room)}>
                  <span class="recent-name">{room.name ?? `근처 그림 #${room.geohash}`}</span>
                  <span class="recent-meta">
                    {room.pixelCount.toLocaleString()} 픽셀 · {timeAgo(room.lastDrawnAt)}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
    <button class="btn" onclick={toggleRecent} aria-expanded={recentOpen}>
      <Images size={16} /> 최근 그림
    </button>
  </div>
</div>

<style>
  .map {
    position: absolute;
    inset: 0;
  }
  .search {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 6px 8px 6px 10px;
    box-shadow: var(--shadow);
    width: min(90vw, 420px);
  }
  .search.error {
    border-color: var(--danger);
  }
  .search :global(.search-ic) {
    color: var(--text-dim);
    flex: none;
  }
  .search input {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font: inherit;
  }
  .search-go {
    flex: none;
    padding: 6px 12px;
  }
  .map-controls {
    position: absolute;
    left: 12px;
    bottom: 28px;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px;
    /* Shrink-wrap to the buttons, but wrap instead of overflowing on mobile. */
    max-width: calc(100vw - 24px);
  }
  .map-controls .btn {
    box-shadow: var(--shadow);
    background: var(--surface);
  }
  .basemap-switch {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px 4px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
  }
  .basemap-switch :global(.basemap-ic) {
    color: var(--text-dim);
    flex: none;
    margin-right: 4px;
  }
  .basemap-opt {
    border: none;
    background: none;
    color: var(--text-dim);
    font-size: 13px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 7px;
    transition: background 0.12s ease, color 0.12s ease;
  }
  .basemap-opt:hover {
    color: var(--text);
  }
  .basemap-opt.active {
    background: var(--accent);
    color: #fff;
  }
  .map-controls .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    font-weight: 600;
  }

  /* ---- recent drawings overlay ---- */
  .recent-wrap {
    position: relative;
    display: inline-flex;
  }
  .recent-panel {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    width: min(78vw, 300px);
    max-height: min(60vh, 360px);
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 8px;
  }
  .recent-head {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 4px 6px 8px;
  }
  .recent-msg {
    margin: 0;
    padding: 8px 6px 10px;
    font-size: 13px;
    color: var(--text-dim);
  }
  .recent-retry {
    background: none;
    border: none;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    padding: 0 2px;
    text-decoration: underline;
  }
  .recent-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .recent-item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    background: none;
    border: none;
    border-radius: 8px;
    padding: 8px 8px;
    color: var(--text);
    transition: background 0.12s ease;
  }
  .recent-item:hover {
    background: var(--surface-2);
  }
  .recent-name {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .recent-meta {
    font-size: 12px;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
</style>
