type RuntimeConfig = {
  API_URL?: string;
  WS_URL?: string;
};

declare global {
  interface Window {
    __KANG_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

const DEFAULT_API_URL = "http://localhost:3001";
const WS_ROUTE = "/ws";

function pickFirst(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__KANG_RUNTIME_CONFIG__ ?? {};
}

function normalizeTreatyBaseUrl(rawUrl: string): string {
  if (!/^(https?|wss?):\/\//.test(rawUrl)) {
    return rawUrl.replace(/\/+$/, "");
  }

  const url = new URL(rawUrl);

  if (url.protocol === "ws:") {
    url.protocol = "http:";
  } else if (url.protocol === "wss:") {
    url.protocol = "https:";
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  const basePath = pathname === WS_ROUTE ? "" : pathname;

  return `${url.origin}${basePath}`;
}

export function getApiBaseUrl(): string {
  const runtimeConfig = getRuntimeConfig();

  return (
    pickFirst(runtimeConfig.API_URL, import.meta.env.VITE_API_URL) ??
    DEFAULT_API_URL
  );
}

export function getWsBaseUrl(): string {
  const runtimeConfig = getRuntimeConfig();
  const rawUrl =
    pickFirst(
      runtimeConfig.WS_URL,
      runtimeConfig.API_URL,
      import.meta.env.VITE_WS_URL,
      import.meta.env.VITE_API_URL,
    ) ?? DEFAULT_API_URL;

  return normalizeTreatyBaseUrl(rawUrl);
}
