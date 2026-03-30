import { enqueueOutbox, flushOutbox, outboxCount } from "./offlineQueue";

/** API origin (no trailing /v1). Paths passed to apiFetch always start with /v1. */
export function getApiOrigin() {
  const raw = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
  return raw.replace(/\/v1$/i, "");
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
