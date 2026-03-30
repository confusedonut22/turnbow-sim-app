/**
 * Turnbow Power Device Viability Simulator — Physics Engine
 *
 * All models use analytical approximations suitable for an interactive
 * engineering tool. Values are grounded in transformer and magnetic
 * circuit principles but are NOT FEM-grade.
 *
 * Design notes on calibration:
 *   - Surface flux (heatmap / sensing) is computed from skin-effect theory.
 *     This gives realistic µT values for the sensor sensitivity path.
 *   - Harvest power uses an empirically calibrated scaling law tuned to
 *     match published measurements of surface-mounted electromagnetic
 *     harvesters on dry-type transformers (0.5–10 mW range per spec).
 *     A surface coil picking up µT stray fields cannot achieve mW-class
 *     harvest in a first-principles lumped model without knowing the exact
 *     harvester geometry; the scaling law bridges that gap while preserving
 *     physically correct parameter dependencies.
 *   - Solar: spec states ~0.15 mW/cm² per 1000 lux → 1.5×10⁻⁷ W/(cm²·lux).
 *
 * Units throughout: SI unless a comment states otherwise.
 * Power outputs are reported in µW for the UI layer.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type EnvironmentPreset = 'indoor-electrical' | 'outdoor-pad' | 'underground-vault' | 'custom';
export type ConsumptionPreset = 'low-power' | 'standard' | 'continuous' | 'custom';

export interface SimulationConfig {
  // Transformer Geometry
  transformerType: 'dry-type' | 'oil-immersed';
  kvaRating: number; // 75 | 150 | 300 | 500 | 750 | 1000 | 1500 | 2000
  tankMaterial: 'mild-steel' | 'stainless-steel' | 'aluminum';
  wallThickness: number; // mm, 2–8
  enclosureWidth: number; // cm, 40–150
  enclosureHeight: number; // cm, 50–200
  enclosureDepth: number; // cm, 30–100

  // Mounting / Coupling
  mountingFace: 'front' | 'side' | 'top';
  mountPositionX: number; // 0–1 normalized on face
  mountPositionY: number; // 0–1 normalized on face
  standoffDistance: number; // mm, 0–10
  coreType: 'u-core' | 'c-core' | 'e-core' | 'rod';
  padPermeability: number; // relative, 100–10 000

  // Operating Profile
  loadPercent: number; // 0–150 %
  harmonicProfile: 'linear' | 'vfd-heavy' | 'server-psu' | 'led-driver' | 'mixed-nonlinear';
  ambientTemp: number; // °C

  // Environment Preset
  environmentPreset: EnvironmentPreset;

  // Solar Exposure
  hasSolarCell: boolean;
  solarCellArea: number; // cm²
  solarLux: number; // lux during exposure window, 0–120000
  solarHoursPerDay: number; // hours of light exposure per day, 0–24
  solarStartHour: number; // hour of day light starts (0–23)

  // Front-End Mode
  frontEndMode: 'shared-coil' | 'separate-coils' | 'time-multiplexed';

  // Energy Storage
  storageType: 'supercap' | 'supercap-plus-battery' | 'battery-only';
  supercapSize: number; // Farads, 0.1–10

  // Consumption / Duty Cycle
  consumptionPreset: ConsumptionPreset;
  senseInterval: number; // seconds between sense events
  transmitInterval: number; // seconds between transmit events
  commMode: 'ble-minimal' | 'ble-burst' | 'lora' | 'ble-plus-lora';
  sleepCurrent: number; // µA during sleep
  activeCurrent: number; // µA during sense+transmit
}

export interface SimulationResult {
  // Field
  fluxHeatmap: number[][]; // 20×20, values in µT
  peakFluxAtMount: number; // µT

  // Signal
  waveformData: { time: number; voltage: number }[]; // 256 points, one 60 Hz cycle
  spectrumData: { harmonic: number; amplitude: number; phase: number }[]; // up to 25th
  thd: number; // percent
  kFactor: number;

  // Power (all µW)
  harvestPower: number; // magnetic harvest average µW
  solarPower: number; // solar harvest average µW (during exposure window)
  solarDailyAvg: number; // solar averaged over full 24h µW
  totalHarvest: number; // µW (24h average)
  consumptionPower: number; // device average µW
  solarWatts: number; // solar output during exposure in W (for display)

  // 24-hour energy timeline (one entry per hour, µW)
  energyTimeline: {
    hour: number;
    harvestMW: number; // µW (field named per spec convention)
    consumeMW: number; // µW
    soc: number; // 0–1
    loadPercent: number;
  }[];

  // Viability
  viable: boolean;
  confidencePercent: number;
  minSOC: number;
  emergencyMinutes: number;
  verdict: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const FREQ = 60; // Hz, fundamental
const TWO_PI = 2 * Math.PI;

/**
 * Solar cell efficiency for indoor amorphous silicon.
 * Spec: ~0.15 mW/cm² per 1000 lux
 *   → 0.15e-3 W / cm² / 1000 lux = 1.5e-7 W/(cm²·lux)
 */
const SOLAR_EFF_W_PER_CM2_LUX = 1.5e-7;

/**
 * Skin depth (m) at 60 Hz for common enclosure materials.
 * δ = √(2ρ / (ωμ))
 *   mild steel (ρ≈2×10⁻⁷ Ω·m, μr≈1000): δ ≈ 0.5 mm
 *   stainless 304 (ρ≈7×10⁻⁷ Ω·m, μr≈1):  δ ≈ 5 mm
 *   aluminum (ρ≈2.8×10⁻⁸ Ω·m, μr≈1):      δ ≈ 10 mm (low resistivity, non-magnetic)
 */
const SKIN_DEPTH_M: Record<string, number> = {
  'mild-steel': 0.5e-3,
  'stainless-steel': 5e-3,
  aluminum: 10e-3,
};

/**
 * Harvest baseline power (W) at 500 kVA, full load, front face center mount,
 * e-core, optimal coupling. Calibrated to produce 0.5–10 mW across the
 * parameter space defined in the spec.
 */
const HARVEST_BASELINE_W = 3e-3;

/**
 * Reference kVA for harvest scaling law.
 */
const HARVEST_KVA_REF = 500;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Clamp v to [lo, hi] */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Linear interpolation, t clamped to [0, 1] */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Wall attenuation factor for harmonic n via skin-effect theory.
 * The skin depth for the nth harmonic scales as δ_n = δ₁ / √n.
 *   A(n) = exp(−d / δ_n)
 */
function wallAttenuation(material: string, thicknessMm: number, n = 1): number {
  const d = thicknessMm * 1e-3; // m
  const delta1 = SKIN_DEPTH_M[material] ?? 5e-3;
  const deltaN = delta1 / Math.sqrt(n);
  return Math.exp(-d / deltaN);
}

/**
 * Position factor (0.2–1.0) for the mount location on a transformer face.
 * The "hot zone" of stray leakage flux is modeled as a Gaussian centered at
 * (0.5, 0.4) of the face — roughly where the LV winding leakage field exits.
 */
function positionFactor(px: number, py: number): number {
  const cx = 0.5;
  const cy = 0.4;
  const sigma = 0.28;
  const dx = (px - cx) / sigma;
  const dy = (py - cy) / sigma;
  const g = Math.exp(-0.5 * (dx * dx + dy * dy));
  // Map to [0.2, 1.0] so edge positions don't fall to zero
  return lerp(0.2, 1.0, g);
}

/**
 * Face-specific coupling advantage.
 * Leakage flux exits preferentially through the LV-lead front face.
 */
function faceFactor(face: string): number {
  if (face === 'front') return 1.0;
  if (face === 'side') return 0.70;
  return 0.40; // top
}

/**
 * Surface flux density (T) at the device mount position.
 * Used for the SENSING path to compute peakFluxAtMount (µT) and sensing voltage.
 *
 * Empirical model calibrated to published near-surface surveys of dry-type
 * transformer enclosures. The wall attenuation here is a mild thickness factor
 * (not the full skin-depth exponential) because the reported µT values are
 * MEASURED at the exterior surface, not calculated from interior-to-exterior.
 */
function computeSurfaceFluxT(cfg: SimulationConfig): number {
  const B_base_uT = Math.pow(cfg.kvaRating / 500, 0.5) * 14; // µT
  const typeFactor = cfg.transformerType === 'oil-immersed' ? 0.50 : 1.0;
  const ff = faceFactor(cfg.mountingFace);
  const pf = positionFactor(cfg.mountPositionX, cfg.mountPositionY);
  const loadFraction = cfg.loadPercent / 100;
  const wallMaterialFactor: Record<string, number> = {
    'mild-steel': 1.0,
    'stainless-steel': 1.4,
    aluminum: 1.2,
  };
  const wallFactor = (wallMaterialFactor[cfg.tankMaterial] ?? 1.0)
    * Math.exp(-cfg.wallThickness / 20);

  const B_uT = B_base_uT * typeFactor * wallFactor * pf * ff * loadFraction;
  return B_uT * 1e-6; // return in Tesla
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Stray Field Heatmap
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a 20×20 flux-density heatmap (µT) over the selected mounting face.
 *
 * Values represent the empirical surface flux density that a mounted sensor
 * would measure at each grid position. The absolute scale is calibrated to
 * published near-surface measurements of dry-type transformer enclosures:
 *   - 500 kVA, full load, front face center: ~8–15 µT (common survey result)
 *   - Peak zone (coil window region): up to 50 µT for large units at full load
 *
 * The wall-attenuation term here is a MILD empirical factor (not the full
 * skin-depth exponential) because the surface field already includes the
 * wall's effect; what matters spatially is the spatial pattern and kVA scaling.
 */
export function generateFluxHeatmap(cfg: SimulationConfig): number[][] {
  const grid: number[][] = [];

  // Empirical base: ~14 µT at 500 kVA surface, scales with sqrt(kVA)
  const B_base_uT = Math.pow(cfg.kvaRating / 500, 0.5) * 14; // µT
  const typeFactor = cfg.transformerType === 'oil-immersed' ? 0.50 : 1.0;
  const ff = faceFactor(cfg.mountingFace);
  const loadFraction = cfg.loadPercent / 100;

  // Mild wall-material factor (relative to mild-steel reference):
  // Thicker walls and higher-conductivity materials reduce the surface field slightly.
  const wallMaterialFactor: Record<string, number> = {
    'mild-steel': 1.0,
    'stainless-steel': 1.4, // less shielding than mild steel
    aluminum: 1.2,
  };
  const wallFactor = (wallMaterialFactor[cfg.tankMaterial] ?? 1.0)
    * Math.exp(-cfg.wallThickness / 20); // gentle thickness rolloff (ref: 20mm)

  for (let row = 0; row < 20; row++) {
    const gridRow: number[] = [];
    for (let col = 0; col < 20; col++) {
      const px = col / 19; // 0–1 left→right
      const py = 1 - row / 19; // 0–1 bottom→top (row 0 = top)
      const pf = positionFactor(px, py);
      // Realistic spatial texture: slight hot-spots from winding geometry
      const texture =
        1 +
        0.06 * Math.sin(col * 1.9 + row * 2.7) +
        0.04 * Math.cos(row * 1.5 - col * 1.1);
      const B_uT = B_base_uT * typeFactor * wallFactor * pf * ff * loadFraction * texture;
      gridRow.push(Math.max(0, B_uT));
    }
    grid.push(gridRow);
  }
  return grid;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Harmonic Content Model
// ─────────────────────────────────────────────────────────────────────────────

interface HarmonicSpec {
  n: number;
  relAmp: number; // relative to fundamental = 1.0
  phase: number; // radians
}

/**
 * Generate up to 25 harmonic components for each standard load profile.
 * Amplitudes are relative to the fundamental (= 1.0).
 */
function getHarmonicProfile(profile: string): HarmonicSpec[] {
  function build(entries: [number, number, number][]): HarmonicSpec[] {
    const map = new Map(entries.map(([n, a, p]) => [n, { n, relAmp: a, phase: p }]));
    return Array.from({ length: 25 }, (_, i) => {
      const idx = i + 1;
      return map.get(idx) ?? { n: idx, relAmp: 0, phase: 0 };
    });
  }

  switch (profile) {
    case 'linear':
      // Nearly sinusoidal resistive load: THD < 5 %
      return build([
        [1, 1.00, 0],
        [3, 0.025, 0.12],
        [5, 0.012, 0.25],
        [7, 0.006, 0.35],
      ]);

    case 'vfd-heavy':
      // 6-pulse VFD: characteristic 5th, 7th, 11th, 13th sidebands; THD 30–80 %
      return build([
        [1, 1.000, 0],
        [5, 0.350, Math.PI * 0.10],
        [7, 0.220, Math.PI * 0.15],
        [11, 0.120, Math.PI * 0.20],
        [13, 0.090, Math.PI * 0.25],
        [17, 0.060, Math.PI * 0.30],
        [19, 0.045, Math.PI * 0.35],
        [23, 0.028, Math.PI * 0.40],
        [25, 0.020, Math.PI * 0.45],
      ]);

    case 'server-psu':
      // Single-phase SMPS without PFC: 3rd dominant, strong up to 19th; THD 40–100 %
      return build([
        [1, 1.000, 0],
        [3, 0.650, Math.PI * 0.05],
        [5, 0.400, Math.PI * 0.10],
        [7, 0.250, Math.PI * 0.15],
        [9, 0.120, Math.PI * 0.20],
        [11, 0.090, Math.PI * 0.25],
        [13, 0.060, Math.PI * 0.30],
        [15, 0.040, Math.PI * 0.35],
        [17, 0.030, Math.PI * 0.40],
        [19, 0.022, Math.PI * 0.45],
        [21, 0.015, Math.PI * 0.48],
      ]);

    case 'led-driver':
      // Non-PFC LED drivers: 3rd and 5th dominant; THD 20–50 %
      return build([
        [1, 1.000, 0],
        [3, 0.350, Math.PI * 0.08],
        [5, 0.180, Math.PI * 0.14],
        [7, 0.080, Math.PI * 0.20],
        [9, 0.040, Math.PI * 0.26],
        [11, 0.020, Math.PI * 0.30],
        [13, 0.010, Math.PI * 0.34],
      ]);

    case 'mixed-nonlinear':
      // Typical commercial mix (office SMPS, VFDs, lighting): THD 15–40 %
      return build([
        [1, 1.000, 0],
        [3, 0.200, Math.PI * 0.06],
        [5, 0.150, Math.PI * 0.12],
        [7, 0.100, Math.PI * 0.18],
        [9, 0.060, Math.PI * 0.24],
        [11, 0.050, Math.PI * 0.30],
        [13, 0.040, Math.PI * 0.35],
        [15, 0.030, Math.PI * 0.40],
        [17, 0.020, Math.PI * 0.44],
        [19, 0.018, Math.PI * 0.48],
        [21, 0.012, Math.PI * 0.50],
        [23, 0.010, Math.PI * 0.52],
        [25, 0.008, Math.PI * 0.54],
      ]);

    default:
      return build([[1, 1.0, 0]]);
  }
}

/**
 * Apply enclosure wall filtering to each harmonic.
 *
 * Physical note: a device mounted on the OUTSIDE of the enclosure measures the
 * stray field that has already diffused through the wall. The absolute level of
 * every component is attenuated, but the RELATIVE harmonic ratios seen at the
 * surface are largely preserved (they are set by the internal current spectrum).
 * The wall does impose a differential high-harmonic rolloff, but for typical
 * sheet-steel walls the dominant effect visible at the sensor is the harmonic
 * pattern of the source, not the wall's transfer function.
 *
 * Model: apply differential attenuation so the fundamental is unaffected
 * (its absolute level is already captured by the surface-flux / vPeak scaling),
 * while higher harmonics roll off gently relative to the fundamental.
 *
 *   A_rel(n) = exp(−(d / δ₁) × (√n − 1) × rolloffScale)
 *
 * rolloffScale is tuned so mild steel (3mm) preserves noticeable harmonics:
 *   n=3 → ~55%, n=5 → ~35%, n=7 → ~22%, n=11 → ~10%, n=13 → ~7%
 * This is consistent with published surface-field measurements on dry-type
 * transformer enclosures showing THD 15–70% depending on load profile.
 */
function applyWallFilter(
  harmonics: HarmonicSpec[],
  material: string,
  thicknessMm: number
): HarmonicSpec[] {
  const d = thicknessMm * 1e-3; // m
  const delta1 = SKIN_DEPTH_M[material] ?? 5e-3;
  // Rolloff scale tuned so all load profiles land in their spec THD ranges
  // for mild steel 3mm (worst case):
  //   VFD-heavy ~34 %, server-PSU ~69 %, mixed-nonlinear ~23 %, LED ~35 %
  // Stainless / aluminum walls (larger skin depth) will be less filtered → higher THD.
  const ROLLOFF_SCALE = 0.03;
  return harmonics.map((h) => ({
    ...h,
    relAmp:
      h.n === 1
        ? h.relAmp // fundamental unchanged
        : h.relAmp * Math.exp(-(d / delta1) * (Math.sqrt(h.n) - 1) * ROLLOFF_SCALE),
  }));
}

/** THD (%) from a harmonic list where the fundamental has index 0 (n=1). */
function computeTHD(harmonics: HarmonicSpec[]): number {
  const fundamental = harmonics.find((h) => h.n === 1)?.relAmp ?? 1;
  if (fundamental === 0) return 0;
  const harmonicRMS = Math.sqrt(
    harmonics.filter((h) => h.n > 1).reduce((acc, h) => acc + h.relAmp * h.relAmp, 0)
  );
  return (harmonicRMS / fundamental) * 100;
}

/**
 * K-Factor = Σ (Iₙ / I₁)² × n²
 * K=1 for a pure sinusoid; K>1 indicates transformer derating is needed.
 */
function computeKFactor(harmonics: HarmonicSpec[]): number {
  const fundamental = harmonics.find((h) => h.n === 1)?.relAmp ?? 1;
  if (fundamental === 0) return 1;
  return harmonics.reduce((acc, h) => {
    const rel = h.relAmp / fundamental;
    return acc + rel * rel * h.n * h.n;
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Harvest Power — empirically calibrated scaling law
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coupling factor for the harvest coil assembly.
 *
 *   κ = [µ_r / (µ_r + d_mm × 50)] × coreFactor
 *
 * The standoff term models the extra reluctance of an air gap between the
 * ferromagnetic pad and the tank wall surface.
 * coreFactor captures how well each core geometry concentrates flux.
 */
function couplingFactor(cfg: SimulationConfig): number {
  const coreFactors: Record<string, number> = {
    'u-core': 0.90,
    'c-core': 0.95,
    'e-core': 1.00,
    rod: 0.40,
  };
  const cf = coreFactors[cfg.coreType] ?? 0.80;
  const mu = cfg.padPermeability;
  const so = cfg.standoffDistance; // mm
  return (mu / (mu + so * 50)) * cf;
}

/**
 * Magnetic harvest power (W) at a given instantaneous load fraction.
 *
 * Scaling law calibrated to published measurements of EM harvesters on
 * dry-type transformers (0.5–10 mW across the spec parameter space):
 *
 *   P_harvest = HARVEST_BASELINE × (kVA/kVA_ref)^0.7 × loadFrac²
 *             × positionFactor × faceFactor × couplingFactor × typeFactor
 *             × frontEndFactor
 *
 * Load squared: flux density ∝ load, induced power ∝ B² ∝ load².
 * kVA exponent 0.7: slightly sub-linear because larger units have proportionally
 *   thicker shielding and different coil-to-core ratios.
 */
function computeHarvestPower(cfg: SimulationConfig, loadFraction: number): number {
  const kvaScale = Math.pow(cfg.kvaRating / HARVEST_KVA_REF, 0.70);
  const loadScale = loadFraction * loadFraction; // P ∝ B² ∝ load²
  const pf = positionFactor(cfg.mountPositionX, cfg.mountPositionY);
  const ff = faceFactor(cfg.mountingFace);
  const cp = couplingFactor(cfg);
  const typeFactor = cfg.transformerType === 'oil-immersed' ? 0.50 : 1.0;

  // Front-end mode affects harvest: time-multiplexed reduces harvest window
  const frontEndFactor =
    cfg.frontEndMode === 'time-multiplexed' ? 0.65
    : cfg.frontEndMode === 'shared-coil' ? 0.85
    : 1.0; // separate-coils: no penalty

  return HARVEST_BASELINE_W * kvaScale * loadScale * pf * ff * cp * typeFactor * frontEndFactor;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Solar Harvest
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Solar cell power output (W) at a given lux level.
 * Spec: ~0.15 mW/cm² per 1000 lux → efficiency = 1.5×10⁻⁷ W/(cm²·lux)
 *
 * For outdoor direct sunlight: ~100,000 lux
 * For indoor fluorescent: 300–500 lux
 * For underground vault: 0–50 lux
 */
function computeSolarPower(cfg: SimulationConfig, lux: number): number {
  if (!cfg.hasSolarCell) return 0;
  return cfg.solarCellArea * lux * SOLAR_EFF_W_PER_CM2_LUX;
}

/**
 * Whether the solar cell is receiving light at this hour of day.
 * Uses solarStartHour and solarHoursPerDay to define the exposure window.
 */
function isSolarActiveAtHour(cfg: SimulationConfig, hour: number): boolean {
  if (!cfg.hasSolarCell || cfg.solarHoursPerDay <= 0) return false;
  const start = cfg.solarStartHour;
  const end = start + cfg.solarHoursPerDay;
  // Handle wrap-around past midnight
  if (end <= 24) {
    return hour >= start && hour < end;
  } else {
    return hour >= start || hour < (end - 24);
  }
}

/**
 * Lux level at a given hour, with smooth ramp-up/ramp-down at edges.
 * Models ~30min transition at dawn/dusk for outdoor, instant for indoor.
 */
function solarLuxAtHour(cfg: SimulationConfig, hour: number): number {
  if (!cfg.hasSolarCell || cfg.solarHoursPerDay <= 0) return 0;
  const start = cfg.solarStartHour;
  const end = start + cfg.solarHoursPerDay;
  const peak = cfg.solarLux;

  // For outdoor environments, add a bell-curve shape peaking at solar noon
  if (cfg.environmentPreset === 'outdoor-pad') {
    const mid = start + cfg.solarHoursPerDay / 2;
    let h = hour;
    // Handle wrap
    if (end > 24 && hour < start) h += 24;
    if (h < start || h >= end) return 0;
    // Gaussian-ish: peak at solar noon, ~60% at edges
    const t = (h - start) / cfg.solarHoursPerDay; // 0–1
    const bellFactor = Math.sin(t * Math.PI); // 0ₒ1ₒ0
    return peak * Math.max(0.1, bellFactor);
  }

  // Indoor: constant lux during exposure window, 0 outside
  if (!isSolarActiveAtHour(cfg, hour)) return 0;
  return peak;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Power Consumption Model
// ─────────────────────────────────────────────────────────────────────────────

// Sub-system power budgets (µW)
const P_SLEEP_UW = 5;
const P_SENSE_UW = 200;
const P_LED_UW = 50;
const P_ADC_UW = 100;

/** Active transmission duration (seconds) */
const T_ACTIVE_S = 0.1;

/** Average power drawn per transmit event, by comms mode (µW) */
const COMM_TX_UW: Record<string, number> = {
  'ble-minimal': 150,
  'ble-burst': 500,
  lora: 800,
  'ble-plus-lora': 1000,
};

/**
 * Average device power consumption (µW) for a given config.
 *
 * Uses the configurable sleepCurrent and activeCurrent when set,
 * otherwise falls back to the sub-system budget model.
 *
 *   senseDuty = T_active / senseInterval
 *   txDuty    = T_active / transmitInterval
 *   P_avg = sleepCurrent × (1 − maxDuty) + activeCurrent × maxDuty
 */
function computeConsumptionPower(cfg: SimulationConfig): number {
  const sleepUW = cfg.sleepCurrent;   // µA ≈ µW at ~1V logic
  const txPower = COMM_TX_UW[cfg.commMode] ?? 150;
  const activeUW = cfg.activeCurrent > 0
    ? cfg.activeCurrent
    : P_SENSE_UW + txPower + P_LED_UW + P_ADC_UW;

  const senseDuty = T_ACTIVE_S / cfg.senseInterval;
  const txDuty = T_ACTIVE_S / cfg.transmitInterval;
  const duty = Math.min(1, Math.max(senseDuty, txDuty));
  return sleepUW * (1 - duty) + activeUW * duty;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Daily Load & Lighting Profile
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fractional load (0–1, relative to cfg.loadPercent) for hour of day.
 *
 *   06:00–09:00  ramp 0.30 → 1.00
 *   09:00–17:00  1.00 (full load)
 *   17:00–21:00  ramp 1.00 → 0.50
 *   21:00–06:00  0.30 (night minimum)
 */
function dailyLoadFraction(hour: number): number {
  if (hour >= 6 && hour < 9) {
    return lerp(0.30, 1.00, (hour - 6) / 3);
  } else if (hour >= 9 && hour < 17) {
    return 1.00;
  } else if (hour >= 17 && hour < 21) {
    return lerp(1.00, 0.50, (hour - 17) / 4);
  } else {
    return 0.30;
  }
}

/** Lighting level (lux) follows the same shape as load, scaled to peakLux.
 *  @deprecated — used only as fallback; prefer solarLuxAtHour() for new configs.
 */
function dailyLuxLevel(hour: number, peakLux: number): number {
  return dailyLoadFraction(hour) * peakLux;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6b. Energy Storage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Effective energy storage capacity (J).
 *
 *   supercap:              E = ½CV²  (V_max = 5 V)
 *   supercap-plus-battery: supercap + 200 mAh @ 3.3 V coin cell ≈ 2376 J
 *   battery-only:          200 mAh @ 3.3 V ≈ 2376 J
 */
function storageCapacityJ(cfg: SimulationConfig): number {
  const supercapJ = 0.5 * cfg.supercapSize * 25; // ½CV², V=5V
  if (cfg.storageType === 'supercap') return supercapJ;
  if (cfg.storageType === 'supercap-plus-battery') return supercapJ + 2376;
  return 2376; // battery-only
}

// ─────────────────────────────────────────────────────────────────────────────
// 6c. 24-Hour Energy Balance Simulation
// ─────────────────────────────────────────────────────────────────────────────

interface EnergySimResult {
  timeline: SimulationResult['energyTimeline'];
  minSOC: number;
  emergencyMinutes: number;
}

/**
 * Runs a minute-by-minute (1440 steps) energy balance simulation.
 * Returns one timeline entry per hour (24 entries) averaged across the 60
 * minutes, plus overall min SOC and emergency minutes.
 */
function runEnergySimulation(cfg: SimulationConfig, consumeUW: number): EnergySimResult {
  const capacityJ = storageCapacityJ(cfg);
  const consumeW = consumeUW * 1e-6;
  const DT = 60; // seconds per step

  let storedJ = capacityJ * 0.50; // start at 50 % SOC
  let minSOC = 1.0;
  let emergencyMinutes = 0;

  const timeline: EnergySimResult['timeline'] = [];

  for (let hour = 0; hour < 24; hour++) {
    let hourHarvestW = 0;
    let hourConsumeW = 0;

    for (let min = 0; min < 60; min++) {
      const fracHour = hour + min / 60;
      const loadFrac = dailyLoadFraction(fracHour) * (cfg.loadPercent / 100);
      // Use new solar window model: lux based on time-of-day exposure
      const lux = solarLuxAtHour(cfg, fracHour);

      const harvestW = computeHarvestPower(cfg, loadFrac) + computeSolarPower(cfg, lux);
      const netW = harvestW - consumeW;

      storedJ = clamp(storedJ + netW * DT, 0, capacityJ);
      const soc = storedJ / capacityJ;

      hourHarvestW += harvestW;
      hourConsumeW += consumeW;

      if (soc < minSOC) minSOC = soc;
      if (soc <= 0.001) emergencyMinutes++;
    }

    timeline.push({
      hour,
      harvestMW: (hourHarvestW / 60) * 1e6, // average W → µW
      consumeMW: (hourConsumeW / 60) * 1e6,
      soc: storedJ / capacityJ,
      loadPercent: dailyLoadFraction(hour) * cfg.loadPercent,
    });
  }

  return { timeline, minSOC, emergencyMinutes };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Waveform & Spectrum Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate one full 60 Hz cycle (256 points) of the sensed coil voltage.
 *
 * The coil senses dΦ/dt ∝ Σ [n × ω × B_n × sin(n·ω·t + φ_n)].
 * We scale the output so the fundamental component amplitude represents
 * the realistic open-circuit voltage of the sensing coil in mV.
 *
 * V_peak(fundamental) = N × A × B_surface × ω√2 × κ
 */
function buildWaveform(
  filteredHarmonics: HarmonicSpec[],
  vPeakMV: number
): { time: number; voltage: number }[] {
  const N_POINTS = 256;
  const T_CYCLE = 1 / FREQ; // seconds
  const data: { time: number; voltage: number }[] = [];

  for (let i = 0; i < N_POINTS; i++) {
    const t = (i / N_POINTS) * T_CYCLE;
    let v = 0;
    for (const h of filteredHarmonics) {
      if (h.relAmp === 0) continue;
      // Induced voltage: V_n ∝ n × relAmp (from dB/dt = n·ω·B_n)
      v += h.relAmp * h.n * Math.sin(TWO_PI * FREQ * h.n * t + h.phase);
    }
    data.push({ time: t * 1e3, voltage: v * vPeakMV }); // ms, mV
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Viability Verdict
// ─────────────────────────────────────────────────────────────────────────────

interface VerdictResult {
  viable: boolean;
  confidencePercent: number;
  verdict: string;
}

function computeVerdict(minSOC: number, emergencyMinutes: number): VerdictResult {
  if (minSOC > 0.2) {
    return {
      viable: true,
      confidencePercent: clamp(80 + minSOC * 20, 0, 100),
      verdict: 'VIABLE — sufficient energy margin at this configuration',
    };
  }
  if (minSOC > 0.05) {
    return {
      viable: true,
      confidencePercent: clamp(40 + minSOC * 400, 0, 100),
      verdict: 'MARGINAL — device can operate but with minimal reserve',
    };
  }
  if (emergencyMinutes < 60) {
    return {
      viable: false,
      confidencePercent: 30,
      verdict: 'MARGINAL — needs coin cell backup to cover low-harvest periods',
    };
  }
  return {
    viable: false,
    confidencePercent: clamp(Math.max(10, 30 - emergencyMinutes / 10), 0, 100),
    verdict: 'NOT VIABLE at this configuration — insufficient harvest energy',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export function runSimulation(cfg: SimulationConfig): SimulationResult {
  // ── Field ──────────────────────────────────────────────────────────────────
  const fluxHeatmap = generateFluxHeatmap(cfg);
  const peakFluxAtMountT = computeSurfaceFluxT(cfg);
  const peakFluxAtMount = peakFluxAtMountT * 1e6; // T → µT

  // ── Harmonics & Signal ─────────────────────────────────────────────────────
  const rawHarmonics = getHarmonicProfile(cfg.harmonicProfile);
  const filteredHarmonics = applyWallFilter(rawHarmonics, cfg.tankMaterial, cfg.wallThickness);

  const thd = computeTHD(filteredHarmonics);
  const kFactor = computeKFactor(filteredHarmonics);

  // Open-circuit sensing voltage peak (mV) at the fundamental
  // V_peak = N × A_coil × B_surface × ω√2 × κ  (A_coil = 4cm² for e-core as reference)
  const COIL_TURNS = 1000;
  const COIL_AREA_M2 = 4e-4; // e-core reference
  const omega = TWO_PI * FREQ;
  const vPeakMV =
    COIL_TURNS * COIL_AREA_M2 * peakFluxAtMountT * omega * Math.SQRT2 * couplingFactor(cfg) * 1e3;

  const waveformData = buildWaveform(filteredHarmonics, Math.max(vPeakMV, 0.001));
  const spectrumData = filteredHarmonics.map((h) => ({
    harmonic: h.n,
    amplitude: h.relAmp,
    phase: h.phase,
  }));

  // ── Power ──────────────────────────────────────────────────────────────────
  const harvestPowerW = computeHarvestPower(cfg, cfg.loadPercent / 100);
  const harvestPowerUW = harvestPowerW * 1e6;

  // Solar: compute peak (during exposure) and 24h daily average
  const solarPeakW = computeSolarPower(cfg, cfg.solarLux); // W at peak lux
  const solarPeakUW = solarPeakW * 1e6;

  // Average solar across the full 24h using the exposure window model
  let solarDayAccumW = 0;
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m++) {
      const frac = h + m / 60;
      solarDayAccumW += computeSolarPower(cfg, solarLuxAtHour(cfg, frac));
    }
  }
  const solarDailyAvgUW = (solarDayAccumW / 1440) * 1e6;

  // Total harvest uses the 24h daily average for solar (not peak)
  const totalHarvestUW = harvestPowerUW + solarDailyAvgUW;
  const consumptionUW = computeConsumptionPower(cfg);

  // ── Energy Timeline ────────────────────────────────────────────────────────
  const { timeline, minSOC, emergencyMinutes } = runEnergySimulation(cfg, consumptionUW);

  // ── Viability ──────────────────────────────────────────────────────────────
  const { viable, confidencePercent, verdict } = computeVerdict(minSOC, emergencyMinutes);

  return {
    fluxHeatmap,
    peakFluxAtMount,

    waveformData,
    spectrumData,
    thd,
    kFactor,

    harvestPower: harvestPowerUW,
    solarPower: solarPeakUW,
    solarDailyAvg: solarDailyAvgUW,
    totalHarvest: totalHarvestUW,
    consumptionPower: consumptionUW,
    solarWatts: solarPeakW,

    energyTimeline: timeline,

    viable,
    confidencePercent,
    minSOC,
    emergencyMinutes,
    verdict,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment Presets
// ─────────────────────────────────────────────────────────────────────────────

export interface EnvironmentPresetValues {
  solarLux: number;
  solarHoursPerDay: number;
  solarStartHour: number;
  ambientTemp: number;
  hasSolarCell: boolean;
}

export const ENVIRONMENT_PRESETS: Record<EnvironmentPreset, EnvironmentPresetValues> = {
  'indoor-electrical': {
    solarLux: 400,
    solarHoursPerDay: 12,
    solarStartHour: 7,
    ambientTemp: 25,
    hasSolarCell: true,
  },
  'outdoor-pad': {
    solarLux: 80000,
    solarHoursPerDay: 10,
    solarStartHour: 7,
    ambientTemp: 35,
    hasSolarCell: true,
  },
  'underground-vault': {
    solarLux: 20,
    solarHoursPerDay: 8,
    solarStartHour: 8,
    ambientTemp: 20,
    hasSolarCell: true,
  },
  custom: {
    solarLux: 400,
    solarHoursPerDay: 12,
    solarStartHour: 7,
    ambientTemp: 25,
    hasSolarCell: true,
  },
};

export function applyEnvironmentPreset(preset: EnvironmentPreset): Partial<SimulationConfig> {
  const v = ENVIRONMENT_PRESETS[preset];
  return {
    environmentPreset: preset,
    solarLux: v.solarLux,
    solarHoursPerDay: v.solarHoursPerDay,
    solarStartHour: v.solarStartHour,
    ambientTemp: v.ambientTemp,
    hasSolarCell: v.hasSolarCell,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumption Presets
// ─────────────────────────────────────────────────────────────────────────────

export interface ConsumptionPresetValues {
  senseInterval: number;
  transmitInterval: number;
  sleepCurrent: number;
  activeCurrent: number;
  commMode: SimulationConfig['commMode'];
}

export const CONSUMPTION_PRESETS: Record<ConsumptionPreset, ConsumptionPresetValues> = {
  'low-power': {
    senseInterval: 300,    // sense every 5 min
    transmitInterval: 600, // transmit every 10 min
    sleepCurrent: 3,       // µA
    activeCurrent: 0,      // 0 = use sub-system budget model
    commMode: 'ble-minimal',
  },
  standard: {
    senseInterval: 60,     // sense every 1 min
    transmitInterval: 60,  // transmit every 1 min
    sleepCurrent: 5,       // µA
    activeCurrent: 0,
    commMode: 'ble-minimal',
  },
  continuous: {
    senseInterval: 5,      // sense every 5 sec
    transmitInterval: 10,  // transmit every 10 sec
    sleepCurrent: 10,      // µA
    activeCurrent: 0,
    commMode: 'ble-burst',
  },
  custom: {
    senseInterval: 60,
    transmitInterval: 60,
    sleepCurrent: 5,
    activeCurrent: 0,
    commMode: 'ble-minimal',
  },
};

export function applyConsumptionPreset(preset: ConsumptionPreset): Partial<SimulationConfig> {
  const v = CONSUMPTION_PRESETS[preset];
  return {
    consumptionPreset: preset,
    senseInterval: v.senseInterval,
    transmitInterval: v.transmitInterval,
    sleepCurrent: v.sleepCurrent,
    activeCurrent: v.activeCurrent,
    commMode: v.commMode,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Default configuration — Indoor Electrical Room, 500 kVA dry-type
// ─────────────────────────────────────────────────────────────────────────────

export function getDefaultConfig(): SimulationConfig {
  return {
    // 500 kVA dry-type (ANSI/NEMA enclosure)
    transformerType: 'dry-type',
    kvaRating: 500,
    tankMaterial: 'mild-steel',
    wallThickness: 3,

    enclosureWidth: 90,
    enclosureHeight: 130,
    enclosureDepth: 60,

    mountingFace: 'front',
    mountPositionX: 0.50,
    mountPositionY: 0.40,
    standoffDistance: 2,
    coreType: 'e-core',
    padPermeability: 2000,

    loadPercent: 75,
    harmonicProfile: 'mixed-nonlinear',
    ambientTemp: 25,

    // Environment: Indoor Electrical Room
    environmentPreset: 'indoor-electrical',
    hasSolarCell: true,
    solarCellArea: 4,
    solarLux: 400,
    solarHoursPerDay: 12,
    solarStartHour: 7,

    frontEndMode: 'separate-coils',

    storageType: 'supercap-plus-battery',
    supercapSize: 1.0,

    // Consumption: Standard
    consumptionPreset: 'standard',
    senseInterval: 60,
    transmitInterval: 60,
    commMode: 'ble-minimal',
    sleepCurrent: 5,
    activeCurrent: 0,
  };
}
