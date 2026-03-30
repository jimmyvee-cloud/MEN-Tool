import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Copy, DollarSign, Gift, UserPlus, Users } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useUserHeader } from "@/context/UserHeaderContext";

const ACCENT = "#FDB022";

type MeLite = {
  user: { invite_code?: string };
};

type ReferralRow = {
  user_id: string;
  display_name: string;
  created_at?: string;
  tier?: string;
};

type ReferralsResponse = {
  referrals: ReferralRow[];
  stats: { referrals: number; converted: number; commission_pct: number };
};

function formatShortDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });
}

function referralLabel(userId: string): string {
  return `Referral #${userId.slice(0, 8)}`;
}

function statusForTier(tier?: string): string {
  return (tier || "").toLowerCase() === "premium" ? "Premium" : "Signed Up";
}

export function ReferFriendPage() {
  const { refresh: refreshHeader } = useUserHeader();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [data, setData] = useState<ReferralsResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let ok = true;
    Promise.all([apiJson<MeLite>("/v1/me"), apiJson<ReferralsResponse>("/v1/me/referrals")])
      .then(([m, r]) => {
        if (!ok) return;
        setInviteCode(m.user.invite_code ?? null);
        setData(r);
        refreshHeader();
      })
      .catch(() => {
        if (ok) {
          setInviteCode(null);
          setData(null);
        }
      });
    return () => {
      ok = false;
    };
  }, [refreshHeader]);

  const shareUrl = useMemo(() => {
    if (!inviteCode) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/register?invite=${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const stats = data?.stats;
  const rows = data?.referrals ?? [];

  return (
    <div className="min-h-dvh bg-night pb-28">
      <div className="sticky top-0 z-40 bg-night/95 backdrop-blur border-b border-white/5 px-3 py-3 flex items-center gap-2">
        <Link to="/" className="text-muted p-2 rounded-lg hover:bg-white/5 -ml-1" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-base font-semibold text-white flex-1 text-center pr-9">Refer a Friend</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        <section className="rounded-2xl bg-surface border border-white/5 p-5 space-y-4">
          <div className="flex justify-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${ACCENT}22` }}
            >
              <Gift className="w-6 h-6" style={{ color: ACCENT }} />
            </div>
          </div>
          <h2 className="text-center text-lg font-semibold text-white">Refer a Friend</h2>
          <p className="text-sm text-muted text-center leading-relaxed">
            Share your link and earn{" "}
            <span className="font-semibold" style={{ color: ACCENT }}>
              33% commission
            </span>{" "}
            when your referrals upgrade to Premium.
          </p>
          <p className="text-xs text-muted text-center">
            You also earn <span className="text-gold font-medium">+50 pts</span> in-app when someone joins
            with your link.
          </p>

          <div className="flex gap-2 items-stretch">
            <div className="flex-1 min-w-0 rounded-xl bg-night border border-white/10 px-3 py-2.5 flex items-center">
              <p className="text-xs text-white/90 font-mono truncate" title={shareUrl || undefined}>
                {shareUrl || "…"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyLink()}
              disabled={!shareUrl}
              className="shrink-0 flex items-center gap-1.5 px-4 rounded-xl font-semibold text-sm text-black disabled:opacity-40"
              style={{ backgroundColor: ACCENT }}
            >
              <Copy className="w-4 h-4" />
              {copied ? "Done" : "Copy"}
            </button>
          </div>
        </section>

        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-surface border border-white/5 py-4 px-2 text-center">
              <Users className="w-6 h-6 mx-auto mb-2" style={{ color: ACCENT }} />
              <div className="text-xl font-bold text-white tabular-nums">{stats.referrals}</div>
              <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Referrals</div>
            </div>
            <div className="rounded-xl bg-surface border border-white/5 py-4 px-2 text-center">
              <UserPlus className="w-6 h-6 mx-auto mb-2" style={{ color: ACCENT }} />
              <div className="text-xl font-bold text-white tabular-nums">{stats.converted}</div>
              <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Converted</div>
            </div>
            <div className="rounded-xl bg-surface border border-white/5 py-4 px-2 text-center">
              <DollarSign className="w-6 h-6 mx-auto mb-2" style={{ color: ACCENT }} />
              <div className="text-xl font-bold text-white tabular-nums">{stats.commission_pct}%</div>
              <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Commission</div>
            </div>
          </div>
        )}

        <section className="rounded-2xl bg-surface border border-white/5 overflow-hidden">
          <h3 className="text-sm font-semibold text-white px-4 pt-4 pb-3">Your Referrals</h3>
          {rows.length === 0 ? (
            <p className="text-xs text-muted px-4 pb-5">No referrals yet. Share your link above.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {rows.map((r) => (
                <li key={r.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{referralLabel(r.user_id)}</p>
                    <p className="text-xs text-muted mt-0.5">{formatShortDate(r.created_at)}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-night text-muted border border-white/10">
                    {statusForTier(r.tier)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
