import { useState, useMemo, useCallback } from "react";
import {
  SimulationConfig,
  SimulationResult,
  getDefaultConfig,
  runSimulation,
} from "@/lib/simulation";

export function useSimulation() {
  const [config, setConfig] = useState<SimulationConfig>(getDefaultConfig());

  const result: SimulationResult = useMemo(() => runSimulation(config), [config]);

  const updateConfig = useCallback(
    (patch: Partial<SimulationConfig>) => {
      setConfig((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const resetConfig = useCallback(() => {
    setConfig(getDefaultConfig());
  }, []);

  return { config, result, updateConfig, resetConfig };
}
