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
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${bgClass}`} data-testid="verdict-badge">
      <Icon className={`w-5 h-5 ${color}`} />
      <div className="flex flex-col">
        <span className={`text-sm font-semibold ${color}`}>{verdict}</span>
        <span className="text-xs text-muted-foreground">
          Confidence: {confidencePercent.toFixed(0)}% · Min SOC: {(minSOC * 100).toFixed(1)}%
          {emergencyMinutes > 0 && ` · Backup: ${emergencyMinutes.toFixed(0)}min`}
        </span>
      </div>
    </div>
  );
}
