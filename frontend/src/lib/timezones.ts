/** IANA zones for profile; labels match common US-friendly names. */
export const PROFILE_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Toronto", label: "Eastern — Toronto" },
  { value: "Europe/London", label: "UK (GMT/BST)" },
  { value: "Asia/Bangkok", label: "Indochine (ICT, UTC+7)" },
  { value: "UTC", label: "UTC" },
];

export function timezoneLabel(iana: string | undefined | null): string {
  const v = (iana || "").trim();
  if (!v) return "";
  const row = PROFILE_TIMEZONES.find((z) => z.value === v);
  return row?.label ?? v;
}
