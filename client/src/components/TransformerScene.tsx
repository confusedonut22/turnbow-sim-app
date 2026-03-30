import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Environment, Float } from "@react-three/drei";
import * as THREE from "three";
import { SimulationConfig, SimulationResult } from "@/lib/simulation";

// ── Flux Heatmap Texture ────────────────────────────────────────────────────

function createHeatmapTexture(heatmap: number[][]): THREE.DataTexture {
  const size = heatmap.length;
  const data = new Uint8Array(size * size * 4);

  // Find range for normalization
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = heatmap[y][x];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min || 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const t = (heatmap[y][x] - min) / range; // 0..1

      // Blue → Cyan → Green → Yellow → Red
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
      data[idx] = Math.floor(r * 255);
      data[idx + 1] = Math.floor(g * 255);
      data[idx + 2] = Math.floor(b * 255);
      data[idx + 3] = Math.floor(0.55 * 255); // semi-transparent
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ── Transformer Box ─────────────────────────────────────────────────────────

function TransformerBox({ config }: { config: SimulationConfig }) {
  const w = config.enclosureWidth / 100; // cm → meters
  const h = config.enclosureHeight / 100;
  const d = config.enclosureDepth / 100;

  return (
    <group>
      {/* Main tank body */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color="#3a3a3a"
          metalness={0.7}
          roughness={0.35}
        />
      </mesh>

      {/* Cooling fins (front/back) */}
      {[-1, 1].map((side) =>
        Array.from({ length: 6 }).map((_, i) => {
          const spacing = h / 7;
          const yPos = spacing * (i + 1);
          return (
            <mesh
              key={`fin-${side}-${i}`}
              position={[0, yPos, side * (d / 2 + 0.005)]}
            >
              <boxGeometry args={[w * 0.85, 0.01, 0.025]} />
              <meshStandardMaterial color="#4a4a4a" metalness={0.6} roughness={0.4} />
            </mesh>
          );
        })
      )}

      {/* Terminal bushings on top */}
      {[-0.25, 0, 0.25].map((xOff, i) => (
        <group key={`bushing-${i}`} position={[xOff * w, h + 0.04, 0]}>
          <mesh>
            <cylinderGeometry args={[0.02, 0.025, 0.08, 12]} />
            <meshStandardMaterial color="#8B4513" metalness={0.3} roughness={0.6} />
          </mesh>
          {/* Insulator ring */}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.015, 12]} />
            <meshStandardMaterial color="#f5f0e0" metalness={0.0} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Nameplate */}
      <mesh position={[0, h * 0.75, d / 2 + 0.002]}>
        <planeGeometry args={[w * 0.3, 0.06]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ── Device Puck ─────────────────────────────────────────────────────────────

function DevicePuck({
  config,
  result,
}: {
  config: SimulationConfig;
  result: SimulationResult;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const w = config.enclosureWidth / 100;
  const h = config.enclosureHeight / 100;
  const d = config.enclosureDepth / 100;

  // Position on chosen face
  let pos: [number, number, number];
  const px = config.mountPositionX;
  const py = config.mountPositionY;

  switch (config.mountingFace) {
    case "front":
      pos = [
        (px - 0.5) * w,
        py * h,
        d / 2 + 0.015,
      ];
      break;
    case "side":
      pos = [
        w / 2 + 0.015,
        py * h,
        (px - 0.5) * d,
      ];
      break;
    case "top":
      pos = [
        (px - 0.5) * w,
        h + 0.015,
        (py - 0.5) * d,
      ];
      break;
  }

  // Rotation to face outward
  let rotation: [number, number, number] = [0, 0, 0];
  if (config.mountingFace === "front") rotation = [Math.PI / 2, 0, 0];
  else if (config.mountingFace === "side") rotation = [0, 0, Math.PI / 2];

  // Color based on viability
  const color = result.viable && result.minSOC > 0.2
    ? "#3b82f6"
    : result.viable || result.minSOC > 0.05
    ? "#f59e0b"
    : "#ef4444";

  // Pulse animation
  useFrame((state) => {
    if (glowRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
      glowRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={pos} rotation={rotation}>
      {/* Main puck */}
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.04, 0.04, 0.025, 24]} />
        <meshStandardMaterial
          color={color}
          metalness={0.4}
          roughness={0.3}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Glow ring */}
      <mesh ref={glowRef}>
        <torusGeometry args={[0.045, 0.003, 8, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* LED dot */}
      <mesh position={[0, 0.013, 0]}>
        <sphereGeometry args={[0.005, 8, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  );
}

// ── Flux Heatmap Overlay ────────────────────────────────────────────────────

function FluxOverlay({
  config,
  result,
}: {
  config: SimulationConfig;
  result: SimulationResult;
}) {
  const texture = useMemo(
    () => createHeatmapTexture(result.fluxHeatmap),
    [result.fluxHeatmap]
  );

  const w = config.enclosureWidth / 100;
  const h = config.enclosureHeight / 100;
  const d = config.enclosureDepth / 100;

  let pos: [number, number, number];
  let rot: [number, number, number];
  let size: [number, number];

  switch (config.mountingFace) {
    case "front":
      pos = [0, h / 2, d / 2 + 0.003];
      rot = [0, 0, 0];
      size = [w, h];
      break;
    case "side":
      pos = [w / 2 + 0.003, h / 2, 0];
      rot = [0, Math.PI / 2, 0];
      size = [d, h];
      break;
    case "top":
      pos = [0, h + 0.003, 0];
      rot = [-Math.PI / 2, 0, 0];
      size = [w, d];
      break;
  }

  return (
    <mesh position={pos} rotation={rot}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={texture}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Scene ───────────────────────────────────────────────────────────────────

function Scene({
  config,
  result,
}: {
  config: SimulationConfig;
  result: SimulationResult;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-3, 4, -3]} intensity={0.3} />

      <TransformerBox config={config} />
      <DevicePuck config={config} result={result} />
      <FluxOverlay config={config} result={result} />

      <Grid
        position={[0, -0.01, 0]}
        args={[10, 10]}
        cellSize={0.2}
        cellThickness={0.5}
        cellColor="#333"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#444"
        fadeDistance={6}
        infiniteGrid
      />

      <OrbitControls
        makeDefault
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={0.5}
        maxDistance={5}
        target={[0, (config.enclosureHeight / 100) / 2, 0]}
      />

      <Environment preset="city" />
    </>
  );
}

// ── Exported Canvas ─────────────────────────────────────────────────────────

interface Props {
  config: SimulationConfig;
  result: SimulationResult;
}

export function TransformerScene({ config, result }: Props) {
  return (
    <div className="w-full h-full rounded-lg overflow-hidden bg-[#111]" data-testid="3d-scene">
      <Canvas
        camera={{ position: [1.5, 1.2, 1.8], fov: 50 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <Scene config={config} result={result} />
      </Canvas>
    </div>
  );
}
