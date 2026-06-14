<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { X, Users, Pencil, Stamp, Check } from "lucide-svelte";
  import PixelBoard from "./PixelBoard.svelte";
  import Palette from "./Palette.svelte";
  import MiniMap from "./MiniMap.svelte";
  import PermissionBanner from "./PermissionBanner.svelte";
  import Turnstile from "./Turnstile.svelte";
  import { app } from "../lib/state/appState.svelte";
  import { room } from "../lib/state/roomState.svelte";
  import { RoomConnection } from "../lib/ws/reconnect";
  import { decodeSnapshot } from "@shared/snapshot";
  import { BOARD_W, BOARD_H } from "@shared/constants";
  import { STAMPS, getStamp } from "../lib/board/stamps";
  import type { ServerMsg } from "@shared/protocol";
  import {
    getCurrentPosition,
    watchPosition,
    type Position,
  } from "../lib/geo/browserLocation";

  let { roomId }: { roomId: string } = $props();

  type BoardApi = {
    applySnapshot: (b: Uint8Array) => void;
    applyPixel: (x: number, y: number, color: number) => void;
  };

  let boardRef = $state<BoardApi>();
  let conn: RoomConnection | null = null;
  let stopWatch: (() => void) | null = null;

  // The last write, so we can replay it with a Turnstile token if the server
  // asks for human verification (entry-gate session expired/absent).
  let pendingWrite: ((token?: string) => void) | null = null;

  onMount(() => {
    room.reset();
    // If the room was opened "at my location", seed the position so painting
    // works immediately (and keep tracking) instead of requiring a re-grant.
    if (app.pendingPosition) {
      room.lastPosition = app.pendingPosition;
      room.locStatus = "ok";
      app.pendingPosition = null;
      startWatch();
    }
    conn = new RoomConnection(roomId, () => room.lastPosition, {
      onStatus: (s) => (room.status = s),
      onMessage: handleMessage,
    });
    conn.open();
  });

  onDestroy(() => {
    stopWatch?.();
    stopWatch = null;
    conn?.close();
    conn = null;
  });

  function handleMessage(msg: ServerMsg): void {
    switch (msg.t) {
      case "snapshot":
        room.canWrite = msg.canWrite;
        room.online = msg.online;
        room.cooldownUntil = Date.now() + msg.cooldownMs;
        room.name = msg.name;
        boardRef?.applySnapshot(decodeSnapshot(msg.pixels, msg.w * msg.h));
        break;
      case "meta":
        room.name = msg.name;
        break;
      case "pixel":
        boardRef?.applyPixel(msg.x, msg.y, msg.color);
        break;
      case "ack":
        if (msg.ok) {
          room.lastAck = "ok";
          room.needHuman = false;
          room.humanError = null;
          pendingWrite = null;
          if (msg.cooldownMs) room.cooldownUntil = Date.now() + msg.cooldownMs;
        } else {
          room.lastAck = msg.reason ?? null;
          if (msg.reason === "human_required") {
            room.needHuman = true;
          } else if (msg.reason === "turnstile_failed") {
            room.needHuman = true;
            room.humanError = "확인에 실패했어요. 다시 시도해 주세요.";
          } else if (msg.reason === "low_accuracy") {
            room.locStatus = "low_accuracy";
          } else if (msg.reason === "out_of_range") {
            room.locStatus = "out_of_range";
          }
          if (msg.cooldownMs) room.cooldownUntil = Date.now() + msg.cooldownMs;
        }
        break;
      case "presence":
        room.online = msg.online;
        break;
      case "pong":
        break;
    }
  }

  function enableLocation(): void {
    room.locStatus = "locating";
    getCurrentPosition()
      .then((p: Position) => {
        room.lastPosition = p;
        room.locStatus = "ok";
        conn?.sendJoin(); // refresh canWrite with a real position
        startWatch();
      })
      .catch((e: GeolocationPositionError) => {
        room.locStatus = e?.code === 1 ? "denied" : "error";
      });
  }

  function startWatch(): void {
    if (stopWatch) return;
    stopWatch = watchPosition(
      (p) => (room.lastPosition = p),
      (e) => {
        if (e.code === 1) room.locStatus = "denied";
      },
    );
  }

  function handlePaint(x: number, y: number): void {
    if (room.needHuman) return; // waiting on human verification
    if (!room.canWrite) {
      enableLocation();
      return;
    }
    if (room.cooldownUntil > Date.now()) return;
    const p = room.lastPosition;
    if (!p) {
      enableLocation();
      return;
    }

    if (room.selectedTool === "stamp") {
      const cells = getStamp(room.selectedStamp)
        .build(room.selectedColor)
        .map((o) => ({ x: x + o.dx, y: y + o.dy, color: o.color }))
        .filter((c) => c.x >= 0 && c.x < BOARD_W && c.y >= 0 && c.y < BOARD_H);
      if (!cells.length) return;
      pendingWrite = (token) => conn?.stamp(cells, p, token);
    } else {
      pendingWrite = (token) => conn?.paint(x, y, room.selectedColor, p, token);
    }
    pendingWrite(); // send without a token; server uses the session cookie if present
  }

  // Inline verification succeeded → replay the original write with the token.
  function onHumanToken(token: string): void {
    room.humanError = null;
    room.needHuman = false;
    const pw = pendingWrite;
    if (pw) pw(token);
  }

  function close(): void {
    app.closeRoom();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") close();
  }

  let canDraw = $derived(room.canWrite && room.status === "open");
  let title = $derived(room.name ?? app.knownRoom(roomId)?.name ?? `Cell ${roomId}`);

  let editing = $state(false);
  let draft = $state("");

  function startEdit(): void {
    draft = room.name ?? "";
    editing = true;
  }
  function saveEdit(): void {
    const n = draft.trim();
    const p = room.lastPosition;
    if (n && p) {
      pendingWrite = (token) => conn?.rename(n, p, token);
      pendingWrite();
      room.name = n; // optimistic; server also broadcasts meta
    }
    editing = false;
  }
  function onNameKey(e: KeyboardEvent): void {
    if (e.key === "Enter") saveEdit();
    else if (e.key === "Escape") {
      e.stopPropagation();
      editing = false;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<!-- Centered modal over the map -->
<div class="backdrop" onclick={close} role="presentation"></div>

<div class="modal" role="dialog" aria-modal="true" aria-label="픽셀 보드 방">
  <header class="head">
    <div class="title">
      {#if editing}
        <input
          class="name-input"
          bind:value={draft}
          maxlength="40"
          onkeydown={onNameKey}
          aria-label="방 이름"
          placeholder="방 이름"
        />
        <button class="btn btn-icon" onclick={saveEdit} aria-label="이름 저장"><Check size={16} /></button>
      {:else}
        <span class="name">{title}</span>
        {#if canDraw}
          <button class="btn btn-icon edit" onclick={startEdit} aria-label="이름 수정" title="이름 수정">
            <Pencil size={14} />
          </button>
        {/if}
      {/if}
      <span class="online"><Users size={14} /> {room.online}</span>
    </div>
    <button class="btn btn-icon" onclick={close} aria-label="방 닫기"><X size={18} /></button>
  </header>

  <PermissionBanner
    locStatus={room.locStatus}
    connStatus={room.status}
    canWrite={room.canWrite}
    onEnable={enableLocation}
  />

  {#if room.needHuman && app.turnstileSiteKey}
    <div class="human" role="status">
      <span class="human-text">사람 확인 후 그릴 수 있어요.</span>
      <Turnstile
        siteKey={app.turnstileSiteKey}
        onToken={onHumanToken}
        onError={() => (room.humanError = "확인을 불러오지 못했어요.")}
      />
      {#if room.humanError}<span class="err">{room.humanError}</span>{/if}
    </div>
  {/if}

  <div class="board-area">
    <PixelBoard
      bind:this={boardRef}
      onpaint={handlePaint}
      disabled={!canDraw}
      tool={room.selectedTool}
    />
  </div>

  <div class="bottom-bar">
    <MiniMap />
    <div class="right-controls">
      <div class="tools" role="group" aria-label="도구">
        <button
          class="btn btn-icon"
          class:active={room.selectedTool === "pen"}
          onclick={() => (room.selectedTool = "pen")}
          aria-label="펜"
          title="펜"
        >
          <Pencil size={16} />
        </button>
        <button
          class="btn btn-icon"
          class:active={room.selectedTool === "stamp"}
          onclick={() => (room.selectedTool = "stamp")}
          aria-label="도장"
          title="도장"
        >
          <Stamp size={16} />
        </button>
      </div>

      {#if room.selectedTool === "stamp"}
        <div class="stamps" role="group" aria-label="도장 선택">
          {#each STAMPS as s (s.key)}
            <button
              class="stamp-btn"
              class:active={room.selectedStamp === s.key}
              onclick={() => (room.selectedStamp = s.key)}
              title={s.name}
              aria-label={s.name}
            >{s.label}</button>
          {/each}
        </div>
      {/if}

      <Palette selected={room.selectedColor} onselect={(c) => (room.selectedColor = c)} />
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: rgba(4, 6, 10, 0.62);
    backdrop-filter: blur(2px);
  }
  .modal {
    position: fixed;
    z-index: 21;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(96vw, 900px);
    max-height: 94dvh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow);
    padding: 14px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    font-size: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name-input {
    font: inherit;
    font-weight: 600;
    font-size: 15px;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 4px 8px;
    max-width: 220px;
  }
  .edit {
    color: var(--text-dim);
  }
  .online {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-dim);
    font-size: 13px;
  }
  .board-area {
    display: flex;
    justify-content: center;
  }
  .human {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 1px solid rgba(79, 140, 255, 0.4);
    border-radius: var(--radius);
    background: var(--surface-2);
  }
  .human-text {
    font-size: 13px;
    color: var(--text-dim);
  }
  .human .err {
    font-size: 12px;
    color: var(--danger);
  }
  /* Bottom controls: minimap on the left, tools + palette on the right.
     Compact, single-row scroll strips keep the modal height minimal. */
  .bottom-bar {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .right-controls {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
  }
  .tools {
    display: flex;
    gap: 6px;
    align-self: flex-end;
  }
  .stamps {
    display: flex;
    gap: 4px;
    max-width: 100%;
    overflow-x: auto;
    padding-bottom: 2px;
  }
  .stamp-btn {
    flex: none;
    width: 28px;
    height: 28px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 6px;
    font-size: 15px;
    line-height: 1;
    padding: 0;
  }
  .stamp-btn.active {
    border-color: var(--accent);
    background: #1a2236;
  }
  .btn.active {
    border-color: var(--accent);
    color: var(--accent);
    background: #1a2236;
  }
</style>
