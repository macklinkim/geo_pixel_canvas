import { ServerMsg, type ClientMsg, type ServerMsg as ServerMsgT } from "@shared/protocol";

export interface SocketHandlers {
  onOpen?: () => void;
  onClose?: (code: number) => void;
  onError?: () => void;
  onMessage: (msg: ServerMsgT) => void;
}

/** Low-level room WebSocket: connect, validated receive, typed send. */
export class RoomSocket {
  private ws: WebSocket | null = null;

  constructor(
    private readonly roomId: string,
    private readonly handlers: SocketHandlers,
  ) {}

  connect(): void {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/${this.roomId}`);
    this.ws = ws;

    ws.onopen = () => this.handlers.onOpen?.();
    ws.onclose = (e) => this.handlers.onClose?.(e.code);
    ws.onerror = () => this.handlers.onError?.();
    ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      let raw: unknown;
      try {
        raw = JSON.parse(e.data);
      } catch {
        return;
      }
      const parsed = ServerMsg.safeParse(raw);
      if (parsed.success) this.handlers.onMessage(parsed.data);
    };
  }

  send(msg: ClientMsg): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}
