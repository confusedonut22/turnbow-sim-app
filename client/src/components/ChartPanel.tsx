import { useState } from "react";
import { SimulationResult } from "@/lib/simulation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ComposedChart,
} from "recharts";

interface Props {
  result: SimulationResult;
}

// ── Waveform + Spectrum ─────────────────────────────────────────────────────

function WaveformChart({ result }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 h-full overflow-y-auto md:overflow-hidden">
      {/* Waveform */}
      <div className="flex flex-col min-h-[140px]">
        <h4 className="text-xs font-medium text-muted-foreground mb-1 px-1">
          Sensed Waveform — What the Device Reports
        </h4>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.waveformData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }}
                tickFormatter={(v: number) => `${v.toFixed(0)}`}
                interval={31}
                label={{ value: "ms", position: "insideBottomRight", offset: -5, fontSize: 10, fill: "hsl(0 0% 50%)" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }}
                tickFormatter={(v: number) => `${v.toFixed(1)}`}
                label={{ value: "mV", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "hsl(0 0% 50%)" }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "6px", fontSize: 11 }}
                labelFormatter={(v: number) => `${v.toFixed(2)} ms`}
                formatter={(v: number) => [`${v.toFixed(3)} mV`, "Voltage"]}
              />
              <ReferenceLine y={0} stroke="hsl(0 0% 30%)" />
              <Line type="monotone" dataKey="voltage" stroke="hsl(221 83% 60%)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Spectrum */}
      <div className="flex flex-col min-h-[140px]">
        <h4 className="text-xs font-medium text-muted-foreground mb-1 px-1">
          Harmonic Spectrum (THD: {result.thd.toFixed(1)}%)
        </h4>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={result.spectrumData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
              <XAxis
                dataKey="harmonic"
                tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }}
                label={{ value: "Harmonic #", position: "insideBottomRight", offset: -5, fontSize: 10, fill: "hsl(0 0% 50%)" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }}
                label={{ value: "Amplitude", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "hsl(0 0% 50%)" }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "6px", fontSize: 11 }}
                formatter={(v: number) => [`${v.toFixed(4)}`, "Amplitude"]}
              />
              <Bar
                dataKey="amplitude"
                fill="hsl(262 83% 58%)"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Energy Timeline ─────────────────────────────────────────────────────────

function EnergyTimeline({ result }: Props) {
  const data = result.energyTimeline.map((d) => ({
    ...d,
    harvestUW: d.harvestMW,
    consumeUW: d.consumeMW,
    socPct: d.soc * 100,
  }));

  return (
    <div className="flex flex-col h-full">
      <h4 className="text-xs font-medium text-muted-foreground mb-1 px-1">
        24h Harvest (60 Hz Flux + Solar) vs Consumption
      </h4>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }}
              tickFormatter={(v: number) => `${Math.floor(v)}:00`}
              label={{ value: "Hour", position: "insideBottomRight", offset: -5, fontSize: 10, fill: "hsl(0 0% 50%)" }}
            />
            <YAxis
              yAxisId="power"
              tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }}
              label={{ value: "µW", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "hsl(0 0% 50%)" }}
            />
            <YAxis
              yAxisId="soc"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }}
              label={{ value: "SOC %", angle: 90, position: "insideRight", offset: 10, fontSize: 10, fill: "hsl(0 0% 50%)" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "6px", fontSize: 11 }}
              labelFormatter={(v: number) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`}
              formatter={(v: number, name: string) => {
                if (name === "socPct") return [`${v.toFixed(1)}%`, "SOC"];
                return [`${v.toFixed(0)} µW`, name === "harvestUW" ? "Harvest" : "Consume"];
              }}
            />
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="harvestUW"
              fill="hsl(142 70% 35% / 0.3)"
              stroke="hsl(142 70% 50%)"
              strokeWidth={1.5}
              name="harvestUW"
            />
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="consumeUW"
              fill="hsl(27 87% 45% / 0.3)"
              stroke="hsl(27 87% 60%)"
              strokeWidth={1.5}
              name="consumeUW"
            />
            <Line
              yAxisId="soc"
              type="monotone"
              dataKey="socPct"
              stroke="hsl(221 83% 65%)"
              strokeWidth={2}
              dot={false}
              name="socPct"
            />
            <ReferenceLine yAxisId="soc" y={20} stroke="hsl(43 74% 50%)" strokeDasharray="5 5" label={{ value: "Min safe", position: "right", fontSize: 9, fill: "hsl(43 74% 50%)" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Load Profile ────────────────────────────────────────────────────────────

function LoadProfile({ result }: Props) {
  const data = result.energyTimeline.map((d) => ({
    hour: d.hour,
    loadPct: d.loadPercent,
    socPct: d.soc * 100,
  }));

  return (
    <div className="flex flex-col h-full">
      <h4 className="text-xs font-medium text-muted-foreground mb-1 px-1">
        Load & SOC Over 24 Hours
      </h4>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }}
              tickFormatter={(v: number) => `${Math.floor(v)}:00`}
            />
            <YAxis
              domain={[0, 150]}
              tick={{ fontSize: 10, fill: "hsl(0 0% 50%)" }}
              label={{ value: "%", angle: -90, position: "insideLeft", offset: 10, fontSize: 10, fill: "hsl(0 0% 50%)" }}
            />
            <Tooltip
              contentStyle={{ backgroundColor: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "6px", fontSize: 11 }}
              labelFormatter={(v: number) => `${Math.floor(v)}:00`}
            />
            <Area
              type="monotone"
              dataKey="loadPct"
              fill="hsl(262 83% 48% / 0.2)"
              stroke="hsl(262 83% 60%)"
              strokeWidth={1.5}
              name="Load %"
            />
            <Line
              type="monotone"
              dataKey="socPct"
              stroke="hsl(221 83% 65%)"
              strokeWidth={2}
              dot={false}
              name="SOC %"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main Tab Panel ──────────────────────────────────────────────────────────

export function ChartPanel({ result }: Props) {
  return (
    <Tabs defaultValue="waveform" className="h-full flex flex-col" data-testid="chart-panel">
      <TabsList className="w-fit mx-2 mb-1 mt-1">
        <TabsTrigger value="waveform" className="text-[11px] md:text-xs px-2 md:px-3">Monitored Signal</TabsTrigger>
        <TabsTrigger value="energy" className="text-[11px] md:text-xs px-2 md:px-3">Power Source</TabsTrigger>
        <TabsTrigger value="load" className="text-[11px] md:text-xs px-2 md:px-3">Load &amp; SOC</TabsTrigger>
      </TabsList>
      <div className="flex-1 min-h-0 px-2 pb-2">
        <TabsContent value="waveform" className="h-full mt-0">
          <WaveformChart result={result} />
        </TabsContent>
        <TabsContent value="energy" className="h-full mt-0">
          <EnergyTimeline result={result} />
        </TabsContent>
        <TabsContent value="load" className="h-full mt-0">
          <LoadProfile result={result} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
