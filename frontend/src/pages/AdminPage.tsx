import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Crown,
  KeyRound,
  RefreshCw,
  Share2,
  Shield,
  UserCheck,
  UserX,
} from "lucide-react";
import { apiFetch, apiJson } from "@/lib/api";
import { DashboardHeader } from "@/components/DashboardHeader";

type U = {
  user_id: string;
  email: string;
  display_name: string;
  tier: string;
  created_at: string;
  invite_code: string;
  is_active?: boolean;
};

export function AdminPage() {
  const [tab, setTab] = useState<"users" | "referrals">("users");
  const [users, setUsers] = useState<U[]>([]);
  const [referrals, setReferrals] = useState<
    { referred_user_id: string; referrer_user_id: string; email: string }[]
  >([]);
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setErr("");
    try {
      const u = await apiJson<{ users: U[] }>("/v1/admin/users");
      setUsers(u.users);
      const r = await apiJson<{ referrals: typeof referrals }>("/v1/admin/referrals");
      setReferrals(r.referrals);
    } catch {
      setErr("Admin access denied or error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function patchUser(uid: string, body: { tier?: string; is_active?: boolean }) {
    setBusyId(uid);
    setErr("");
    try {
      const res = await apiFetch(`/v1/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        setErr(t || `${res.status} ${res.statusText}`);
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusyId(null);
    }
  }

  function tierLabel(t: string) {
    if (t === "admin") return "Admin";
    if (t === "premium") return "Premium";
    return "Free";
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4 pb-10">
      <DashboardHeader />
      <div className="flex items-center gap-2">
        <Link to="/" className="text-muted p-1 rounded-lg hover:bg-white/5" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <header className="flex items-center gap-2 text-gold flex-1">
          <Shield className="w-6 h-6" />
          <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
        </header>
      </div>
      <div className="flex rounded-full bg-surface p-1 border border-white/10">
        <button
          type="button"
          className={`flex-1 py-2 rounded-full text-sm flex items-center justify-center gap-1 ${
            tab === "users" ? "bg-night text-gold" : "text-muted"
          }`}
          onClick={() => setTab("users")}
        >
          Users
        </button>
        <button
          type="button"
          className={`flex-1 py-2 rounded-full text-sm flex items-center justify-center gap-1 ${
            tab === "referrals" ? "bg-night text-gold" : "text-muted"
          }`}
          onClick={() => setTab("referrals")}
        >
          <Share2 className="w-4 h-4" /> Referrals
        </button>
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {tab === "users" && (
        <>
          <div className="flex justify-between items-center text-sm text-muted">
            <span>{users.length} users</span>
            <button type="button" onClick={() => void load()} aria-label="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {users.map((u) => {
              const active = u.is_active !== false;
              const loading = busyId === u.user_id;
              return (
                <div
                  key={u.user_id}
                  className={`card space-y-3 relative ${!active ? "opacity-75 border-red-500/30" : ""}`}
                >
                  {!active ? (
                    <span className="absolute top-3 right-3 text-[10px] text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full font-medium">
                      Banned
                    </span>
                  ) : u.tier === "admin" ? (
                    <span className="absolute top-3 right-3 text-[10px] text-gold border border-gold/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Shield className="w-3 h-3" /> admin
                    </span>
                  ) : u.tier === "premium" ? (
                    <span className="absolute top-3 right-3 text-[10px] text-gold border border-gold/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Crown className="w-3 h-3" /> premium
                    </span>
                  ) : null}
                  <div className={u.tier === "admin" || u.tier === "premium" || !active ? "pr-16" : ""}>
                    <p className="font-semibold text-white">{u.display_name}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                    <p className="text-xs text-muted">Joined {u.created_at?.slice(0, 10)}</p>
                    <p className="text-xs text-muted font-mono">Code: {u.invite_code}</p>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-white/5">
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-wider text-muted">Access tier</span>
                      <select
                        className="mt-1 w-full rounded-xl bg-night border border-white/15 text-white text-sm px-3 py-2 disabled:opacity-50"
                        value={["free", "premium", "admin"].includes(u.tier) ? u.tier : "free"}
                        disabled={loading || !active}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (next === u.tier) return;
                          void patchUser(u.user_id, { tier: next });
                        }}
                      >
                        <option value="free">Free — no elevated access</option>
                        <option value="premium">Premium</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <p className="text-[11px] text-muted">
                      Current: <span className="text-white/90">{tierLabel(u.tier)}</span> — change above
                      to grant or revoke Premium / Admin.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loading || !active}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50"
                      onClick={() => void resetPassword(u.user_id, u.email)}
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset password
                    </button>
                    {active ? (
                      <button
                        type="button"
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        onClick={() => {
                          if (confirm(`Deactivate account for ${u.email}? They cannot log in until reactivated.`)) {
                            void patchUser(u.user_id, { is_active: false });
                          }
                        }}
                      >
                        <UserX className="w-3.5 h-3.5" /> Ban / deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                        onClick={() => void patchUser(u.user_id, { is_active: true })}
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Reactivate account
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === "referrals" && (
        <ul className="space-y-2 text-sm">
          {referrals.map((r) => (
            <li key={r.referred_user_id} className="card">
              {r.email} ← {r.referrer_user_id.slice(0, 8)}…
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
