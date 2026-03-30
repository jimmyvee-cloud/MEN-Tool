import { Crown } from "lucide-react";
import { ProfileMenuDropdown } from "@/components/ProfileMenuDropdown";
import { useUserHeader } from "@/context/UserHeaderContext";
import { LOGO_SRC } from "@/lib/branding";

export function DashboardHeader() {
  const { me } = useUserHeader();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const showPremium = me?.tier === "premium" || me?.tier === "admin";

  return (
    <header className="flex justify-between items-start gap-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <img
            src={LOGO_SRC}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg object-cover shrink-0 border border-gold/20"
          />
          <h1 className="text-2xl font-bold text-gold">Men-TOOL</h1>
          {showPremium ? (
            <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface border border-gold/40 text-gold">
              <Crown className="w-3 h-3" /> Premium
            </span>
          ) : null}
        </div>
        <p className="text-muted text-sm mt-1">
          Good {greeting}, {me?.display_name || "…"}
        </p>
      </div>
      <ProfileMenuDropdown me={me} />
    </header>
  );
}
