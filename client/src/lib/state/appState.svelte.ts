import type { RoomMeta } from "@shared/room";

/** localStorage key: once set, returning visitors skip the landing screen. */
const SEEN_LANDING_KEY = "gpb:seenLanding";

function hasSeenLanding(): boolean {
  try {
    return localStorage.getItem(SEEN_LANDING_KEY) === "1";
  } catch {
    return false;
  }
}

// Global, map-level app state (Svelte 5 runes).
class AppState {
  rooms = $state<RoomMeta[]>([]);
  roomsError = $state(false);
  selectedRoom = $state<string | null>(null);
  mapStyleUrl = $state<string | null>(null);

  // Turnstile entry-gate config (from /api/config).
  turnstileEnabled = $state(false);
  turnstileSiteKey = $state<string | null>(null);

  /** Position handed to the next opened room so it can paint immediately. */
  pendingPosition: { lat: number; lng: number; acc: number } | null = null;
  /** First-run onboarding overlay; dismissed via enterApp(). */
  showLanding = $state(!hasSeenLanding());

  /** Leave the landing screen for the map; remembers the choice by default. */
  enterApp(remember = true) {
    this.showLanding = false;
    if (remember) {
      try {
        localStorage.setItem(SEEN_LANDING_KEY, "1");
      } catch {
        // private mode / storage disabled — landing simply shows again next visit
      }
    }
  }

  /** Re-open the landing screen from a header/menu action. */
  openLanding() {
    this.showLanding = true;
  }

  setRooms(rooms: RoomMeta[]) {
    this.rooms = rooms;
    this.roomsError = false;
  }

  openRoom(geohash: string) {
    this.selectedRoom = geohash;
  }

  /** Open the room for a known position, pre-seeding it so writing works at once. */
  openRoomAt(geohash: string, pos: { lat: number; lng: number; acc: number }) {
    this.pendingPosition = pos;
    this.selectedRoom = geohash;
  }

  closeRoom() {
    this.selectedRoom = null;
  }

  knownRoom(geohash: string): RoomMeta | undefined {
    return this.rooms.find((r) => r.geohash === geohash);
  }
}

export const app = new AppState();
