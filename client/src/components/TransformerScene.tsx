import { useMemo, useEffect, useRef } from "react";
import { SimulationConfig, SimulationResult } from "@/lib/simulation";

/**
 * Pure Canvas 2D isometric transformer visualization.
 * No WebGL required — works everywhere including mobile and iframes.
 */

interface Props {
  config: SimulationConfig;
  result: SimulationResult;
}

// ── Color helpers ──────────────────────────────────────────────────────────

function heatmapColor(t: number): [number, number, number, number] {
  let r: number, g: number, b: number;
  if (t < 0.25) {
    const s = t / 0.25;
    r = 0; g = s; b = 1;
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    r = 0; g = 1; b = 1 - s;
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    r = s; g = 1; b = 0;
  } else {
    const s = (t - 0.75) / 0.25;
    r = 1; g = 1 - s; b = 0;
  }
  return [r, g, b, 0.55];
}

// ── Isometric projection helpers ───────────────────────────────────────────

const ISO_ANGLE = Math.PI / 6; // 30°
const COS_A = Math.cos(ISO_ANGLE);
const SIN_A = Math.sin(ISO_ANGLE);

/** Convert 3D (x, y, z) → 2D isometric (sx, sy). Y is up. */
function isoProject(
  x: number, y: number, z: number,
  cx: number, cy: number, scale: number
): [number, number] {
  const sx = cx + (x - z) * COS_A * scale;
  const sy = cy - y * scale + (x + z) * SIN_A * scale;
  return [sx, sy];
}

// ── Drawing functions ──────────────────────────────────────────────────────

function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number,
  w: number, h: number, d: number,
  topColor: string, leftColor: string, rightColor: string,
  strokeColor = "rgba(255,255,255,0.08)"
) {
  const hw = w / 2, hd = d / 2;

  // 8 corners
  const ftl = isoProject(-hw, h, -hd, cx, cy, scale);
  const ftr = isoProject(hw, h, -hd, cx, cy, scale);
  const fbl = isoProject(-hw, 0, -hd, cx, cy, scale);
  const fbr = isoProject(hw, 0, -hd, cx, cy, scale);
  const btl = isoProject(-hw, h, hd, cx, cy, scale);
  const btr = isoProject(hw, h, hd, cx, cy, scale);
  const bbl = isoProject(-hw, 0, hd, cx, cy, scale);
  const bbr = isoProject(hw, 0, hd, cx, cy, scale);

  // Top face
  ctx.beginPath();
  ctx.moveTo(...ftl); ctx.lineTo(...ftr); ctx.lineTo(...btr); ctx.lineTo(...btl);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor; ctx.lineWidth = 0.5; ctx.stroke();

  // Left face
  ctx.beginPath();
  ctx.moveTo(...ftl); ctx.lineTo(...fbl); ctx.lineTo(...bbl); ctx.lineTo(...btl);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor; ctx.stroke();

  // Right face
  ctx.beginPath();
  ctx.moveTo(...ftr); ctx.lineTo(...fbr); ctx.lineTo(...bbr); ctx.lineTo(...btr);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor; ctx.stroke();
}

function drawHeatmapOnFace(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number,
  config: SimulationConfig,
  heatmap: number[][]
) {
  const w = config.enclosureWidth / 100;
  const h = config.enclosureHeight / 100;
  const d = config.enclosureDepth / 100;
  const hw = w / 2, hd = d / 2;
  const gridSize = heatmap.length;

  // Find range
  let min = Infinity, max = -Infinity;
  for (const row of heatmap) for (const v of row) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;

  // Draw on the front face (z = -hd)
  if (config.mountingFace === "front") {
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const t = (heatmap[row][col] - min) / range;
        const [r, g, b, a] = heatmapColor(t);

        const x0 = -hw + (col / gridSize) * w;
        const x1 = -hw + ((col + 1) / gridSize) * w;
        const y0 = h - (row / gridSize) * h;
        const y1 = h - ((row + 1) / gridSize) * h;
        const z = -hd - 0.001;

        const tl = isoProject(x0, y0, z, cx, cy, scale);
        const tr = isoProject(x1, y0, z, cx, cy, scale);
        const br = isoProject(x1, y1, z, cx, cy, scale);
        const bl = isoProject(x0, y1, z, cx, cy, scale);

        ctx.beginPath();
        ctx.moveTo(...tl); ctx.lineTo(...tr); ctx.lineTo(...br); ctx.lineTo(...bl);
        ctx.closePath();
        ctx.fillStyle = `rgba(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)},${a})`;
        ctx.fill();
      }
    }
  } else if (config.mountingFace === "side") {
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const t = (heatmap[row][col] - min) / range;
        const [r, g, b, a] = heatmapColor(t);

        const z0 = -hd + (col / gridSize) * d;
        const z1 = -hd + ((col + 1) / gridSize) * d;
        const y0 = h - (row / gridSize) * h;
        const y1 = h - ((row + 1) / gridSize) * h;
        const x = hw + 0.001;

        const tl = isoProject(x, y0, z0, cx, cy, scale);
        const tr = isoProject(x, y0, z1, cx, cy, scale);
        const br = isoProject(x, y1, z1, cx, cy, scale);
        const bl = isoProject(x, y1, z0, cx, cy, scale);

        ctx.beginPath();
        ctx.moveTo(...tl); ctx.lineTo(...tr); ctx.lineTo(...br); ctx.lineTo(...bl);
        ctx.closePath();
        ctx.fillStyle = `rgba(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)},${a})`;
        ctx.fill();
      }
    }
  } else {
    // top face
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const t = (heatmap[row][col] - min) / range;
        const [r, g, b, a] = heatmapColor(t);

        const x0 = -hw + (col / gridSize) * w;
        const x1 = -hw + ((col + 1) / gridSize) * w;
        const z0 = -hd + (row / gridSize) * d;
        const z1 = -hd + ((row + 1) / gridSize) * d;
        const y = h + 0.001;

        const tl = isoProject(x0, y, z0, cx, cy, scale);
        const tr = isoProject(x1, y, z0, cx, cy, scale);
        const br = isoProject(x1, y, z1, cx, cy, scale);
        const bl = isoProject(x0, y, z1, cx, cy, scale);

        ctx.beginPath();
        ctx.moveTo(...tl); ctx.lineTo(...tr); ctx.lineTo(...br); ctx.lineTo(...bl);
        ctx.closePath();
        ctx.fillStyle = `rgba(${Math.floor(r * 255)},${Math.floor(g * 255)},${Math.floor(b * 255)},${a})`;
        ctx.fill();
      }
    }
  }
}

function drawDevicePuck(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number,
  config: SimulationConfig,
  result: SimulationResult,
  time: number
) {
  const w = config.enclosureWidth / 100;
  const h = config.enclosureHeight / 100;
  const d = config.enclosureDepth / 100;
  const hw = w / 2, hd = d / 2;
  const px = config.mountPositionX;
  const py = config.mountPositionY;

  let pos3d: [number, number, number];
  switch (config.mountingFace) {
    case "front":
      pos3d = [(px - 0.5) * w, py * h, -hd - 0.02];
      break;
    case "side":
      pos3d = [hw + 0.02, py * h, (px - 0.5) * d];
      break;
    case "top":
      pos3d = [(px - 0.5) * w, h + 0.02, (py - 0.5) * d];
      break;
  }

  const [sx, sy] = isoProject(...pos3d, cx, cy, scale);

  // Viability color
  const color = result.viable && result.minSOC > 0.2
    ? "#3b82f6"
    : result.viable || result.minSOC > 0.05
    ? "#f59e0b"
    : "#ef4444";

  // Glow pulse
  const pulse = 1 + Math.sin(time * 3) * 0.3;
  const glowRadius = 14 * pulse;

  // Outer glow
  const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, glowRadius);
  glow.addColorStop(0, color + "88");
  glow.addColorStop(1, color + "00");
  ctx.beginPath();
  ctx.arc(sx, sy, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Puck body
  ctx.beginPath();
  ctx.arc(sx, sy, 8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // LED center dot
  ctx.beginPath();
  ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
}

function drawBushings(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number,
  w: number, h: number
) {
  const hw = w / 2;
  const offsets = [-0.25, 0, 0.25];
  for (const xOff of offsets) {
    const x = xOff * w;
    const top = h + 0.06;
    const base = h;

    const [tx, ty] = isoProject(x, top, 0, cx, cy, scale);
    const [bx, by] = isoProject(x, base, 0, cx, cy, scale);

    // Bushing cylinder (simplified as line + circle)
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = "#8B6914";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Insulator ring
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f0e0";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Top cap
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#8B6914";
    ctx.fill();
  }
}

function drawCoolingFins(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, scale: number,
  w: number, h: number, d: number
) {
  const hw = w / 2, hd = d / 2;
  const numFins = 6;
  const spacing = h / (numFins + 1);
  const finW = w * 0.85;

  for (let i = 1; i <= numFins; i++) {
    const yPos = spacing * i;

    // Front fins
    const fl = isoProject(-finW / 2, yPos, -hd - 0.008, cx, cy, scale);
    const fr = isoProject(finW / 2, yPos, -hd - 0.008, cx, cy, scale);
    ctx.beginPath();
    ctx.moveTo(...fl); ctx.lineTo(...fr);
    ctx.strokeStyle = "rgba(100,100,100,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  canvasW: number, canvasH: number,
  config: SimulationConfig,
  result: SimulationResult
) {
  const dpr = window.devicePixelRatio || 1;

  // Face label
  ctx.font = `${10 * dpr}px ui-monospace, SFMono-Regular, monospace`;
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.textAlign = "left";
  ctx.fillText(
    `${config.mountingFace.toUpperCase()} FACE · ${config.kvaRating} kVA ${config.transformerType}`,
    8 * dpr, canvasH - 10 * dpr
  );

  // Flux label
  ctx.textAlign = "right";
  ctx.fillText(
    `Peak: ${result.peakFluxAtMount.toFixed(1)} µT · Load: ${config.loadPercent}%`,
    canvasW - 8 * dpr, canvasH - 10 * dpr
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function TransformerScene({ config, result }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  const heatmap = useMemo(() => result.fluxHeatmap, [result.fluxHeatmap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const rect = container!.getBoundingClientRect();
      const cw = rect.width * dpr;
      const ch = rect.height * dpr;

      canvas!.width = cw;
      canvas!.height = ch;
      canvas!.style.width = rect.width + "px";
      canvas!.style.height = rect.height + "px";

      ctx!.clearRect(0, 0, cw, ch);

      // Background
      ctx!.fillStyle = "#111";
      ctx!.fillRect(0, 0, cw, ch);

      // Subtle grid floor
      ctx!.strokeStyle = "rgba(255,255,255,0.03)";
      ctx!.lineWidth = 0.5;
      const gridStep = 20 * dpr;
      for (let x = 0; x < cw; x += gridStep) {
        ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, ch); ctx!.stroke();
      }
      for (let y = 0; y < ch; y += gridStep) {
        ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(cw, y); ctx!.stroke();
      }

      // Transformer dimensions
      const w = config.enclosureWidth / 100;
      const h = config.enclosureHeight / 100;
      const d = config.enclosureDepth / 100;

      // Scale to fit — use more space
      const maxDim = Math.max(w, h, d) * 1.2;
      const scale = Math.min(cw, ch) * 0.55 / maxDim;
      const cx = cw * 0.48;
      const cy = ch * 0.58;

      // Draw transformer box
      drawIsoBox(
        ctx!, cx, cy, scale, w, h, d,
        "#4a4a4a",  // top
        "#353535",  // left (front)
        "#2a2a2a"   // right (side)
      );

      // Cooling fins
      drawCoolingFins(ctx!, cx, cy, scale, w, h, d);

      // Flux heatmap overlay
      drawHeatmapOnFace(ctx!, cx, cy, scale, config, heatmap);

      // Terminal bushings
      drawBushings(ctx!, cx, cy, scale, w, h);

      // Device puck
      timeRef.current += 0.016;
      drawDevicePuck(ctx!, cx, cy, scale, config, result, timeRef.current);

      // Labels
      drawLabels(ctx!, cw, ch, config, result);

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [config, result, heatmap]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden bg-[#111]"
      data-testid="3d-scene"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
}
