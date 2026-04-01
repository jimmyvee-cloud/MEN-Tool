import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { apiJson, apiPostQueued } from "@/lib/api";
import { usePending } from "@/App";
import { useBadgeUnlock } from "@/context/BadgeUnlockContext";
import { badgesUnlockedFromResponse } from "@/lib/badgeUnlockPayload";
import { DashboardHeader } from "@/components/DashboardHeader";

type Preset = {
  preset_id: string;
  title: string;
  category: string;
  duration_seconds: number;
  youtube_url?: string;
  preset_entity: string;
};

export function ReliefPresetPage() {
  const { presetId } = useParams();
  const nav = useNavigate();
  const { refreshPending } = usePending();
  const { announceUnlocks } = useBadgeUnlock();
  const [preset, setPreset] = useState<Preset | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [effectiveness, setEffectiveness] = useState(7);
  const [focus, setFocus] = useState(4);

  useEffect(() => {
    if (!presetId) return;
    apiJson<Preset>(`/v1/presets/${presetId}`)
      .then((p) => {
        setPreset(p);
        setRemaining(p.duration_seconds || 300);
      })
      .catch(() => setPreset(null));
  }, [presetId]);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const t = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [running, remaining]);

  const youtubeId = (() => {
    const u = preset?.youtube_url;
    if (!u) return null;
    try {
      const url = new URL(u);
      if (url.hostname.includes("youtu.be")) return url.pathname.replace("/", "").slice(0, 11);
      const embed = url.pathname.match(/^\/embed\/([^/?]+)/);
      if (embed?.[1]) return embed[1].slice(0, 11);
      return url.searchParams.get("v");
    } catch {
      return null;
    }
  })();

  async function logPreset() {
    if (!preset) return;
    const res = await apiPostQueued<Record<string, unknown>>(
      "/v1/reliefs",
      {
        title: preset.title,
        category: preset.category,
        duration_seconds: Math.max(1, (preset.duration_seconds || 300) - remaining),
        effectiveness,
        focus,
        preset_id: preset.preset_id,
        youtube_url: preset.youtube_url || "",
      },
      refreshPending
    );
    if (res) {
      const buds = badgesUnlockedFromResponse(res);
      if (buds.length) announceUnlocks(buds);
    }
    nav("/relievers");
  }

  if (!preset) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6">
        <DashboardHeader />
        <p className="text-muted mt-4">Loading preset…</p>
      </div>
    );
  }

  const mins = Math.floor(Math.max(0, remaining) / 60);
  const secs = Math.max(0, remaining) % 60;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4 pb-10">
      <DashboardHeader />
      <div className="flex items-center gap-2">
        <Link
          to="/relievers"
          className="text-muted p-1 rounded-lg hover:bg-white/5"
          aria-label="Back to Relievers"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold text-white">{preset.title}</h1>
      </div>
      {youtubeId && (
        <div className="aspect-video rounded-xl overflow-hidden border border-white/10">
          <iframe
            title="relief"
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      )}
      <div className="card text-center space-y-3">
        <p className="text-4xl font-mono text-gold">
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </p>
        {!running ? (
          <button
            type="button"
            onClick={() => setRunning(true)}
            className="w-full gold-gradient text-black font-bold py-3 rounded-xl"
          >
            Start
          </button>
        ) : remaining <= 0 ? (
          <p className="text-emerald-400 text-sm">Timer complete — rate below</p>
        ) : null}
      </div>
      <div className="card space-y-3">
        <p className="text-sm text-muted">Effectiveness {effectiveness}/10</p>
        <input
          type="range"
          min={0}
          max={10}
          value={effectiveness}
          onChange={(e) => setEffectiveness(Number(e.target.value))}
          className="w-full"
        />
        <p className="text-sm text-muted">Focus {focus}/10</p>
        <input
          type="range"
          min={0}
          max={10}
          value={focus}
          onChange={(e) => setFocus(Number(e.target.value))}
          className="w-full"
        />
        <button
          type="button"
          onClick={() => void logPreset()}
          className="w-full gold-gradient text-black font-bold py-3 rounded-xl"
        >
          Log relief
        </button>
      </div>
    </div>
  );
}
