/**
 * Achievement art — bundled PNGs from `src/assets/achievements/`.
 * Dynamo `artwork_url` uses `/achievements/<filename>` (see `gamification.default_badge_defs`).
 */
import checkins10 from "@/assets/achievements/10-checkins-unlocked.png?url";
import reliefs10 from "@/assets/achievements/10-reliefs.png?url";
import stressors10 from "@/assets/achievements/10-stressors.png?url";
import recoveryWarrior from "@/assets/achievements/badge-recovery-warrior.png?url";
import stressHunter from "@/assets/achievements/stress-hunter.png?url";
import trending from "@/assets/achievements/trending.png?url";

const ART_BY_PATH: Record<string, string> = {
  "/achievements/10-checkins-unlocked.png": checkins10,
  "/achievements/10-reliefs.png": reliefs10,
  "/achievements/10-stressors.png": stressors10,
  "/achievements/badge-recovery-warrior.png": recoveryWarrior,
  "/achievements/stress-hunter.png": stressHunter,
  "/achievements/trending.png": trending,
  /** Legacy paths → same assets */
  "/achievements/check_in_logger.svg": checkins10,
  "/achievements/stress_tracker.svg": stressors10,
  "/achievements/relief_master.svg": reliefs10,
  "/achievements/trending_up.svg": trending,
  "/achievements/stress_hunter.svg": stressHunter,
  "/achievements/recovery_warrior.svg": recoveryWarrior,
  "/assets/badges/checkin.png": checkins10,
};

export const ART_BY_BADGE_ID: Record<string, string> = {
  badge_checkin_10: checkins10,
  badge_stressor_10: stressors10,
  badge_relief_10: reliefs10,
  badge_trending_up: trending,
  badge_stressor_20: stressHunter,
  badge_relief_20: recoveryWarrior,
};

function withBase(path: string): string {
  const b = import.meta.env.BASE_URL;
  const clean = path.startsWith("/") ? path.slice(1) : path;
  if (b === "/") return `/${clean}`;
  return `${b.replace(/\/$/, "")}/${clean}`;
}

function normPath(url: string): string {
  const u = url.trim();
  return u.startsWith("/") ? u : `/${u}`;
}

export function achievementArtSrc(artworkUrl: string | undefined | null, badgeId?: string): string {
  const u = (artworkUrl || "").trim();

  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) {
    return u;
  }

  if (u) {
    const key = normPath(u);
    const byPath = ART_BY_PATH[key];
    if (byPath) return byPath;
  }

  if (badgeId && ART_BY_BADGE_ID[badgeId]) {
    return ART_BY_BADGE_ID[badgeId];
  }

  if (u) {
    const key = normPath(u);
    return withBase(key.startsWith("/") ? key.slice(1) : key);
  }

  return withBase("favicon.svg");
}
