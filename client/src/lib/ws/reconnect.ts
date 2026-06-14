import { RoomSocket } from "./roomSocket";
import type { ServerMsg } from "@shared/protocol";
import type { Position } from "../geo/browserLocation";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface ConnectionHandlers {
  onStatus: (status: ConnStatus) => void;
  onMessage: (msg: ServerMsg) => void;
}

/**
 * Owns a RoomSocket with auto-reconnect (exponential backoff). On every
 * (re)connect it re-sends `join`, so the client always recovers state from a
 * fresh snapshot rather than trusting stale local data.
 */
export class RoomConnection {
  private socket: RoomSocket | null = null;
  private retry = 0;
  private closedByUser = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly roomId: string,
    private readonly getPosition: () => Position | null,
    private readonly handlers: ConnectionHandlers,
  ) {}

  open(): void {
    this.closedByUser = false;
    this.dial();
  }

  private dial(): void {
    this.handlers.onStatus("connecting");
    this.socket = new RoomSocket(this.roomId, {
      onOpen: () => {
        this.retry = 0;
        this.handlers.onStatus("open");
        this.sendJoin();
      },
      onClose: () => {
        if (this.closedByUser) return;
        this.handlers.onStatus("reconnecting");
        this.scheduleReconnect();
      },
      onError: () => {},
      onMessage: (msg) => this.handlers.onMessage(msg),
    });
    this.socket.connect();
  }

  private scheduleReconnect(): void {
    const delay = Math.min(8000, 500 * 2 ** this.retry);
    this.retry += 1;
    this.timer = setTimeout(() => {
      if (!this.closedByUser) this.dial();
    }, delay);
  }

  /** (Re)send join with the latest position; sentinel accuracy = read-only. */
  sendJoin(): void {
    const p = this.getPosition();
    if (p) {
      this.socket?.send({ t: "join", lat: p.lat, lng: p.lng, acc: p.acc });
    } else {
      this.socket?.send({ t: "join", lat: 0, lng: 0, acc: 9_999_999 });
    }
  }

  stamp(
    cells: { x: number; y: number; color: number }[],
    p: Position,
    token?: string,
  ): boolean {
    return (
      this.socket?.send({ t: "stamp", cells, lat: p.lat, lng: p.lng, acc: p.acc, token }) ?? false
    );
  }

  paint(x: number, y: number, color: number, p: Position, token?: string): boolean {
    return (
      this.socket?.send({
        t: "paint",
        x,
        y,
        color,
        lat: p.lat,
        lng: p.lng,
        acc: p.acc,
        token,
      }) ?? false
    );
  }

  rename(name: string, p: Position, token?: string): boolean {
    return (
      this.socket?.send({ t: "rename", name, lat: p.lat, lng: p.lng, acc: p.acc, token }) ?? false
    );
  }

  ping(): void {
    this.socket?.send({ t: "ping", clientTime: Date.now() });
  }

  close(): void {
    this.closedByUser = true;
    if (this.timer) clearTimeout(this.timer);
    this.socket?.close();
    this.socket = null;
    this.handlers.onStatus("closed");
  }
}
