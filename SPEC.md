# Turnbow Power Device Viability Simulator — Full Specification

## Overview
An interactive browser-based simulator for the Turnbow Power "Externally Mounted, Self-Powered Transformer Harmonic Monitor". The user adjusts transformer parameters, device placement, and operating conditions. The simulator runs physics-based models and shows:
1. A 3D view of the transformer with the device mounted on it, with a flux field heatmap overlay
2. Real-time waveform/FFT plots of the sensed signal
3. Energy budget timeline showing harvest vs consumption and SOC over 24 hours
4. A viability verdict with confidence score

## Device Physics Summary
- The device mounts externally on a transformer tank wall
- It harvests energy from stray magnetic flux leaking through the enclosure surface
- Supplemental power from a small solar cell and backup coin cell battery
- Stray flux is weak (1-2 orders of magnitude less than conductor-clamped CT), spatially non-uniform, and filtered by enclosure eddy currents
- The device senses harmonics through the same flux and computes THD, K-Factor
- BLE-minimal operation: ~150-300 µW average
- Aggressive comms (BLE burst + LoRa): ~500-1000 µW average
- Mounting position can shift coupling by 5x over short distances
- Energy harvesting range: 0.5-10 mW depending on load and mounting position

## Tech Stack
- React + TypeScript + Tailwind + shadcn/ui (already scaffolded)
- Three.js via @react-three/fiber + @react-three/drei for 3D
- Recharts for 2D plots
- All simulation runs client-side in the browser (no backend computation needed)

## Color Theme
Dark mode by default — this is an engineering tool. Use the existing dark theme from index.css. 
Primary accent: electric blue (hsl 221 83% 53%). 
Chart colors: use the existing chart-1 through chart-5 variables.
Add custom CSS variables for simulation-specific colors:
- --sim-harvest: green-ish (hsl 142 70% 45%) for energy harvest
- --sim-consume: orange (hsl 27 87% 55%) for energy consumption
- --sim-danger: red for critical alerts
- --sim-flux-low to --sim-flux-high: blue-to-red gradient for field heatmap

## App Layout
Single page, no routing needed. Layout:
```
┌──────────────────────────────────────────────────────┐
│ Header: "Turnbow Power Viability Simulator" + verdict │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Controls │   3D Transformer View (Three.js Canvas)   │
│ Panel    │   - Rotatable/zoomable                    │
│ (left    │   - Shows transformer box                 │
│  sidebar │   - Shows device puck on surface          │
│  ~320px) │   - Color-coded flux heatmap on surface   │
│          │                                           │
│ Sections:│                                           │
│ -Xformer ├───────────────────────────────────────────┤
│ -Mounting│                                           │
│ -Load    │   Bottom Panel: Charts (3 tabs)           │
│ -FrontEnd│   Tab 1: Waveform + FFT spectrum          │
│ -Energy  │   Tab 2: 24h Energy Timeline (harvest vs  │
│ -Comms   │          consumption + SOC curve)          │
│          │   Tab 3: Summary metrics table             │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

## Simulation Engine (client/src/lib/simulation.ts)

### Input Parameters (SimulationConfig)

```typescript
interface SimulationConfig {
  // Transformer Geometry
  transformerType: 'dry-type' | 'oil-immersed';
  kvaRating: number; // 75, 150, 300, 500, 750, 1000, 1500, 2000
  tankMaterial: 'mild-steel' | 'stainless-steel' | 'aluminum';
  wallThickness: number; // mm, 2-8
  enclosureWidth: number; // cm, 40-150
  enclosureHeight: number; // cm, 50-200
  enclosureDepth: number; // cm, 30-100

  // Mounting / Coupling
  mountingFace: 'front' | 'side' | 'top';
  mountPositionX: number; // 0-1 normalized position on face
  mountPositionY: number; // 0-1 normalized position on face
  standoffDistance: number; // mm, 0-10
  coreType: 'u-core' | 'c-core' | 'e-core' | 'rod';
  padPermeability: number; // relative, 100-10000

  // Operating Profile
  loadPercent: number; // 0-150%
  harmonicProfile: 'linear' | 'vfd-heavy' | 'server-psu' | 'led-driver' | 'mixed-nonlinear';
  ambientTemp: number; // °C
  lightingLevel: number; // lux, 0-1000

  // Front-End Mode
  frontEndMode: 'shared-coil' | 'separate-coils' | 'time-multiplexed';

  // Energy Subsystem
  storageType: 'supercap' | 'supercap-plus-battery' | 'battery-only';
  supercapSize: number; // Farads, 0.1-10
  hasSolarCell: boolean;
  solarCellArea: number; // cm²

  // Communication
  commMode: 'ble-minimal' | 'ble-burst' | 'lora' | 'ble-plus-lora';
  transmitInterval: number; // seconds, 10-3600
}
```

### Physics Models

#### 1. Stray Field Model
Estimate surface flux density based on transformer parameters:
```
B_surface = B_rated * (load% / 100) * leakageFactor * wallAttenuation * positionFactor

Where:
- B_rated depends on kVA: roughly 0.001 * ln(kVA/50) Tesla at surface for dry-type
- leakageFactor: dry-type = 0.03-0.05, oil-immersed = 0.01-0.03
- wallAttenuation: depends on material and thickness (skin depth)
  - mild steel: exp(-thickness/skinDepth), skinDepth ≈ 0.5mm at 60Hz
  - stainless: skinDepth ≈ 5mm at 60Hz
  - aluminum: skinDepth ≈ 10mm at 60Hz
- positionFactor: Gaussian-like distribution across the face
  - Peak near center/coil region: 1.0
  - Edges: 0.2
  - Uses mountPositionX, mountPositionY to compute
```

Generate a 2D heatmap grid (20x20) of flux density across the chosen face for the 3D view.

#### 2. Harmonic Content Model
```
Based on harmonicProfile, generate harmonic amplitudes (up to 25th):
- linear: fundamental only, THD < 5%
- vfd-heavy: strong 5th, 7th, 11th, 13th. THD ~30-80%
- server-psu: strong 3rd, 5th, 7th. THD ~40-100%
- led-driver: strong 3rd, 5th. THD ~20-50%
- mixed-nonlinear: moderate spread. THD ~15-40%

Wall filtering: higher harmonics attenuated more by wall
attenuation_n = exp(-thickness * n / skinDepth)
```

#### 3. Induced Voltage & Harvest Power
```
V_coil = N * A_core * dB/dt * couplingFactor

Where N = 1000 (turns), A_core depends on coreType
- u-core: 2 cm²
- c-core: 3 cm²
- e-core: 4 cm²
- rod: 0.5 cm²

couplingFactor depends on standoff, padPermeability
= (padPermeability / (padPermeability + standoff*50)) * coreFactor

P_harvest = V_rms² / R_load (optimized matching)
Apply rectifier efficiency ~0.7
```

#### 4. Solar Harvest
```
P_solar = solarCellArea * lightingLevel * solarEfficiency
solarEfficiency = 0.00015 W/(cm²·lux) for indoor amorphous Si
```

#### 5. Power Consumption Model (24-hour profile)
```
Generate a 24-hour minute-by-minute power consumption profile:
- Sleep current: 5 µW
- Sense + compute: 200 µW (active for ~100ms every transmitInterval)
- BLE minimal: 150 µW average when transmitting
- BLE burst: 500 µW
- LoRa: 800 µW average per transmit
- LED indicator: 50 µW (always on during active)
- ADC sampling: 100 µW during sense window

dutyCycle = activeDuration / transmitInterval
P_average = P_sleep * (1 - dutyCycle) + P_active * dutyCycle
```

#### 6. Energy Balance & SOC Simulation
```
Run minute-by-minute for 24 hours:
- Load profile varies: assume load follows a day pattern
  - 6am-9am: ramp 30% to loadPercent
  - 9am-5pm: loadPercent (full)
  - 5pm-9pm: ramp down to 50% of loadPercent
  - 9pm-6am: 30% of loadPercent
- Lighting follows same pattern (bright during day, dim at night)

For each minute:
  harvest = magneticHarvest(currentLoad) + solarHarvest(currentLight)
  consume = deviceConsumption(commMode, transmitInterval)
  net = harvest - consume
  SOC = clamp(SOC + net * dt / capacitance, 0, 1)
  
If SOC hits 0: device enters emergency mode (coin cell backup)
Track: time_in_emergency, total_harvest, total_consume, min_SOC
```

### Output (SimulationResult)

```typescript
interface SimulationResult {
  // Field
  fluxHeatmap: number[][]; // 20x20 grid of flux density in µT
  peakFluxAtMount: number; // µT at device position
  
  // Signal
  waveformData: {time: number, voltage: number}[]; // one cycle, 256 points
  spectrumData: {harmonic: number, amplitude: number, phase: number}[]; // up to 25th
  thd: number; // percent
  kFactor: number;
  
  // Power
  harvestPower: number; // µW average magnetic
  solarPower: number; // µW average
  totalHarvest: number; // µW
  consumptionPower: number; // µW average
  
  // Energy timeline
  energyTimeline: {
    hour: number;
    harvestMW: number; // µW
    consumeMW: number;
    soc: number; // 0-1
    loadPercent: number;
  }[];
  
  // Viability
  viable: boolean;
  confidencePercent: number;
  minSOC: number;
  emergencyMinutes: number; // time on coin cell
  verdict: string; // human-readable
}
```

## 3D Scene (client/src/components/TransformerScene.tsx)

Using @react-three/fiber:

### Transformer Box
- A box geometry sized to enclosureWidth × enclosureHeight × enclosureDepth
- Color: dark gray metallic (#2a2a2a)
- Semi-transparent on the selected face to show internal structure hint
- Add cooling fins on sides (simple extruded rectangles)
- Add terminal bushings on top (cylinders)

### Device Puck
- A small cylinder (about 8cm diameter, 3cm tall) on the chosen face
- Positioned at mountPositionX, mountPositionY on the face
- Color: the accent blue when viable, orange when marginal, red when not viable
- Subtle glow effect

### Flux Heatmap
- On the selected mounting face, overlay a plane with a custom shader or texture
- Map the fluxHeatmap data to a blue-red color gradient
- Semi-transparent so the face is visible underneath

### Environment
- Dark background (#111)
- Soft ambient light + one directional light
- OrbitControls for rotation/zoom
- Grid helper on the floor
- Subtle environment map for metallic reflections

## Charts (client/src/components/charts/)

### Waveform Chart
- Line chart showing one cycle of the sensed voltage waveform
- X-axis: time (ms), Y-axis: voltage (mV)
- Overlay the fundamental frequency for comparison

### Spectrum Chart
- Bar chart showing harmonic amplitudes
- X-axis: harmonic number (1-25), Y-axis: amplitude (relative)
- Color bars by magnitude

### Energy Timeline
- Area chart showing 24-hour profile
- Two stacked areas: harvest (green) and consumption (orange)
- Overlaid line: SOC percentage (separate Y-axis)
- Shade regions where SOC = 0 in red

### Summary Metrics
- Card grid showing key numbers:
  - Peak Flux at Mount (µT)
  - THD (%)
  - K-Factor
  - Harvest Power (µW)
  - Consumption (µW)
  - Net Power (µW)
  - Min SOC (%)
  - Emergency Time (minutes)
  - Confidence (%)

## Viability Verdict Logic
```
if (minSOC > 0.2) → "VIABLE" (green)
  confidence = 80 + minSOC * 20
if (minSOC > 0.05) → "MARGINAL" (amber)
  confidence = 40 + minSOC * 400
if (minSOC <= 0.05 && emergencyMinutes < 60) → "MARGINAL - needs coin cell backup" 
  confidence = 30
if (emergencyMinutes > 60) → "NOT VIABLE at this configuration" (red)
  confidence = max(10, 30 - emergencyMinutes/10)
```

## File Structure
```
client/src/
├── App.tsx                    # Main layout, dark mode
├── index.css                  # Theme with sim-specific vars
├── lib/
│   ├── simulation.ts          # All physics models
│   └── queryClient.ts         # (existing)
├── components/
│   ├── TransformerScene.tsx    # 3D Three.js scene
│   ├── ControlPanel.tsx        # Left sidebar with all inputs
│   ├── ChartPanel.tsx          # Bottom tabs with charts
│   ├── VerdictBadge.tsx        # Top-right viability indicator
│   └── MetricCards.tsx         # Summary metric cards
├── hooks/
│   └── useSimulation.ts       # React hook that runs simulation
└── pages/
    └── simulator.tsx           # Main page composing everything
```
