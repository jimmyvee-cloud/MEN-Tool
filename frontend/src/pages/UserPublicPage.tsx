import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserMinus, UserPlus, Ban, Trophy } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/api";
import { useBadgeUnlock } from "@/context/BadgeUnlockContext";
import { badgesUnlockedFromResponse } from "@/lib/badgeUnlockPayload";
import { notifyFollowingUpdated } from "@/lib/socialEvents";
import { AchievementGrid, type BadgeCatalogEntry } from "@/components/AchievementGrid";
import { RankCard } from "@/components/RankCard";
import { avatarSrc } from "@/lib/branding";

type Pub = {
  user: {
    user_id: string;
    display_name: string;
    avatar_url?: string;
    created_at?: string;
  };
  stats: { checkins: number; stressors: number; reliefs: number };
  rank: {
    rank_title: string;
    xp_total: number;
    rank_level: number;
    next_rank_title: string | null;
    progress_pct: number;
  };
  badges: { badge_id: string; unlocked_at: string }[];
  badge_catalog?: BadgeCatalogEntry[];
  social: { is_following: boolean };
};

export function UserPublicPage() {
  const { userId } = useParams();
  const nav = useNavigate();
  const { announceUnlocks } = useBadgeUnlock();
  const [selfId, setSelfId] = useState<string | null>(null);
  const [p, setP] = useState<Pub | null>(null);
  const [wall, setWall] = useState<{ content: string; author_user_id: string; created_at: string }[]>(
    []
  );
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!userId) return;
    apiJson<Pub>(`/v1/users/${userId}`)
      .then(setP)
      .catch(() => setP(null));
    apiJson<typeof wall>(`/v1/users/${userId}/wall`)
      .then(setWall)
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    apiJson<{ user: { user_id: string } }>("/v1/me")
      .then((m) => setSelfId(m.user.user_id))
      .catch(() => setSelfId(null));
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#wall") return;
    requestAnimationFrame(() =>
      document.getElementById("wall")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, [userId, p]);

  async function follow() {
    if (!userId) return;
    const res = await apiFetch(`/v1/users/${userId}/follow`, { method: "POST" });
    if (res.ok) {
      try {
        const data = (await res.json()) as Record<string, unknown>;
        const buds = badgesUnlockedFromResponse(data);
        if (buds.length) announceUnlocks(buds);
      } catch {
        /* ignore malformed */
      }
    }
    const u = await apiJson<Pub>(`/v1/users/${userId}`);
    setP(u);
    notifyFollowingUpdated();
  }

  async function unfollow() {
    if (!userId) return;
    await apiFetch(`/v1/users/${userId}/follow`, { method: "DELETE" });
    const u = await apiJson<Pub>(`/v1/users/${userId}`);
    setP(u);
    notifyFollowingUpdated();
  }

  async function block() {
    if (!userId) return;
    await apiFetch(`/v1/users/${userId}/block`, { method: "POST" });
    notifyFollowingUpdated();
    nav(-1);
  }

  async function postWall() {
    if (!userId || !msg.trim()) return;
    const res = await apiFetch(`/v1/users/${userId}/wall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg.trim() }),
    });
    if (res.ok) {
      try {
        const data = (await res.json()) as Record<string, unknown>;
        const buds = badgesUnlockedFromResponse(data);
        if (buds.length) announceUnlocks(buds);
      } catch {
        /* ignore */
      }
    }
    setMsg("");
    const w = await apiJson<typeof wall>(`/v1/users/${userId}/wall`);
    setWall(w);
  }

  if (!p) return <div className="p-6">…</div>;

  const isSelf = Boolean(selfId && userId === selfId);

  const days = p.user.created_at
    ? Math.floor(
        (Date.now() - new Date(p.user.created_at).getTime()) / (86400 * 1000)
      )
    : 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4 pb-10">
      <header className="flex items-center gap-2">
        <button type="button" className="text-muted" onClick={() => nav(-1)}>
          ←
        </button>
        <h1 className="text-lg font-bold">{p.user.display_name}&apos;s Profile</h1>
      </header>
      <div className="flex justify-center">
        <div className="w-24 h-24 rounded-full bg-surface border-2 border-gold/40 overflow-hidden">
          <img
            src={avatarSrc(p.user.avatar_url)}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      <p className="text-center text-2xl font-bold">{p.user.display_name}</p>
      <p className="text-center text-sm text-muted">Member for {days} days</p>
      {!isSelf && (
        <div className="flex gap-2 justify-center flex-wrap">
          {p.social.is_following ? (
            <button
              type="button"
              onClick={() => void unfollow()}
              className="flex items-center gap-1 px-4 py-2 rounded-full bg-surface border border-white/10 text-sm"
            >
              <UserMinus className="w-4 h-4" /> Unfollow
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void follow()}
              className="flex items-center gap-1 px-4 py-2 rounded-full gold-gradient text-black font-semibold text-sm"
            >
              <UserPlus className="w-4 h-4" /> Follow
            </button>
          )}
          <button
            type="button"
            onClick={() => void block()}
            className="flex items-center gap-1 px-4 py-2 rounded-full border border-red-500 text-red-400 text-sm"
          >
            <Ban className="w-4 h-4" /> Block
          </button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center py-2 text-sm">
          <div className="text-lg font-bold">{p.stats.checkins}</div>
          <div className="text-[10px] text-muted">Check-ins</div>
        </div>
        <div className="card text-center py-2 text-sm">
          <div className="text-lg font-bold">{p.stats.stressors}</div>
          <div className="text-[10px] text-muted">Stressors</div>
        </div>
        <div className="card text-center py-2 text-sm">
          <div className="text-lg font-bold">{p.stats.reliefs}</div>
          <div className="text-[10px] text-muted">Reliefs</div>
        </div>
      </div>
      <RankCard
        title={p.rank.rank_title}
        xp={p.rank.xp_total}
        level={p.rank.rank_level}
        nextTitle={p.rank.next_rank_title}
        progressPct={p.rank.progress_pct}
      />
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-gold">
          <Trophy className="w-5 h-5" />
          <span className="font-semibold text-white">Badges</span>
        </div>
        <AchievementGrid catalog={p.badge_catalog ?? []} unlocked={p.badges} />
      </section>
      <section id="wall" className="card space-y-2 scroll-mt-4">
        <h2 className="text-gold flex items-center gap-1 text-sm font-semibold">💬 Wall</h2>
        <textarea
          className="w-full rounded-xl bg-night border border-white/10 p-3 text-sm min-h-[72px]"
          placeholder="Leave a message..."
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void postWall()}
          className="w-full py-2 rounded-xl gold-gradient text-black font-semibold text-sm"
        >
          Post
        </button>
        <div className="space-y-2 mt-2">
          {wall.map((w) => (
            <div key={w.created_at} className="text-sm border-t border-white/5 pt-2 text-muted">
              {w.content}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
