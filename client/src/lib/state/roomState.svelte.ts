import type { Position } from "../geo/browserLocation";
import type { AckReason } from "@shared/protocol";

export type ConnStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";
export type LocStatus =
  | "idle"
  | "locating"
  | "ok"
  | "low_accuracy"
  | "out_of_range"
  | "denied"
  | "error";

// Per-room session state. Reset whenever a different room is opened.
class RoomState {
  status = $state<ConnStatus>("idle");
  online = $state(0);
  name = $state<string | null>(null);
  canWrite = $state(false);
  cooldownUntil = $state(0);
  selectedColor = $state(5);
  selectedTool = $state<"pen" | "stamp">("pen");
  selectedStamp = $state("smile");
  locStatus = $state<LocStatus>("idle");
  // Inline human-verification fallback (when the entry-gate session expired).
  needHuman = $state(false);
  humanError = $state<string | null>(null);
  lastAck = $state<AckReason | "ok" | null>(null);

  // Latest known position — plain (non-reactive) field, read at paint time only.
  lastPosition: Position | null = null;

  reset() {
    this.status = "idle";
    this.online = 0;
    this.name = null;
    this.canWrite = false;
    this.cooldownUntil = 0;
    this.locStatus = "idle";
    this.lastAck = null;
    this.lastPosition = null;
    this.needHuman = false;
    this.humanError = null;
  }
}

export const room = new RoomState();
