import { SimulationResult } from "@/lib/simulation";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface Props {
  result: SimulationResult;
}

export function VerdictBadge({ result }: Props) {
  const { viable, verdict, confidencePercent, minSOC, emergencyMinutes } = result;

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
    <div className={`flex items-center gap-2 md:gap-3 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg border ${bgClass}`} data-testid="verdict-badge">
      <Icon className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${color}`} />
      <div className="flex flex-col min-w-0">
        <span className={`text-xs md:text-sm font-semibold truncate ${color}`}>{verdict}</span>
        <span className="text-[10px] md:text-xs text-muted-foreground truncate">
          <span className="hidden md:inline">Confidence: </span>{confidencePercent.toFixed(0)}%
          <span className="hidden md:inline"> · Min SOC: {(minSOC * 100).toFixed(1)}%</span>
          <span className="md:hidden"> · {(minSOC * 100).toFixed(0)}%</span>
          {emergencyMinutes > 0 && <span className="hidden md:inline"> · Backup: {emergencyMinutes.toFixed(0)}min</span>}
        </span>
      </div>
    </div>
  );
}
