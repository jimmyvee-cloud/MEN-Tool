/** Internal path only — blocks open redirects and auth pages. */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    return null;
  }
  if (!s.startsWith("/") || s.startsWith("//")) return null;
  if (s.includes("://")) return null;
  const pathOnly = s.split("?")[0].split("#")[0];
  if (pathOnly === "/login" || pathOnly === "/register") return null;
  return s;
}
