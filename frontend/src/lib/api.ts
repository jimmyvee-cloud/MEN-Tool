import { enqueueOutbox, flushOutbox, outboxCount } from "./offlineQueue";

/** API origin (no trailing /v1). Paths passed to apiFetch always start with /v1. */
export function getApiOrigin() {
  let raw = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  let base = raw.replace(/\/v1$/i, "");
  if (
    import.meta.env.DEV &&
    /^https?:\/\/(localhost|127\.0\.0\.1):8001$/i.test(base)
  ) {
    return "";
  }
  return base;
}

const getBase = getApiOrigin;
const getKey = () => import.meta.env.VITE_API_KEY || "";
const getTenant = () => import.meta.env.VITE_TENANT_ID || "mentool";

export function getStoredTokens() {
  return {
    access: localStorage.getItem("access_token") || "",
    refresh: localStorage.getItem("refresh_token") || "",
  };
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

async function refreshAccess(): Promise<string | null> {
  const { refresh } = getStoredTokens();
  if (!refresh) return null;
  const res = await fetch(`${getBase()}/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": getKey(),
      "X-Tenant-Id": getTenant(),
    },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

type Opt = RequestInit & { skipAuth?: boolean };

export async function apiFetch(path: string, init: Opt = {}) {
  const headers: Record<string, string> = {
    "X-API-Key": getKey(),
    "X-Tenant-Id": getTenant(),
    ...(init.headers as Record<string, string>),
  };
  if (!init.skipAuth) {
    let { access } = getStoredTokens();
    if (access) headers["Authorization"] = `Bearer ${access}`;
  }
  const url = `${getBase()}${path.startsWith("/") ? path : `/${path}`}`;
  let res = await fetch(url, { ...init, headers });

  if (res.status === 401 && !init.skipAuth) {
    const newAccess = await refreshAccess();
    if (newAccess) {
      headers["Authorization"] = `Bearer ${newAccess}`;
      res = await fetch(url, { ...init, headers });
    }
  }
  return res;
}

/** True when fetch failed before an HTTP response (offline, wrong host, CORS, etc.). */
export function isLikelyNetworkError(ex: unknown): boolean {
  if (ex instanceof TypeError) return true;
  if (ex instanceof DOMException && ex.name === "NetworkError") return true;
  if (ex instanceof Error) {
    const m = ex.message || "";
    return (
      /networkerror|failed to fetch|load failed|fetch.*aborted/i.test(m) ||
      ex.name === "NetworkError"
    );
  }
  return false;
}

/** Human-readable message from apiJson thrown Error (FastAPI `detail` or raw body). */
export function formatApiError(ex: unknown): string {
  if (!(ex instanceof Error)) return "Something went wrong";
  const raw = ex.message.trim();
  if (!raw) return "Something went wrong";
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    const d = j.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length > 0) {
      const first = d[0] as { msg?: string };
      if (typeof first?.msg === "string") return first.msg;
    }
  } catch {
    /* not JSON */
  }
  return raw;
}

export async function apiJson<T>(path: string, init: Opt = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiPostQueued<T>(
  path: string,
  body: unknown,
  setPending?: (n: number) => void
): Promise<T | void> {
  const headers: Record<string, string> = {
    "X-API-Key": getKey(),
    "X-Tenant-Id": getTenant(),
    "Content-Type": "application/json",
  };
  const { access } = getStoredTokens();
  if (access) headers["Authorization"] = `Bearer ${access}`;
  const url = `${getBase()}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (res.ok) {
      if (setPending) setPending(await outboxCount());
      return (await res.json()) as T;
    }
    throw new Error(await res.text());
  } catch {
    if (!navigator.onLine) {
      await enqueueOutbox("POST", path, body, {
        "X-API-Key": getKey(),
        "X-Tenant-Id": getTenant(),
        Authorization: access ? `Bearer ${access}` : "",
      });
      if (setPending) setPending(await outboxCount());
      return;
    }
    throw new Error("Network error");
  }
}

export { outboxCount, flushOutbox };
