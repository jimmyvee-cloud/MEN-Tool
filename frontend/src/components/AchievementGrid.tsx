import { Share2 } from "lucide-react";
import { achievementArtSrc } from "@/lib/achievementArt";

export type BadgeCatalogEntry = {
  badge_id: string;
  title: string;
  artwork_url?: string;
  unlock_hint: string;
  catalog_order?: number;
  unlock_rule?: unknown;
};

export type UserBadgeRow = { badge_id: string; unlocked_at: string };

type Props = {
  catalog: BadgeCatalogEntry[];
  unlocked: UserBadgeRow[];
};

async function shareBadge(title: string, unlocked: boolean) {
  const text = unlocked
    ? `I unlocked “${title}” on Men-TOOL!`
    : `Working toward “${title}” on Men-TOOL.`;
  const url = typeof window !== "undefined" ? `${window.location.origin}/profile` : "";
  try {
    if (navigator.share) {
      await navigator.share({ title: "Men-TOOL", text, url });
      return;
    }
  } catch {
    /* user cancelled or share failed */
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`.trim());
  } catch {
    /* ignore */
  }
}

export function AchievementGrid({ catalog, unlocked }: Props) {
  const unlockedIds = new Set(unlocked.map((u) => u.badge_id));

  if (!catalog.length) {
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {unlocked.map((b) => (
          <li key={b.badge_id}>
            <div className="rounded-2xl border border-gold/35 bg-[#1e2630] p-4 text-center">
              <div className="text-2xl mb-2" aria-hidden>
                🏆
              </div>
              <span className="text-[10px] text-gold">{b.badge_id}</span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {catalog.map((b) => {
        const on = unlockedIds.has(b.badge_id);
        const hint = b.unlock_hint || `Achievement: ${b.title}`;
        return (
          <li key={b.badge_id} className="min-w-0">
            <div className="rounded-2xl border border-white/10 bg-[#1e2630] p-3 flex flex-col h-full shadow-sm">
              <div
                className="relative flex items-center justify-center min-h-[7.5rem] mb-2"
                title={hint}
              >
                <img
                  src={achievementArtSrc(b.artwork_url, b.badge_id)}
                  alt=""
                  className={`max-h-[7rem] w-full object-contain drop-shadow-md ${
                    on ? "" : "grayscale brightness-[0.85] contrast-[0.9]"
                  }`}
                />
              </div>
              <p className="text-xs text-slate-400 font-medium leading-tight line-clamp-2 min-h-[2rem]">
                {b.title}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                <span
                  className={`inline-flex self-start rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    on
                      ? "border-gold/60 bg-gold/10 text-gold"
                      : "border-white/20 text-white/40"
                  }`}
                >
                  {on ? "Unlocked" : "Locked"}
                </span>
                {on && (
                  <button
                    type="button"
                    onClick={() => void shareBadge(b.title, true)}
                    className="flex items-center gap-1 text-[11px] text-gold/90 hover:text-gold w-fit"
                  >
                    <Share2 className="w-3.5 h-3.5" aria-hidden />
                    Share
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
