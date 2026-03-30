import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPostQueued } from "@/lib/api";
import { usePending } from "@/App";
import { useBadgeUnlock } from "@/context/BadgeUnlockContext";
import { badgesUnlockedFromResponse } from "@/lib/badgeUnlockPayload";
import { DashboardHeader } from "@/components/DashboardHeader";

const moodEmoji = (n: number) =>
  ["😫", "😢", "😟", "😕", "😐", "🙂", "😊", "😄", "😁", "😄", "😆"][Math.min(10, Math.max(0, n))];

export function CheckinPage() {
  const nav = useNavigate();
  const { refreshPending } = usePending();
  const { announceUnlocks } = useBadgeUnlock();
  const [score, setScore] = useState(7);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await apiPostQueued<Record<string, unknown>>(
        "/v1/checkins",
        { mood_score: score },
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
      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">How do you feel?</h2>
          <p className="text-muted text-sm">Rate your current mood</p>
        </div>
        <div className="text-center text-6xl py-2">{moodEmoji(score)}</div>
        <div className="text-center text-4xl font-bold text-gold">{score}</div>
        <div className="px-1">
          <input
            type="range"
            min={0}
            max={10}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-muted">
            <span>Rough</span>
            <span>Great</span>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="w-full gold-gradient text-black font-bold py-3 rounded-xl disabled:opacity-50"
        >
          Log Check-in
        </button>
      </div>
    </div>
  );
}
