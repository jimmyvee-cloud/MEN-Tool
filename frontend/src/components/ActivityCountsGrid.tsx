import { Brain, Leaf, Zap } from "lucide-react";

export type ActivityCounts = { checkins: number; stressors: number; reliefs: number };

type Props = {
  counts: ActivityCounts | null;
  /** e.g. "All time" on profile, "Today" on dashboard */
  scopeLabel: string;
  /** When true, show placeholders until data is ready */
  loading?: boolean;
};

export function ActivityCountsGrid({ counts, scopeLabel, loading }: Props) {
  const showPlaceholders = loading && counts == null;
  const c = counts ?? { checkins: 0, stressors: 0, reliefs: 0 };

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-muted text-center">{scopeLabel}</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="card text-center py-3">
          <Brain className="w-6 h-6 mx-auto text-blue-400 mb-1" />
          <div className="text-lg font-bold tabular-nums">
            {showPlaceholders ? "—" : c.checkins}
          </div>
          <div className="text-[10px] text-muted uppercase">Check-ins</div>
        </div>
        <div className="card text-center py-3">
          <Zap className="w-6 h-6 mx-auto text-gold mb-1" />
          <div className="text-lg font-bold tabular-nums">
            {showPlaceholders ? "—" : c.stressors}
          </div>
          <div className="text-[10px] text-muted uppercase">Stressors</div>
        </div>
        <div className="card text-center py-3">
          <Leaf className="w-6 h-6 mx-auto text-emerald-400 mb-1" />
          <div className="text-lg font-bold tabular-nums">
            {showPlaceholders ? "—" : c.reliefs}
          </div>
          <div className="text-[10px] text-muted uppercase">Reliefs</div>
        </div>
      </div>
    </div>
  );
}
