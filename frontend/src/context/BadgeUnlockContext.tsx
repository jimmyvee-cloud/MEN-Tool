import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import type { BadgeUnlockPayload } from "@/lib/badgeUnlockPayload";
import { achievementArtSrc } from "@/lib/achievementArt";

type Ctx = {
  announceUnlocks: (badges: BadgeUnlockPayload[]) => void;
};

const BadgeUnlockContext = createContext<Ctx | null>(null);

function BadgeUnlockModal({
  badge,
  onClose,
}: {
  badge: BadgeUnlockPayload;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = badge.title?.trim() || "Achievement";
  const forText = (badge.unlock_hint || "").trim();
  const art = achievementArtSrc(badge.artwork_url, badge.badge_id);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/75"
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-unlock-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-gold/35 bg-[#1a2330] shadow-xl shadow-black/40 p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="text-sm text-white/80 mb-1">You just unlocked</p>
        <h2 id="badge-unlock-title" className="text-xl font-bold text-gold mb-4 px-2">
          {title}
        </h2>

        <div className="flex justify-center mb-4">
          <img
            src={art}
            alt=""
            className="max-h-40 w-auto max-w-full object-contain drop-shadow-lg"
          />
        </div>

        {forText ? (
          <p className="text-sm text-white/70 leading-relaxed mb-3">
            For <span className="text-white/90">{forText}</span>
          </p>
        ) : null}

        <p className="text-lg font-semibold text-gold mt-2">Well done!</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-xl gold-gradient text-black font-semibold text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function BadgeUnlockProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<BadgeUnlockPayload[]>([]);

  const announceUnlocks = useCallback((badges: BadgeUnlockPayload[]) => {
    if (!badges?.length) return;
    setQueue((q) => [...q, ...badges]);
  }, []);

  const dismiss = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  const current = queue[0] ?? null;

  return (
    <BadgeUnlockContext.Provider value={{ announceUnlocks }}>
      {children}
      {current ? <BadgeUnlockModal badge={current} onClose={dismiss} /> : null}
    </BadgeUnlockContext.Provider>
  );
}

export function useBadgeUnlock() {
  const ctx = useContext(BadgeUnlockContext);
  if (!ctx) {
    throw new Error("useBadgeUnlock must be used inside BadgeUnlockProvider");
  }
  return ctx;
}
