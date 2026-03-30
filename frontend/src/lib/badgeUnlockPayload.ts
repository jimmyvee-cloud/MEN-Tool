export type BadgeUnlockPayload = {
  badge_id: string;
  title?: string;
  unlock_hint?: string;
  artwork_url?: string;
};

export function badgesUnlockedFromResponse(data: unknown): BadgeUnlockPayload[] {
  if (!data || typeof data !== "object") return [];
  const raw = (data as Record<string, unknown>).badges_unlocked;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is BadgeUnlockPayload => Boolean(x) && typeof x === "object");
}
