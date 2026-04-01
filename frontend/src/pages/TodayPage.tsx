import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart2, Brain, Camera, Gift, Globe, MessageCircle, UserPlus } from "lucide-react";
import { ActivityCountsGrid } from "@/components/ActivityCountsGrid";
import { apiJson } from "@/lib/api";
import { DashboardHeader } from "@/components/DashboardHeader";
import { useUserHeader } from "@/context/UserHeaderContext";

type SetupTask = {
  id: string;
  label: string;
  points: number;
  done: boolean;
};

type Me = {
  user: {
    user_id: string;
    timezone?: string;
    profile_steps_completed?: number;
    /** When true, Today page hides the setup checklist (server-persisted). */
    setup_dismissed?: boolean;
  };
  setup?: {
    dismissed?: boolean;
    tasks: SetupTask[];
    completed: number;
    total: number;
  };
};

type CheckinRow = { mood_score: number; logged_at: string };
type StressorRow = {
  stressor_id?: string;
  title: string;
  logged_at: string;
  category: string;
  intensity: number;
};
type ReliefRow = {
  relief_id?: string;
  title: string;
  logged_at: string;
  category: string;
  duration_seconds: number;
  effectiveness: number;
  focus: number;
};

function dayKeyInZone(isoOrDate: string | Date, timeZone: string | undefined): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
  if (timeZone) opts.timeZone = timeZone;
  return new Intl.DateTimeFormat("en-CA", opts).format(d);
}

function filterToday<T extends { logged_at: string }>(rows: T[], tz: string | undefined): T[] {
  const today = dayKeyInZone(new Date(), tz);
  return rows.filter((r) => dayKeyInZone(r.logged_at, tz) === today);
}

function formatDurationShort(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function focusLabel(focus: number): string {
  if (focus <= 2) return "Low focus";
  if (focus <= 4) return "Distracted";
  if (focus <= 6) return "Kinda focused";
  if (focus <= 8) return "Focused";
  return "Locked in";
}

/** Map 0–10 effectiveness to 0–5 filled dots (matches ~4/5 for strong relief). */
function effectivenessDots(effectiveness: number): number {
  return Math.min(5, Math.max(0, Math.round(effectiveness / 2)));
}

function DotRating({ filled }: { filled: number }) {
  return (
    <div className="flex gap-1 shrink-0" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${i < filled ? "bg-gold" : "bg-white/15"}`}
        />
      ))}
    </div>
  );
}

function taskIcon(id: string) {
  switch (id) {
    case "timezone":
      return <Globe className="w-4 h-4 text-gold shrink-0" />;
    case "photo":
      return <Camera className="w-4 h-4 text-gold shrink-0" />;
    case "follow":
      return <UserPlus className="w-4 h-4 text-gold shrink-0" />;
    case "refer":
      return <Gift className="w-4 h-4 text-gold shrink-0" />;
    case "wall":
      return <MessageCircle className="w-4 h-4 text-gold shrink-0" />;
    default:
      return <Brain className="w-4 h-4 text-gold shrink-0" />;
  }
}

function taskHref(task: SetupTask, myUserId: string): string {
  switch (task.id) {
    case "timezone":
      return "/settings";
    case "photo":
      return "/settings";
    case "follow":
      return "/find-friend";
    case "refer":
      return "/refer";
    case "wall":
      return `/users/${myUserId}#wall`;
    default:
      return "/";
  }
}

function TodayLogsLoading({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-5"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className="h-9 w-9 rounded-full border-2 border-white/10 border-t-gold animate-spin"
        role="presentation"
      />
      <span className="text-xs text-muted">Loading…</span>
    </div>
  );
}

export function TodayPage() {
  const { me: headerMe } = useUserHeader();
  const [me, setMe] = useState<Me | null>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [stressors, setStressors] = useState<StressorRow[]>([]);
  const [reliefs, setReliefs] = useState<ReliefRow[]>([]);
  const [logsReady, setLogsReady] = useState(false);
  const [dismissBusy, setDismissBusy] = useState(false);
  const [dismissErr, setDismissErr] = useState("");

  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const [m, ci, st, rf] = await Promise.all([
          apiJson<Me>("/v1/me"),
          apiJson<CheckinRow[]>("/v1/checkins"),
          apiJson<StressorRow[]>("/v1/stressors"),
          apiJson<ReliefRow[]>("/v1/reliefs"),
        ]);
        if (ok) {
          setMe(m);
          setCheckins(ci);
          setStressors(st);
          setReliefs(rf);
        }
      } catch {
        /* handled by api */
      } finally {
        if (ok) setLogsReady(true);
      }
    })();
    return () => {
      ok = false;
    };
  }, []);

  const myId = me?.user.user_id ?? headerMe?.user_id ?? "";
  const setupDismissed =
    me?.user?.setup_dismissed === true || me?.setup?.dismissed === true;
  const tasks = me?.setup?.tasks ?? [];
  const completed = me?.setup?.completed ?? 0;
  const total = Math.max(me?.setup?.total ?? 0, tasks.length, 1);
  const pct = Math.round((completed / total) * 100);

  async function dismissSetupForever() {
    setDismissErr("");
    setDismissBusy(true);
    try {
      await apiJson("/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup_dismissed: true }),
      });
      const m = await apiJson<Me>("/v1/me");
      setMe(m);
    } catch {
      setDismissErr("Could not save. Try again.");
    } finally {
      setDismissBusy(false);
    }
  }

  const fallbackTasks = useMemo(
    () =>
      !me?.setup && me?.user.profile_steps_completed != null
        ? Math.min(5, Math.max(0, me.user.profile_steps_completed))
        : null,
    [me]
  );

  const tz = me?.user.timezone?.trim() || undefined;
  const todayCheckins = useMemo(() => filterToday(checkins, tz), [checkins, tz]);
  const todayStressors = useMemo(() => filterToday(stressors, tz), [stressors, tz]);
  const todayReliefs = useMemo(() => filterToday(reliefs, tz), [reliefs, tz]);
  const reliefsNewestFirst = useMemo(
    () => [...todayReliefs].sort((a, b) => b.logged_at.localeCompare(a.logged_at)),
    [todayReliefs]
  );

  const moodAvg =
    todayCheckins.length > 0
      ? todayCheckins.reduce((s, c) => s + c.mood_score, 0) / todayCheckins.length
      : null;
  const moodRounded = moodAvg != null ? Math.round(moodAvg) : null;
  const checkinWord = todayCheckins.length === 1 ? "check-in" : "check-ins";

  const todayCounts = useMemo(
    () => ({
      checkins: todayCheckins.length,
      stressors: todayStressors.length,
      reliefs: todayReliefs.length,
    }),
    [todayCheckins, todayStressors, todayReliefs],
  );

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <DashboardHeader />

      <ActivityCountsGrid
        counts={logsReady ? todayCounts : null}
        scopeLabel="Today"
        loading={!logsReady}
      />

      {me && !setupDismissed && (
        <section className="card space-y-3">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted">
            <span>Profile setup</span>
            <span className="text-gold">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-full gold-gradient rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          {tasks.length > 0 && myId ? (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link
                    to={taskHref(t, myId)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors ${
                      t.done
                        ? "border-emerald-500/30 bg-emerald-500/5 text-muted"
                        : "border-white/10 bg-night/80 text-white hover:border-gold/25"
                    }`}
                  >
                    {taskIcon(t.id)}
                    <span className={`flex-1 text-left ${t.done ? "line-through" : ""}`}>{t.label}</span>
                    <span className="text-gold/90 text-xs shrink-0 whitespace-nowrap">
                      +{t.points} pts
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {fallbackTasks != null
                ? `Legacy progress: ${fallbackTasks} of 5 steps (open Settings to refresh tasks).`
                : "Loading setup…"}
            </p>
          )}
          <p className="text-xs text-muted flex items-center gap-1">
            <span className="text-emerald-400">✓</span> {completed} of {total} complete
          </p>
          {dismissErr ? <p className="text-sm text-red-400">{dismissErr}</p> : null}
          <button
            type="button"
            disabled={dismissBusy}
            onClick={() => void dismissSetupForever()}
            className="w-full text-sm text-muted hover:text-white py-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors disabled:opacity-50"
          >
            {dismissBusy ? "Saving…" : "Don’t show this again"}
          </button>
          <p className="text-[11px] text-muted text-center">
            You can bring the checklist back anytime in{" "}
            <Link to="/settings" className="text-gold underline-offset-2 hover:underline">
              Settings
            </Link>
            .
          </p>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-[10px] uppercase tracking-widest text-muted">Mood today</h2>
        {!logsReady ? (
          <TodayLogsLoading label="Loading mood for today" />
        ) : moodRounded != null ? (
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-4xl font-bold text-gold tabular-nums">{moodRounded}</span>
            <span className="text-sm text-muted">
              avg from {todayCheckins.length} {checkinWord}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted">No check-ins yet.</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-[10px] uppercase tracking-widest text-muted">
          Stressors (
          {logsReady ? `${todayStressors.length}` : "—"}
          /10)
        </h2>
        {!logsReady ? (
          <TodayLogsLoading label="Loading stressors for today" />
        ) : todayStressors.length === 0 ? (
          <p className="text-sm text-muted">None logged yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {todayStressors.slice(0, 10).map((s) => (
              <span
                key={s.stressor_id ?? `${s.logged_at}-${s.title}`}
                className="inline-flex px-3 py-2 rounded-full bg-white/[0.06] border border-white/10 text-sm text-white/90"
              >
                {s.title}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-[10px] uppercase tracking-widest text-muted">Relief activities</h2>
        {!logsReady ? (
          <TodayLogsLoading label="Loading relief for today" />
        ) : reliefsNewestFirst.length === 0 ? (
          <p className="text-sm text-muted">None logged yet.</p>
        ) : (
          <div className="space-y-2">
            {reliefsNewestFirst.map((r) => (
              <div
                key={r.relief_id ?? `${r.logged_at}-${r.title}`}
                className="rounded-xl bg-night/90 border border-white/5 px-3 py-3 flex gap-3 items-start"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white text-sm">{r.title}</div>
                  <div className="text-xs text-muted mt-1">
                    {r.category}
                    {" · "}
                    {formatDurationShort(r.duration_seconds)}
                    {" · "}
                    {focusLabel(r.focus)}
                  </div>
                </div>
                <DotRating filled={effectivenessDots(r.effectiveness)} />
              </div>
            ))}
          </div>
        )}
      </section>

      <Link
        to="/insights"
        className="flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4 border border-white/15 bg-surface/50 text-white font-medium"
      >
        <BarChart2 className="w-5 h-5 text-gold" /> Insights
      </Link>

      <div className="pb-8" />
    </div>
  );
}
