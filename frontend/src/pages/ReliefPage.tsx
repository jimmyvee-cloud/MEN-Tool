import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiJson, apiPostQueued } from "@/lib/api";
import { usePending } from "@/App";
import { useBadgeUnlock } from "@/context/BadgeUnlockContext";
import { badgesUnlockedFromResponse } from "@/lib/badgeUnlockPayload";
import { DashboardHeader } from "@/components/DashboardHeader";

const types = [
  { id: "physical", label: "Physical", emoji: "🏃" },
  { id: "emotional", label: "Emotional", emoji: "💙" },
  { id: "mental", label: "Mental", emoji: "📚" },
  { id: "social", label: "Social", emoji: "🤝" },
  { id: "spiritual", label: "Spiritual", emoji: "🧘" },
  { id: "meditation", label: "Meditation", emoji: "🧘‍♂️" },
];

const durations = [5, 10, 15, 20, 30, 45, 60, 90];

type Preset = {
  preset_id: string;
  title: string;
  preset_entity: string;
  youtube_url?: string;
  duration_seconds?: number;
};

export function ReliefPage() {
  const nav = useNavigate();
  const { refreshPending } = usePending();
  const { announceUnlocks } = useBadgeUnlock();
  const [cat, setCat] = useState("physical");
  const [title, setTitle] = useState("");
  const [durationMin, setDurationMin] = useState(15);
  const [focus, setFocus] = useState(3);
  const [effectiveness, setEffectiveness] = useState(7);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiJson<Preset[]>("/v1/presets")
      .then((rows) => setPresets(rows.filter((p) => p.preset_entity === "relief")))
      .catch(() => {});
  }, []);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await apiPostQueued<Record<string, unknown>>(
        "/v1/reliefs",
        {
          title: title.trim(),
          category: cat,
          duration_seconds: durationMin * 60,
          effectiveness,
          focus,
        },
        refreshPending
      );
      if (res) {
        const buds = badgesUnlockedFromResponse(res);
        if (buds.length) announceUnlocks(buds);
      }
      nav("/");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4 pb-10">
      <DashboardHeader />
      <header>
        <h1 className="text-xl font-bold text-white">Log Relief</h1>
        <p className="text-muted text-sm">What helped you decompress?</p>
      </header>

      {presets.length > 0 && (
        <div className="card space-y-2">
          <p className="text-xs uppercase text-muted">Presets</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Link
                key={p.preset_id}
                to={`/relievers/preset/${p.preset_id}`}
                className="px-3 py-2 rounded-lg border border-gold/40 text-gold text-sm"
              >
                {p.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div>
          <p className="text-xs uppercase text-muted mb-2">Type</p>
          <div className="grid grid-cols-2 gap-2">
            {types.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`rounded-xl py-3 text-sm border ${
                  cat === c.id
                    ? "border-gold text-gold bg-gold/10"
                    : "border-white/10 bg-night text-muted"
                }`}
              >
                <span className="mr-1">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted mb-2">What helped?</p>
          <input
            className="w-full rounded-xl bg-night border border-white/10 px-4 py-3"
            placeholder="e.g. Yoga, meditation, reading..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <p className="text-xs uppercase text-muted mb-2">Duration (minutes)</p>
          <div className="flex flex-wrap gap-2">
            {durations.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDurationMin(m)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  durationMin === m
                    ? "border-gold text-gold"
                    : "border-white/10 text-muted"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted mb-2">Focus level</p>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setFocus(n)}
                className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2 ${
                  focus === n ? "border-gold" : "border-white/10"
                }`}
              >
                <span className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < n ? "bg-gold" : "bg-white/20"
                      }`}
                    />
                  ))}
                </span>
                <span className="text-sm text-muted">
                  {n === 1
                    ? "Not focused"
                    : n === 2
                      ? "Barely focused"
                      : n === 3
                        ? "Somewhat focused"
                        : n === 4
                          ? "Focused"
                          : "Deep focus"}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Effectiveness {effectiveness}/10</p>
          <input
            type="range"
            min={0}
            max={10}
            value={effectiveness}
            onChange={(e) => setEffectiveness(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="w-full gold-gradient text-black font-bold py-3 rounded-xl"
        >
          Log Relief
        </button>
      </div>
    </div>
  );
}
