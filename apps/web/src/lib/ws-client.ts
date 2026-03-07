import type { ServerEvent } from "@/types";

type WebSocketEventHandler = (event: ServerEvent) => void;
type ConnectionStatusHandler = (
  isConnecting: boolean,
  isConnected: boolean,
) => void;
type OpenCallback = () => void;

class WsClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private url: string;

  private onEvent: WebSocketEventHandler | null = null;
  private onConnectionChange: ConnectionStatusHandler | null = null;
  private onOpenCallback: OpenCallback | null = null;

  constructor(url: string) {
    this.url = url;
  }

  setHandlers(
    onEvent: WebSocketEventHandler,
    onConnectionChange: ConnectionStatusHandler,
    onOpenCallback: OpenCallback,
  ) {
    this.onEvent = onEvent;
    this.onConnectionChange = onConnectionChange;
    this.onOpenCallback = onOpenCallback;
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  connect() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.onConnectionChange?.(true, false);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.onConnectionChange?.(false, true);
      this.onOpenCallback?.();
    };

    this.ws.onmessage = (e) => {
      try {
        const event: ServerEvent = JSON.parse(e.data);
        this.onEvent?.(event);
      } catch {
        console.error("Failed to parse server event");
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.onConnectionChange?.(false, false);

      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      // Exponential backoff capped at 30 s
      const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000);
      this.reconnectAttempt++;
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempt = 0;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
    this.onConnectionChange?.(false, false);
  }

  send(data: unknown): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }
}

export const wsClient = new WsClient(
  import.meta.env.VITE_WS_URL ?? "ws://localhost:3001/ws",
);
