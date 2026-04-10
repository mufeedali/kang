import { type Treaty, treaty } from "@elysiajs/eden";
import type { ClientIntent, ServerEvent } from "@/types";
import type { WsContractRoutes } from "../../../api/src/contract";

declare global {
  interface Window {
    KANG_API_URL?: string;
  }
}

function resolveApiBase(): string {
  const raw =
    window.KANG_API_URL?.trim() ||
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
    "http://localhost:3001";
  // Normalise wss/ws → https/http so Eden constructs the WebSocket URL itself.
  // Strip any trailing /ws or /wss path segment — Eden appends the route.
  return raw
    .replace(/^wss:\/\//, "https://")
    .replace(/^ws:\/\//, "http://")
    .replace(/\/(wss?)(\/.*)?$/, "")
    .replace(/\/+$/, "");
}

type TreatyApp = Treaty.Sign<WsContractRoutes>;
type WsSub = ReturnType<TreatyApp["ws"]["subscribe"]>;

type WebSocketEventHandler = (event: ServerEvent) => void;
type ConnectionStatusHandler = (
  isConnecting: boolean,
  isConnected: boolean,
) => void;
type OpenCallback = () => void;

class WsClient {
  private sub: WsSub | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private isConnected = false;
  // Set to true during an explicit disconnect() to suppress the automatic
  // reconnection that would otherwise fire from the close handler.
  private disconnecting = false;
  private host: string;

  private onEvent: WebSocketEventHandler | null = null;
  private onConnectionChange: ConnectionStatusHandler | null = null;
  private onOpenCallback: OpenCallback | null = null;

  constructor(host: string) {
    this.host = host;
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
    return this.isConnected;
  }

  connect() {
    // sub !== null means a connection attempt is already in-flight or open.
    if (this.sub !== null) return;

    this.disconnecting = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.onConnectionChange?.(true, false);

    const client = treaty(this.host, {
      parseDate: false,
    }) as unknown as TreatyApp;

    this.sub = client.ws.subscribe();

    const rawWs = this.sub.ws;

    this.sub.subscribe(({ data }) => {
      this.onEvent?.(data);
    });

    rawWs.onopen = () => {
      this.reconnectAttempt = 0;
      this.isConnected = true;
      this.onConnectionChange?.(false, true);
      this.onOpenCallback?.();
    };

    rawWs.onclose = () => {
      this.sub = null;
      this.isConnected = false;
      this.onConnectionChange?.(false, false);

      if (this.disconnecting) return;

      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      // Exponential backoff capped at 30 s
      const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000);
      this.reconnectAttempt++;
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    };

    rawWs.onerror = () => {
      rawWs.close();
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempt = 0;
    this.disconnecting = true;
    if (this.sub) {
      this.sub.close();
    }
    this.sub = null;
    this.isConnected = false;
    this.onConnectionChange?.(false, false);
  }

  send(data: ClientIntent): boolean {
    if (this.isConnected && this.sub) {
      this.sub.send(data);
      return true;
    }
    return false;
  }
}

export const wsClient = new WsClient(resolveApiBase());
