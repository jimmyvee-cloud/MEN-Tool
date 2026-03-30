import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPostQueued } from "@/lib/api";
import { usePending } from "@/App";
import { useBadgeUnlock } from "@/context/BadgeUnlockContext";
import { badgesUnlockedFromResponse } from "@/lib/badgeUnlockPayload";
import { DashboardHeader } from "@/components/DashboardHeader";

const cats = [
  { id: "social", label: "Social", emoji: "👥" },
  { id: "physical", label: "Physical", emoji: "💪" },
  { id: "mental", label: "Mental", emoji: "🧠" },
  { id: "emotional", label: "Emotional", emoji: "❤️" },
  { id: "financial", label: "Financial", emoji: "💰" },
  { id: "work", label: "Work", emoji: "💼" },
];

export function StressorPage() {
  const nav = useNavigate();
  const { refreshPending } = usePending();
  const { announceUnlocks } = useBadgeUnlock();
  const [cat, setCat] = useState("social");
  const [title, setTitle] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await apiPostQueued<Record<string, unknown>>(
        "/v1/stressors",
        { title: title.trim(), category: cat, intensity },
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
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
      <DashboardHeader />
      <header>
        <h1 className="text-xl font-bold text-white">Log a Stressor</h1>
        <p className="text-muted text-sm">What&apos;s weighing on you?</p>
      </header>
      <div className="card space-y-4">
        <div>
          <p className="text-xs uppercase text-muted mb-2">Category</p>
          <div className="grid grid-cols-2 gap-2">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`rounded-xl py-3 px-2 text-sm border ${
                  cat === c.id
                    ? "border-gold text-gold bg-gold/10"
                    : "border-white/10 bg-surface text-muted"
                }`}
              >
                <span className="mr-1">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted mb-2">What&apos;s stressing you?</p>
          <input
            className="w-full rounded-xl bg-night border border-white/10 px-4 py-3"
            placeholder="e.g. Work deadline, argument..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Intensity {intensity}/10</p>
          <input
            type="range"
            min={0}
            max={10}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="w-full gold-gradient text-black font-bold py-3 rounded-xl"
        >
          Log Stressor
        </button>
      </div>
    </div>
  );
}
