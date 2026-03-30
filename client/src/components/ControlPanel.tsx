import {
  SimulationConfig,
  EnvironmentPreset,
  ConsumptionPreset,
  applyEnvironmentPreset,
  applyConsumptionPreset,
} from "@/lib/simulation";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Box,
  Crosshair,
  Cpu,
  Zap,
  Sun,
  Wifi,
  RotateCcw,
  MapPin,
  Gauge,
} from "lucide-react";

interface Props {
  config: SimulationConfig;
  onChange: (patch: Partial<SimulationConfig>) => void;
  onReset: () => void;
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Box;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="w-4 h-4 text-primary" />
        {title}
      </div>
      <div className="space-y-3 pl-6">{children}</div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono tabular-nums text-foreground">
          {value} {unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
        data-testid={`slider-${label.toLowerCase().replace(/\s/g, "-")}`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="h-8 text-xs"
          data-testid={`select-${label.toLowerCase().replace(/\s/g, "-")}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Format lux value for display */
function fmtLux(lux: number): string {
  if (lux >= 1000) return `${(lux / 1000).toFixed(0)}k`;
  return String(lux);
}

/** Format time like "7:00 AM" */
function fmtHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:00 ${ampm}`;
}

export function ControlPanel({ config, onChange, onReset }: Props) {
  const isCustomEnv = config.environmentPreset === "custom";
  const isCustomConsumption = config.consumptionPreset === "custom";

  const handleEnvironmentChange = (preset: string) => {
    const p = preset as EnvironmentPreset;
    onChange(applyEnvironmentPreset(p));
  };

  const handleConsumptionChange = (preset: string) => {
    const p = preset as ConsumptionPreset;
    onChange(applyConsumptionPreset(p));
  };

  /** When a solar/env field changes manually, switch to custom */
  const envField = (patch: Partial<SimulationConfig>) => {
    onChange({ ...patch, environmentPreset: "custom" as EnvironmentPreset });
  };

  /** When a consumption field changes manually, switch to custom */
  const conField = (patch: Partial<SimulationConfig>) => {
    onChange({ ...patch, consumptionPreset: "custom" as ConsumptionPreset });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5" data-testid="control-panel">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Parameters</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 text-xs gap-1"
            data-testid="reset-button"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        </div>

        <Separator />

        {/* ── Environment Preset ── */}
        <Section title="Environment" icon={MapPin}>
          <SelectField
            label="Preset"
            value={config.environmentPreset}
            options={[
              { value: "indoor-electrical", label: "Indoor Electrical Room" },
              { value: "outdoor-pad", label: "Outdoor Pad-Mount" },
              { value: "underground-vault", label: "Underground Vault" },
              { value: "custom", label: "Custom" },
            ]}
            onChange={handleEnvironmentChange}
          />

          {/* Environment info badge */}
          {!isCustomEnv && (
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {fmtLux(config.solarLux)} lux
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {config.solarHoursPerDay}h/day
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {config.ambientTemp}°C
              </Badge>
            </div>
          )}
        </Section>

        <Separator />

        {/* ── Solar Exposure ── */}
        <Section title="Solar Exposure" icon={Sun}>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Solar Cell</Label>
            <Switch
              checked={config.hasSolarCell}
              onCheckedChange={(v) => envField({ hasSolarCell: v })}
              data-testid="switch-solar"
            />
          </div>
          {config.hasSolarCell && (
            <>
              <SliderField
                label="Cell Area"
                value={config.solarCellArea}
                min={1}
                max={20}
                step={1}
                unit="cm²"
                onChange={(v) => onChange({ solarCellArea: v })}
              />
              <SliderField
                label="Lux Level"
                value={config.solarLux}
                min={0}
                max={120000}
                step={config.solarLux >= 1000 ? 1000 : 50}
                unit="lux"
                onChange={(v) => envField({ solarLux: v })}
              />
              <SliderField
                label="Exposure Hours"
                value={config.solarHoursPerDay}
                min={0}
                max={24}
                step={0.5}
                unit="h/day"
                onChange={(v) => envField({ solarHoursPerDay: v })}
              />
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    Light Start
                  </Label>
                  <span className="text-xs font-mono tabular-nums text-foreground">
                    {fmtHour(config.solarStartHour)}
                  </span>
                </div>
                <Slider
                  value={[config.solarStartHour]}
                  min={0}
                  max={23}
                  step={1}
                  onValueChange={([v]) => envField({ solarStartHour: v })}
                  className="w-full"
                  data-testid="slider-light-start"
                />
              </div>
              {/* Solar wattage conversion readout */}
              <div className="rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Peak solar output</span>
                  <span className="font-mono text-yellow-400">
                    {(
                      config.solarCellArea *
                      config.solarLux *
                      1.5e-7 *
                      1e6
                    ).toFixed(1)}{" "}
                    µW
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Window</span>
                  <span className="font-mono">
                    {fmtHour(config.solarStartHour)} –{" "}
                    {fmtHour(
                      (config.solarStartHour + config.solarHoursPerDay) % 24
                    )}
                  </span>
                </div>
              </div>
            </>
          )}
        </Section>

        <Separator />

        {/* ── Consumption / Duty Cycle ── */}
        <Section title="Consumption" icon={Gauge}>
          <SelectField
            label="Mode"
            value={config.consumptionPreset}
            options={[
              { value: "low-power", label: "Low Power (5 min sense)" },
              { value: "standard", label: "Standard (1 min sense)" },
              { value: "continuous", label: "Continuous (5 sec sense)" },
              { value: "custom", label: "Custom Duty Cycle" },
            ]}
            onChange={handleConsumptionChange}
          />

          {/* Show details for non-custom, or sliders for custom */}
          {!isCustomConsumption ? (
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Sense {config.senseInterval}s
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                TX {config.transmitInterval}s
              </Badge>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Sleep {config.sleepCurrent} µA
              </Badge>
            </div>
          ) : (
            <>
              <SliderField
                label="Sense Interval"
                value={config.senseInterval}
                min={1}
                max={600}
                step={1}
                unit="s"
                onChange={(v) =>
                  conField({ senseInterval: v })
                }
              />
              <SliderField
                label="Transmit Interval"
                value={config.transmitInterval}
                min={5}
                max={3600}
                step={5}
                unit="s"
                onChange={(v) =>
                  conField({ transmitInterval: v })
                }
              />
              <SliderField
                label="Sleep Current"
                value={config.sleepCurrent}
                min={1}
                max={50}
                step={1}
                unit="µA"
                onChange={(v) =>
                  conField({ sleepCurrent: v })
                }
              />
              <SliderField
                label="Active Current"
                value={config.activeCurrent}
                min={0}
                max={2000}
                step={10}
                unit="µA"
                onChange={(v) =>
                  conField({ activeCurrent: v })
                }
              />
              <div className="text-[10px] text-muted-foreground">
                0 = auto (sub-system budget model)
              </div>
            </>
          )}

          {/* Comms mode (always visible) */}
          <SelectField
            label="Comms Mode"
            value={config.commMode}
            options={[
              { value: "ble-minimal", label: "BLE Minimal" },
              { value: "ble-burst", label: "BLE Burst" },
              { value: "lora", label: "LoRa" },
              { value: "ble-plus-lora", label: "BLE + LoRa" },
            ]}
            onChange={(v) =>
              conField({
                commMode: v as SimulationConfig["commMode"],
              })
            }
          />
        </Section>

        <Separator />

        {/* ── Transformer Geometry ── */}
        <Section title="Transformer" icon={Box}>
          <SelectField
            label="Type"
            value={config.transformerType}
            options={[
              { value: "dry-type", label: "Dry-Type" },
              { value: "oil-immersed", label: "Oil-Immersed" },
            ]}
            onChange={(v) =>
              onChange({
                transformerType: v as SimulationConfig["transformerType"],
              })
            }
          />
          <SelectField
            label="kVA Rating"
            value={String(config.kvaRating)}
            options={[75, 150, 300, 500, 750, 1000, 1500, 2000].map((v) => ({
              value: String(v),
              label: `${v} kVA`,
            }))}
            onChange={(v) => onChange({ kvaRating: Number(v) })}
          />
          <SelectField
            label="Tank Material"
            value={config.tankMaterial}
            options={[
              { value: "mild-steel", label: "Mild Steel" },
              { value: "stainless-steel", label: "Stainless Steel" },
              { value: "aluminum", label: "Aluminum" },
            ]}
            onChange={(v) =>
              onChange({
                tankMaterial: v as SimulationConfig["tankMaterial"],
              })
            }
          />
          <SliderField
            label="Wall Thickness"
            value={config.wallThickness}
            min={2}
            max={8}
            step={0.5}
            unit="mm"
            onChange={(v) => onChange({ wallThickness: v })}
          />
        </Section>

        <Separator />

        {/* ── Mounting ── */}
        <Section title="Mounting" icon={Crosshair}>
          <SelectField
            label="Face"
            value={config.mountingFace}
            options={[
              { value: "front", label: "Front" },
              { value: "side", label: "Side" },
              { value: "top", label: "Top" },
            ]}
            onChange={(v) =>
              onChange({
                mountingFace: v as SimulationConfig["mountingFace"],
              })
            }
          />
          <SliderField
            label="Position X"
            value={config.mountPositionX}
            min={0.05}
            max={0.95}
            step={0.05}
            unit=""
            onChange={(v) => onChange({ mountPositionX: v })}
          />
          <SliderField
            label="Position Y"
            value={config.mountPositionY}
            min={0.05}
            max={0.95}
            step={0.05}
            unit=""
            onChange={(v) => onChange({ mountPositionY: v })}
          />
          <SliderField
            label="Standoff"
            value={config.standoffDistance}
            min={0}
            max={10}
            step={0.5}
            unit="mm"
            onChange={(v) => onChange({ standoffDistance: v })}
          />
          <SelectField
            label="Core Type"
            value={config.coreType}
            options={[
              { value: "u-core", label: "U-Core" },
              { value: "c-core", label: "C-Core" },
              { value: "e-core", label: "E-Core" },
              { value: "rod", label: "Rod" },
            ]}
            onChange={(v) =>
              onChange({ coreType: v as SimulationConfig["coreType"] })
            }
          />
          <SliderField
            label="Pad Permeability"
            value={config.padPermeability}
            min={100}
            max={10000}
            step={100}
            unit="µr"
            onChange={(v) => onChange({ padPermeability: v })}
          />
        </Section>

        <Separator />

        {/* ── Operating Profile ── */}
        <Section title="Operating Profile" icon={Cpu}>
          <SliderField
            label="Load"
            value={config.loadPercent}
            min={0}
            max={150}
            step={5}
            unit="%"
            onChange={(v) => onChange({ loadPercent: v })}
          />
          <SelectField
            label="Harmonic Profile"
            value={config.harmonicProfile}
            options={[
              { value: "linear", label: "Linear (clean)" },
              { value: "vfd-heavy", label: "VFD Heavy" },
              { value: "server-psu", label: "Server PSU" },
              { value: "led-driver", label: "LED Driver" },
              { value: "mixed-nonlinear", label: "Mixed Non-Linear" },
            ]}
            onChange={(v) =>
              onChange({
                harmonicProfile: v as SimulationConfig["harmonicProfile"],
              })
            }
          />
          <SliderField
            label="Ambient Temp"
            value={config.ambientTemp}
            min={0}
            max={55}
            step={1}
            unit="°C"
            onChange={(v) => envField({ ambientTemp: v })}
          />
        </Section>

        <Separator />

        {/* ── Front-End ── */}
        <Section title="Front-End Mode" icon={Cpu}>
          <SelectField
            label="Architecture"
            value={config.frontEndMode}
            options={[
              { value: "shared-coil", label: "Shared Coil" },
              { value: "separate-coils", label: "Separate Coils" },
              { value: "time-multiplexed", label: "Time-Multiplexed" },
            ]}
            onChange={(v) =>
              onChange({
                frontEndMode: v as SimulationConfig["frontEndMode"],
              })
            }
          />
        </Section>

        <Separator />

        {/* ── Energy Storage ── */}
        <Section title="Energy Storage" icon={Zap}>
          <SelectField
            label="Storage"
            value={config.storageType}
            options={[
              { value: "supercap", label: "Supercapacitor" },
              { value: "supercap-plus-battery", label: "Supercap + Battery" },
              { value: "battery-only", label: "Battery Only" },
            ]}
            onChange={(v) =>
              onChange({
                storageType: v as SimulationConfig["storageType"],
              })
            }
          />
          <SliderField
            label="Supercap Size"
            value={config.supercapSize}
            min={0.1}
            max={10}
            step={0.1}
            unit="F"
            onChange={(v) => onChange({ supercapSize: v })}
          />
        </Section>

        <div className="h-4" />
      </div>
    </ScrollArea>
  );
}
