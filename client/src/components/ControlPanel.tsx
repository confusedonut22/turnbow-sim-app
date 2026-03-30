import { SimulationConfig } from "@/lib/simulation";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Box,
  Crosshair,
  Cpu,
  Zap,
  Sun,
  Wifi,
  RotateCcw,
} from "lucide-react";

interface Props {
  config: SimulationConfig;
  onChange: (patch: Partial<SimulationConfig>) => void;
  onReset: () => void;
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Box; children: React.ReactNode }) {
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
        data-testid={`slider-${label.toLowerCase().replace(/\s/g, '-')}`}
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
        <SelectTrigger className="h-8 text-xs" data-testid={`select-${label.toLowerCase().replace(/\s/g, '-')}`}>
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

export function ControlPanel({ config, onChange, onReset }: Props) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5" data-testid="control-panel">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Parameters</h2>
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs gap-1" data-testid="reset-button">
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        </div>

        <Separator />

        {/* Transformer Geometry */}
        <Section title="Transformer" icon={Box}>
          <SelectField
            label="Type"
            value={config.transformerType}
            options={[
              { value: "dry-type", label: "Dry-Type" },
              { value: "oil-immersed", label: "Oil-Immersed" },
            ]}
            onChange={(v) => onChange({ transformerType: v as SimulationConfig["transformerType"] })}
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
            onChange={(v) => onChange({ tankMaterial: v as SimulationConfig["tankMaterial"] })}
          />
          <SliderField
            label="Wall Thickness"
            value={config.wallThickness}
            min={2} max={8} step={0.5}
            unit="mm"
            onChange={(v) => onChange({ wallThickness: v })}
          />
        </Section>

        <Separator />

        {/* Mounting */}
        <Section title="Mounting" icon={Crosshair}>
          <SelectField
            label="Face"
            value={config.mountingFace}
            options={[
              { value: "front", label: "Front" },
              { value: "side", label: "Side" },
              { value: "top", label: "Top" },
            ]}
            onChange={(v) => onChange({ mountingFace: v as SimulationConfig["mountingFace"] })}
          />
          <SliderField
            label="Position X"
            value={config.mountPositionX}
            min={0.05} max={0.95} step={0.05}
            unit=""
            onChange={(v) => onChange({ mountPositionX: v })}
          />
          <SliderField
            label="Position Y"
            value={config.mountPositionY}
            min={0.05} max={0.95} step={0.05}
            unit=""
            onChange={(v) => onChange({ mountPositionY: v })}
          />
          <SliderField
            label="Standoff"
            value={config.standoffDistance}
            min={0} max={10} step={0.5}
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
            onChange={(v) => onChange({ coreType: v as SimulationConfig["coreType"] })}
          />
          <SliderField
            label="Pad Permeability"
            value={config.padPermeability}
            min={100} max={10000} step={100}
            unit="µr"
            onChange={(v) => onChange({ padPermeability: v })}
          />
        </Section>

        <Separator />

        {/* Operating Profile */}
        <Section title="Operating Profile" icon={Cpu}>
          <SliderField
            label="Load"
            value={config.loadPercent}
            min={0} max={150} step={5}
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
            onChange={(v) => onChange({ harmonicProfile: v as SimulationConfig["harmonicProfile"] })}
          />
          <SliderField
            label="Ambient Temp"
            value={config.ambientTemp}
            min={0} max={55} step={1}
            unit="°C"
            onChange={(v) => onChange({ ambientTemp: v })}
          />
          <SliderField
            label="Lighting"
            value={config.lightingLevel}
            min={0} max={1000} step={50}
            unit=" lux"
            onChange={(v) => onChange({ lightingLevel: v })}
          />
        </Section>

        <Separator />

        {/* Front-End */}
        <Section title="Front-End Mode" icon={Cpu}>
          <SelectField
            label="Architecture"
            value={config.frontEndMode}
            options={[
              { value: "shared-coil", label: "Shared Coil" },
              { value: "separate-coils", label: "Separate Coils" },
              { value: "time-multiplexed", label: "Time-Multiplexed" },
            ]}
            onChange={(v) => onChange({ frontEndMode: v as SimulationConfig["frontEndMode"] })}
          />
        </Section>

        <Separator />

        {/* Energy Subsystem */}
        <Section title="Energy" icon={Zap}>
          <SelectField
            label="Storage"
            value={config.storageType}
            options={[
              { value: "supercap", label: "Supercapacitor" },
              { value: "supercap-plus-battery", label: "Supercap + Battery" },
              { value: "battery-only", label: "Battery Only" },
            ]}
            onChange={(v) => onChange({ storageType: v as SimulationConfig["storageType"] })}
          />
          <SliderField
            label="Supercap Size"
            value={config.supercapSize}
            min={0.1} max={10} step={0.1}
            unit="F"
            onChange={(v) => onChange({ supercapSize: v })}
          />
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Solar Cell</Label>
            <Switch
              checked={config.hasSolarCell}
              onCheckedChange={(v) => onChange({ hasSolarCell: v })}
              data-testid="switch-solar"
            />
          </div>
          {config.hasSolarCell && (
            <SliderField
              label="Solar Area"
              value={config.solarCellArea}
              min={1} max={20} step={1}
              unit=" cm²"
              onChange={(v) => onChange({ solarCellArea: v })}
            />
          )}
        </Section>

        <Separator />

        {/* Communication */}
        <Section title="Communication" icon={Wifi}>
          <SelectField
            label="Mode"
            value={config.commMode}
            options={[
              { value: "ble-minimal", label: "BLE Minimal" },
              { value: "ble-burst", label: "BLE Burst" },
              { value: "lora", label: "LoRa" },
              { value: "ble-plus-lora", label: "BLE + LoRa" },
            ]}
            onChange={(v) => onChange({ commMode: v as SimulationConfig["commMode"] })}
          />
          <SliderField
            label="Transmit Interval"
            value={config.transmitInterval}
            min={10} max={3600} step={10}
            unit="s"
            onChange={(v) => onChange({ transmitInterval: v })}
          />
        </Section>

        <div className="h-4" />
      </div>
    </ScrollArea>
  );
}
