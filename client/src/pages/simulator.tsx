import { useState } from "react";
import { useSimulation } from "@/hooks/useSimulation";
import { ControlPanel } from "@/components/ControlPanel";
import { ChartPanel } from "@/components/ChartPanel";
import { VerdictBadge } from "@/components/VerdictBadge";
import { MetricCards } from "@/components/MetricCards";
import { TransformerScene } from "@/components/TransformerScene";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Zap, SlidersHorizontal } from "lucide-react";

export default function Simulator() {
  const { config, result, updateConfig, resetConfig } = useSimulation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-border bg-card/50 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs md:text-sm font-semibold tracking-tight truncate">Turnbow Power Viability Simulator</h1>
            <p className="text-[10px] text-muted-foreground hidden md:block">
              Externally Mounted Self-Powered Transformer Harmonic Monitor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile: parameters drawer trigger */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden h-8 text-xs gap-1.5" data-testid="open-params">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Params
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] p-0 overflow-hidden">
              <SheetHeader className="px-4 pt-4 pb-2">
                <SheetTitle className="text-sm">Parameters</SheetTitle>
              </SheetHeader>
              <div className="h-[calc(100%-3.5rem)] overflow-hidden">
                <ControlPanel config={config} onChange={updateConfig} onReset={resetConfig} />
              </div>
            </SheetContent>
          </Sheet>

          <VerdictBadge result={result} />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Desktop sidebar - hidden on mobile */}
        <aside className="hidden md:block w-[300px] shrink-0 border-r border-border bg-card/30">
          <ControlPanel config={config} onChange={updateConfig} onReset={resetConfig} />
        </aside>

        {/* Main area — scrollable on mobile, flex on desktop */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto md:overflow-hidden">
          {/* 3D Scene */}
          <div className="h-[180px] md:flex-1 shrink-0 md:shrink md:min-h-0 p-2 md:p-3">
            <div className="h-full rounded-lg overflow-hidden border border-border">
              <TransformerScene config={config} result={result} />
            </div>
          </div>

          {/* Metrics */}
          <div className="px-2 md:px-3 pb-2 md:pb-3">
            <MetricCards result={result} />
          </div>

          {/* Charts */}
          <div className="min-h-[420px] md:h-[280px] md:min-h-0 shrink-0 border-t border-border bg-card/30">
            <ChartPanel result={result} />
          </div>
        </main>
      </div>
    </div>
  );
}
