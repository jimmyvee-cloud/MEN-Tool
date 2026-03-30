import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ChevronLeft, Trophy, Users } from "lucide-react";
import { ActivityCountsGrid, type ActivityCounts } from "@/components/ActivityCountsGrid";
import { apiJson } from "@/lib/api";
import { FOLLOWING_UPDATED_EVENT } from "@/lib/socialEvents";
import { AchievementGrid, type BadgeCatalogEntry } from "@/components/AchievementGrid";
import { RankCard } from "@/components/RankCard";
import { useUserHeader } from "@/context/UserHeaderContext";
import { avatarSrc } from "@/lib/branding";

type Me = {
  user: {
    user_id: string;
    display_name: string;
    avatar_url?: string;
    created_at?: string;
  };
  rank: {
    rank_title: string;
    xp_total: number;
    rank_level: number;
    next_rank_title: string | null;
    progress_pct: number;
  };
  badges: { badge_id: string; unlocked_at: string }[];
  badge_catalog?: BadgeCatalogEntry[];
};

type FollowingRow = {
  user_id: string;
  display_name: string;
  avatar_url?: string;
};

export function ProfilePage() {
  const { refresh: refreshHeader } = useUserHeader();
  const [me, setMe] = useState<Me | null>(null);
  const [counts, setCounts] = useState<ActivityCounts | null>(null);
  const [following, setFollowing] = useState<FollowingRow[]>([]);

  const loadFollowing = () => {
    apiJson<FollowingRow[]>("/v1/me/following")
      .then(setFollowing)
      .catch(() => setFollowing([]));
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiJson<Me>("/v1/me"), apiJson<ActivityCounts>("/v1/me/counts")])
      .then(([m, c]) => {
        if (!cancelled) {
          setMe(m);
          setCounts(c);
          refreshHeader();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshHeader]);

  useEffect(() => {
    loadFollowing();
    const onUpdate = () => loadFollowing();
    window.addEventListener(FOLLOWING_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(FOLLOWING_UPDATED_EVENT, onUpdate);
  }, []);

  const days = me?.user.created_at
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(me.user.created_at).getTime()) / 86400000)
      )
    : 0;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4 pb-10">
      <div className="flex items-center gap-2">
        <Link to="/" className="text-muted p-1 rounded-lg hover:bg-white/5" aria-label="Back">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-lg font-semibold text-white flex-1 text-center pr-8">Profile</h1>
      </div>

      {me && (
        <>
          <div className="flex flex-col items-center text-center pt-2">
            <div className="w-24 h-24 rounded-full bg-surface border-2 border-gold/30 overflow-hidden mb-3">
              <img
                src={avatarSrc(me.user.avatar_url)}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xl font-bold text-white">{me.user.display_name}</p>
            <p className="text-sm text-muted flex items-center gap-1 mt-1">
              <Calendar className="w-3.5 h-3.5" /> Member for {days} days
            </p>
          </div>

          <ActivityCountsGrid counts={counts} scopeLabel="All time" loading={!counts} />

          <RankCard
            title={me.rank.rank_title}
            xp={me.rank.xp_total}
            level={me.rank.rank_level}
            nextTitle={me.rank.next_rank_title}
            progressPct={me.rank.progress_pct}
          />

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-gold">
              <Trophy className="w-5 h-5" />
              <span className="font-semibold text-white">Badges</span>
            </div>
            <p className="text-[11px] text-muted">
              Locked badges show in grayscale. Tap a badge for how to unlock.
            </p>
            <AchievementGrid catalog={me.badge_catalog ?? []} unlocked={me.badges} />
          </section>

          <section className="space-y-3" aria-label="People you follow">
            <div className="flex items-center gap-2 flex-wrap">
              <Users className="w-5 h-5 text-gold shrink-0" aria-hidden />
              <span className="font-semibold text-white">Following</span>
              <span className="text-sm text-slate-500">({following.length})</span>
            </div>
            {following.length === 0 ? (
              <p className="text-xs text-muted">
                You&apos;re not following anyone yet. Use Find a friend to connect.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:thin]">
                <ul className="flex gap-5 w-max pr-2">
                  {following.map((f) => (
                    <li key={f.user_id} className="shrink-0 w-[4.75rem]">
                      <Link
                        to={`/users/${f.user_id}`}
                        className="flex flex-col items-center gap-1.5 text-center min-w-0"
                      >
                        <div className="w-[3.75rem] h-[3.75rem] rounded-full border border-black/40 ring-1 ring-white/10 overflow-hidden bg-black/25">
                          <img
                            src={avatarSrc(f.avatar_url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[11px] leading-tight text-gold font-medium w-full truncate">
                          {f.display_name}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
