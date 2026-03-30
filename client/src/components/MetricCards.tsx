import { SimulationResult } from "@/lib/simulation";
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
} from "lucide-react";

interface Props {
  result: SimulationResult;
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
    <Card className="p-3 flex items-start gap-3 bg-card/50 border-card-border">
      <div className={`mt-0.5 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className={`text-base font-semibold tabular-nums ${color}`}>{value}</span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
    </Card>
  );
}

export function MetricCards({ result }: Props) {
  const netPower = result.totalHarvest - result.consumptionPower;
  const netColor =
    netPower > 100 ? "text-emerald-400" : netPower > 0 ? "text-amber-400" : "text-red-400";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="metric-cards">
      <Metric
        label="Peak Flux"
        value={result.peakFluxAtMount.toFixed(1)}
        unit="µT"
        icon={Activity}
        color="text-blue-400"
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
      <Metric
        label="Harvest (Mag)"
        value={result.harvestPower.toFixed(0)}
        unit="µW"
        icon={Zap}
        color="text-emerald-400"
      />
      <Metric
        label="Harvest (Solar)"
        value={result.solarPower.toFixed(0)}
        unit="µW"
        icon={Sun}
        color="text-yellow-400"
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
        label="Min SOC"
        value={(result.minSOC * 100).toFixed(1)}
        unit="%"
        icon={ThermometerSun}
        color={result.minSOC > 0.2 ? "text-emerald-400" : result.minSOC > 0.05 ? "text-amber-400" : "text-red-400"}
      />
    </div>
  );
}
