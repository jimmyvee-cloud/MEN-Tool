import { apiFetch, clearTokens } from "./api";

export async function logout() {
  try {
    await apiFetch("/v1/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  clearTokens();
}
