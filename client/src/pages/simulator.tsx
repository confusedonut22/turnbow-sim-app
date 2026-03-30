import { lazy, Suspense } from "react";
import { useSimulation } from "@/hooks/useSimulation";
import { ControlPanel } from "@/components/ControlPanel";
import { ChartPanel } from "@/components/ChartPanel";
import { VerdictBadge } from "@/components/VerdictBadge";
import { MetricCards } from "@/components/MetricCards";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Zap, Box, Loader2 } from "lucide-react";

const TransformerScene = lazy(() =>
  import("@/components/TransformerScene").then((m) => ({
    default: m.TransformerScene,
  }))
);

function Scene3DFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#111] text-muted-foreground">
      <div className="text-center space-y-2">
        <Box className="w-10 h-10 mx-auto opacity-30" />
        <p className="text-sm">3D View requires WebGL</p>
        <p className="text-xs opacity-60">Open in a browser with GPU support</p>
      </div>
    </div>
  );
}

function Scene3DLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#111] text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}

export default function Simulator() {
  const { config, result, updateConfig, resetConfig } = useSimulation();

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">Turnbow Power Viability Simulator</h1>
            <p className="text-[10px] text-muted-foreground">
              Externally Mounted Self-Powered Transformer Harmonic Monitor
            </p>
          </div>
        </div>
        <VerdictBadge result={result} />
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar - controls */}
        <aside className="w-[300px] shrink-0 border-r border-border bg-card/30">
          <ControlPanel config={config} onChange={updateConfig} onReset={resetConfig} />
        </aside>

        {/* Right main area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Top: 3D Scene + Metrics */}
          <div className="flex-1 min-h-0 flex flex-col p-3 gap-3">
            {/* 3D view */}
            <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border">
              <ErrorBoundary fallback={<Scene3DFallback />}>
                <Suspense fallback={<Scene3DLoader />}>
                  <TransformerScene config={config} result={result} />
                </Suspense>
              </ErrorBoundary>
            </div>
            {/* Metrics */}
            <MetricCards result={result} />
          </div>

          {/* Bottom: Charts */}
          <div className="h-[280px] shrink-0 border-t border-border bg-card/30">
            <ChartPanel result={result} />
          </div>
        </main>
      </div>
    </div>
  );
}
