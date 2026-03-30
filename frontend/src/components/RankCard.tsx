import { Shield } from "lucide-react";

type Props = {
  title: string;
  xp: number;
  level: number;
  nextTitle: string | null;
  progressPct: number;
};

export function RankCard({ title, xp, level, nextTitle, progressPct }: Props) {
  return (
    <div className="card text-center">
      <div className="flex flex-col items-center gap-1 mb-3">
        <div className="flex items-center justify-center gap-2 text-gold">
          <Shield className="w-5 h-5 shrink-0" />
          <span className="font-semibold">Rank</span>
        </div>
        <span className="text-muted text-sm">Lvl {level}</span>
      </div>
      <p className="text-xl font-bold text-white mb-1">{title}</p>
      <p className="text-gold text-sm mb-3">{xp} pts</p>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden w-full">
        <div
          className="h-full gold-gradient rounded-full transition-all"
          style={{ width: `${Math.min(100, progressPct)}%` }}
        />
      </div>
      {nextTitle && (
        <p className="text-muted text-xs mt-2">
          {progressPct}% to {nextTitle}
        </p>
      )}
    </div>
  );
}
