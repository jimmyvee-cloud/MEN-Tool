import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiJson } from "@/lib/api";

type Bundle = {
  week_start: string;
  week_end: string;
  charts: {
    daily_mood_average: { date: string; avg_mood: number | null; count: number }[];
    stressors_vs_reliefs: { date: string; stressors: number; reliefs: number }[];
  };
  insight_cards: {
    kind: string;
    title: string;
    description: string;
    severity?: string;
    score?: number;
  }[];
};

const SEVERITY_BORDER: Record<string, string> = {
  info: "border-l-blue-400",
  nudge: "border-l-gold",
  warning: "border-l-orange-400",
  alert: "border-l-red-500",
};

const SEVERITY_ICON: Record<string, string> = {
  info: "💡",
  nudge: "👀",
  warning: "⚠️",
  alert: "🚨",
};

function cardBorder(card: Bundle["insight_cards"][number]): string {
  if (card.kind !== "inference" || !card.severity) return "border-gold/30";
  return `${SEVERITY_BORDER[card.severity] ?? "border-gold/30"} border-l-4`;
}

function cardIcon(card: Bundle["insight_cards"][number]): string {
  if (card.kind === "pattern_stressor") return "🔥 ";
  if (card.kind !== "inference" || !card.severity) return "";
  return (SEVERITY_ICON[card.severity] ?? "") + " ";
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function InsightsPage() {
  const [weekStart, setWeekStart] = useState(() => {
    const t = new Date();
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [data, setData] = useState<Bundle | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiJson<Bundle>(`/v1/insights?week_start=${weekStart}`)
      .then(setData)
      .catch(() => setData(null));
  }, [weekStart]);

  const chartMood = useMemo(() => {
    if (!data) return [];
    return data.charts.daily_mood_average.map((r) => ({
      label: r.date.slice(5),
      mood: r.avg_mood ?? null,
    }));
  }, [data]);

  const chartSR = useMemo(() => {
    if (!data) return [];
    return data.charts.stressors_vs_reliefs.map((r) => ({
      label: r.date.slice(5),
      stressors: r.stressors,
      reliefs: r.reliefs,
    }));
  }, [data]);

  const labelRange = data ? `${data.week_start} → ${data.week_end}` : "";

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4 pb-10">
      <DashboardHeader />
      <div className="flex items-center gap-2 mt-2">
        <Link to="/" className="text-muted p-1 rounded-lg hover:bg-white/5" aria-label="Back to Today">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold text-white">Insights</h1>
      </div>
      <div className="flex items-center justify-center gap-4 text-sm text-muted">
        <button
          type="button"
          className="p-2 rounded-lg bg-surface border border-white/10"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-white text-xs">{labelRange}</span>
        <button
          type="button"
          className="p-2 rounded-lg bg-surface border border-white/10"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <section className="card h-72">
        <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Daily mood average</p>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={chartMood}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="label" stroke="#888" tick={{ fontSize: 10 }} angle={-35} height={50} />
            <YAxis domain={[0, 10]} stroke="#888" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }}
              labelStyle={{ color: "#ccc" }}
            />
            <Line
              type="monotone"
              dataKey="mood"
              stroke="#d4a64b"
              strokeWidth={2}
              dot={{ fill: "#d4a64b" }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="card h-72">
        <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Stressors vs reliefs</p>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={chartSR}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="label" stroke="#888" tick={{ fontSize: 10 }} angle={-35} height={50} />
            <YAxis allowDecimals={false} stroke="#888" tick={{ fontSize: 10 }} />
            <Legend />
            <Tooltip
              contentStyle={{ background: "#1e1e1e", border: "1px solid #333" }}
              labelStyle={{ color: "#ccc" }}
            />
            <Bar dataKey="stressors" fill="#ef4444" name="Stressors" />
            <Bar dataKey="reliefs" fill="#38bdf8" name="Reliefs" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h2 className="text-xs uppercase text-muted mb-2">What we&apos;re noticing</h2>
        <div className="space-y-3">
          {(data?.insight_cards || [])
            .filter((c) => !dismissed[c.title])
            .map((c) => (
              <div
                key={c.title}
                className={`card border ${cardBorder(c)} relative pr-10`}
              >
                <button
                  type="button"
                  className="absolute top-3 right-3 text-muted hover:text-white"
                  aria-label="Dismiss"
                  onClick={() => setDismissed((d) => ({ ...d, [c.title]: true }))}
                >
                  ✕
                </button>
                <p className="text-lg font-medium text-white mb-1">
                  {cardIcon(c)}{c.title}
                </p>
                <p className="text-sm text-muted">{c.description}</p>
                {c.kind === "inference" && c.score != null && (
                  <p className="text-[10px] text-muted/60 mt-2 tabular-nums">
                    relevance {Math.round(c.score * 100)}%
                  </p>
                )}
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
