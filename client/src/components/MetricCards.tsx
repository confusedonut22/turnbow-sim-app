import { SimulationResult, SimulationConfig } from "@/lib/simulation";
import { Card } from "@/components/ui/card";
import {
  Zap,
  Sun,
  Battery,
  Activity,
  Gauge,
  TrendingUp,
  Wifi,
  ThermometerSun,
  Plug,
  Radio,
  Clock,
} from "lucide-react";

interface Props {
  result: SimulationResult;
  config: SimulationConfig;
}

function Metric({
  label,
  value,
  unit,
  icon: Icon,
  color = "text-foreground",
}: {
  label: string;
  value: string;
  unit: string;
  icon: typeof Zap;
  color?: string;
}) {
  return (
    <Card className="p-2 md:p-3 flex items-start gap-2 md:gap-3 bg-card/50 border-card-border">
      <div className={`mt-0.5 ${color}`}>
        <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] md:text-xs text-muted-foreground truncate">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span
            className={`text-sm md:text-base font-semibold tabular-nums ${color}`}
          >
            {value}
          </span>
          <span className="text-[10px] md:text-xs text-muted-foreground">
            {unit}
          </span>
        </div>
      </div>
    </Card>
  );
}

function SectionLabel({
  icon: Icon,
  label,
  sublabel,
}: {
  icon: typeof Plug;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex items-center gap-2 col-span-2 md:col-span-4 pt-1 first:pt-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] md:text-xs font-semibold text-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-[10px] md:text-[11px] text-muted-foreground hidden md:inline">
        — {sublabel}
      </span>
    </div>
  );
}

/** Format µW smartly: show mW if > 1000 */
function fmtPower(uw: number): { value: string; unit: string } {
  if (Math.abs(uw) >= 1000) {
    return { value: (uw / 1000).toFixed(2), unit: "mW" };
  }
  return { value: uw.toFixed(0), unit: "µW" };
}

export function MetricCards({ result, config }: Props) {
  const netPower = result.totalHarvest - result.consumptionPower;
  const netColor =
    netPower > 100
      ? "text-emerald-400"
      : netPower > 0
        ? "text-amber-400"
        : "text-red-400";

  const solarPeak = fmtPower(result.solarPower);
  const solarAvg = fmtPower(result.solarDailyAvg);

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-2"
      data-testid="metric-cards"
    >
      {/* ── Power Source ── */}
      <SectionLabel
        icon={Plug}
        label="Power Source"
        sublabel="Fundamental 60 Hz stray flux + solar"
      />
      <Metric
        label="Harvest (Mag)"
        value={result.harvestPower.toFixed(0)}
        unit="µW"
        icon={Zap}
        color="text-emerald-400"
      />
      <Metric
        label={`Solar (peak ${config.solarLux} lux)`}
        value={solarPeak.value}
        unit={solarPeak.unit}
        icon={Sun}
        color="text-yellow-400"
      />
      <Metric
        label={`Solar (24h avg)`}
        value={solarAvg.value}
        unit={solarAvg.unit}
        icon={Clock}
        color="text-yellow-500"
      />
      <Metric
        label="Consumption"
        value={result.consumptionPower.toFixed(0)}
        unit="µW"
        icon={Wifi}
        color="text-orange-400"
      />
      <Metric
        label="Net Power"
        value={(netPower > 0 ? "+" : "") + netPower.toFixed(0)}
        unit="µW"
        icon={Battery}
        color={netColor}
      />
      <Metric
        label="Min SOC (24h)"
        value={(result.minSOC * 100).toFixed(1)}
        unit="%"
        icon={ThermometerSun}
        color={
          result.minSOC > 0.2
            ? "text-emerald-400"
            : result.minSOC > 0.05
              ? "text-amber-400"
              : "text-red-400"
        }
      />
      <Metric
        label="Peak Flux"
        value={result.peakFluxAtMount.toFixed(1)}
        unit="µT"
        icon={Activity}
        color="text-blue-400"
      />

      {/* ── Monitored Signal ── */}
      <SectionLabel
        icon={Radio}
        label="Monitored Signal"
        sublabel="Harmonic content detected by sensing coil"
      />
      <Metric
        label="THD"
        value={result.thd.toFixed(1)}
        unit="%"
        icon={Gauge}
        color={result.thd > 15 ? "text-amber-400" : "text-emerald-400"}
      />
      <Metric
        label="K-Factor"
        value={result.kFactor.toFixed(2)}
        unit=""
        icon={TrendingUp}
        color={result.kFactor > 4 ? "text-red-400" : "text-foreground"}
      />
    </div>
  );
}
