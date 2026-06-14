<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { MapController, type Bbox } from "../lib/map/mapController";
  import { RoomLayer } from "../lib/map/roomLayer";
  import { app } from "../lib/state/appState.svelte";
  import { encodeGeohash } from "@shared/geo/geohash";
  import { GEOHASH_PRECISION } from "@shared/constants";
  import type { RoomMeta } from "@shared/room";
  import { getCurrentPosition } from "../lib/geo/browserLocation";
  import { LocateFixed, Layers, Search, Map as MapIcon, Brush } from "lucide-svelte";

  let container: HTMLDivElement;
  let controller: MapController | null = null;
  let layer: RoomLayer | null = null;
  let reqSeq = 0;

  let satellite = $state(false);
  let query = $state("");
  let searching = $state(false);
  let searchError = $state(false);

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

  function toggleSatellite(): void {
    satellite = controller?.toggleSatellite() ?? false;
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

  onMount(() => {
    controller = new MapController(container, app.mapStyleUrl, {
      onMoveEnd: (b) => fetchRooms(b),
      onMapClick: (lat, lng) => app.openRoom(encodeGeohash(lat, lng, GEOHASH_PRECISION)),
    });
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
  <button class="btn" onclick={toggleSatellite} aria-pressed={satellite}>
    {#if satellite}<MapIcon size={16} /> 지도{:else}<Layers size={16} /> 항공{/if}
  </button>
  <button class="btn" onclick={() => controller?.locate()}>
    <LocateFixed size={16} /> 내 위치로
  </button>
  <button class="btn primary" onclick={drawHere} disabled={locating}>
    <Brush size={16} /> 내 위치에 그리기
  </button>
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
    gap: 8px;
  }
  .map-controls .btn {
    box-shadow: var(--shadow);
    background: var(--surface);
  }
  .map-controls .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    font-weight: 600;
  }
</style>
