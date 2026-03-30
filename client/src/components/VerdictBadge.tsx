import { SimulationResult } from "@/lib/simulation";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { useState } from "react";

interface Props {
  result: SimulationResult;
}

export function VerdictBadge({ result }: Props) {
  const { viable, verdict, confidencePercent, minSOC, emergencyMinutes, modelCaveats, extrapolationWarning } = result;
  const [showCaveats, setShowCaveats] = useState(false);

  let color: string;
  let bgClass: string;
  let Icon: typeof CheckCircle2;

  if (viable && minSOC > 0.2) {
    color = "text-emerald-400";
    bgClass = "bg-emerald-950/60 border-emerald-700/50";
    Icon = CheckCircle2;
  } else if (viable || minSOC > 0.05) {
    color = "text-amber-400";
    bgClass = "bg-amber-950/60 border-amber-700/50";
    Icon = AlertTriangle;
  } else {
    color = "text-red-400";
    bgClass = "bg-red-950/60 border-red-700/50";
    Icon = XCircle;
  }

  return (
    <div className="space-y-1.5" data-testid="verdict-badge">
      <div className={`flex items-center gap-2 md:gap-3 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg border ${bgClass}`}>
        <Icon className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${color}`} />
        <div className="flex flex-col min-w-0 flex-1">
          <span className={`text-xs md:text-sm font-semibold truncate ${color}`}>{verdict}</span>
          <span className="text-[10px] md:text-xs text-muted-foreground truncate">
            <span className="hidden md:inline">Confidence: </span>{confidencePercent.toFixed(0)}%
            <span className="hidden md:inline"> · Min SOC: {(minSOC * 100).toFixed(1)}%</span>
            <span className="md:hidden"> · {(minSOC * 100).toFixed(0)}%</span>
            {emergencyMinutes > 0 && <span className="hidden md:inline"> · Backup: {emergencyMinutes.toFixed(0)}min</span>}
          </span>
        </div>
        {modelCaveats.length > 0 && (
          <button
            onClick={() => setShowCaveats(!showCaveats)}
            className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
            data-testid="toggle-caveats"
            title={showCaveats ? "Hide model notes" : "Show model notes"}
          >
            <Info className={`w-3.5 h-3.5 ${extrapolationWarning ? 'text-amber-400' : 'text-muted-foreground'}`} />
          </button>
        )}
      </div>

      {/* Model Caveats Panel */}
      {showCaveats && modelCaveats.length > 0 && (
        <div className="rounded-lg border border-amber-700/30 bg-amber-950/30 px-3 py-2 space-y-1.5">
          <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
            Model Notes
          </div>
          {modelCaveats.map((caveat, i) => (
            <div key={i} className="flex gap-2 text-[10px] md:text-xs text-amber-200/70">
              <span className="text-amber-500 shrink-0 mt-0.5">•</span>
              <span>{caveat}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
