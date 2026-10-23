"use client";

/**
 * The signature hero scene (lazy chunk, client only). Fourteen resume claims float as paper
 * fragments; as the hero scrolls they get struck through, fly into formation and collapse into
 * lime verified seals joined as a constellation. Driven by a 0..1 scroll MotionValue that is read
 * inside the frame loop, so scrolling never re-renders React.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { rosettePath } from "@/components/ui/seal-glyph";

export const CLAIMS = [
  "10/10 in React",
  "team player",
  "expert in AI",
  "hardworking",
  "quick learner",
  "5+ years of Python",
  "MS Office pro",
  "full-stack ninja",
  "passionate coder",
  "detail-oriented",
  "built scalable apps",
  "great communicator",
  "blockchain enthusiast",
  "strong problem solver",
];

/** Scattered starting layout, normalised to the viewport (x, y in -0.5..0.5, z depth, tilt). */
const SCATTER_WIDE: [number, number, number, number][] = [
  [0.08, 0.32, 0.4, -0.18], [0.36, 0.38, -1.2, 0.12], [0.22, 0.12, 0.9, 0.08], [0.43, 0.05, -0.4, -0.22],
  [0.12, -0.18, -1.8, 0.16], [0.33, -0.3, 0.6, -0.1], [-0.4, -0.38, -2.4, 0.2], [0.02, -0.38, -0.6, -0.06],
  [0.44, -0.42, -1.6, 0.18], [-0.46, -0.44, -2.8, -0.14], [0.27, 0.25, -2.2, 0.24], [0.18, -0.06, -3, -0.2],
  [0.1, 0.42, -3.4, 0.1], [0.4, 0.2, 1.2, -0.12],
];
const SCATTER_TALL: [number, number, number, number][] = [
  [-0.22, -0.08, 0.2, -0.16], [0.24, -0.12, -1, 0.14], [-0.05, -0.2, 0.8, 0.06], [0.28, -0.26, -0.2, -0.2],
  [-0.3, -0.3, -1.4, 0.18], [0.1, -0.34, 0.5, -0.1], [-0.18, -0.42, -2, 0.2], [0.3, -0.44, -0.8, -0.08],
  [-0.02, -0.46, -1.6, 0.16], [0.22, -0.02, -2.6, -0.12], [-0.32, -0.16, -2.4, 0.22], [0.02, -0.08, -3, -0.18],
  [-0.12, -0.36, -3.2, 0.1], [0.32, -0.36, 1, -0.14],
];
/** Constellation the seals settle into, in a unit box (-1..1). */
const STARS: [number, number][] = [
  [-0.86, 0.52], [-0.52, 0.72], [-0.18, 0.46], [0.16, 0.66], [0.52, 0.86], [0.86, 0.5], [0.62, 0.12],
  [0.22, 0.04], [-0.3, -0.04], [-0.72, -0.24], [-0.4, -0.62], [0.02, -0.5], [0.46, -0.36], [0.82, -0.78],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 2], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 6], [12, 13], [8, 11],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function paperTexture(text: string, dark: boolean, fontsReady: boolean) {
  const display = fontsReady ? "'Bricolage Grotesque Variable', 'Inter Variable', sans-serif" : "ui-sans-serif, system-ui, sans-serif";
  const W = 640;
  const H = 200;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const r = 26;
  ctx.beginPath();
  ctx.roundRect(4, 4, W - 8, H - 8, r);
  ctx.fillStyle = dark ? "#f3efe4" : "#fffdf8";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = dark ? "rgba(10,11,16,0.12)" : "#cbc3b2";
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(22,21,26,0.07)";
  ctx.lineWidth = 2;
  for (let y = 46; y < H; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#6f6a60";
  ctx.font = "600 22px 'JetBrains Mono Variable', ui-monospace, monospace";
  ctx.fillText("CLAIM · SELF-REPORTED", 36, 52);
  ctx.fillStyle = "#16151a";
  let size = 66;
  ctx.font = `600 ${size}px ${display}`;
  while (ctx.measureText(`“${text}”`).width > W - 72 && size > 30) {
    size -= 2;
    ctx.font = `600 ${size}px ${display}`;
  }
  ctx.fillText(`“${text}”`, 34, 138);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function sealTexture() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.scale(S / 100, S / 100);
  ctx.fillStyle = "#c6f432";
  ctx.fill(new Path2D(rosettePath(50, 50, 49, 45.5, 36)));
  ctx.strokeStyle = "rgba(10,11,16,0.85)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(50, 50, 41, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(50, 50, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 6.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D("M37.5 50.5l9 9 16-17"));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type Layout = { start: THREE.Vector3[]; tilt: number[]; end: THREE.Vector3[]; sealSize: number; paperScale: number };

/**
 * The hero copy (badge, headline, paragraph, buttons) in viewport-normalised coordinates
 * (x left to right, y bottom to top, both -0.5..0.5). No claim card or seal may sit inside it.
 */
export type Exclusion = { x0: number; x1: number; y0: number; y1: number };

const CAM_Z = 12;
const PAPER_W = 3.2;
const PAPER_H = 1;
// Breathing room around the copy; also absorbs the idle float and the pointer parallax.
const PAD_X = 0.03;
const PAD_Y = 0.035;

/**
 * Moves a card whose projected box overlaps the exclusion to the nearest free side (right, left,
 * below, above). Cards may bleed off the screen edge, as the scatter already does; a card with
 * no free side starts off-screen right and flies in.
 */
function clearOfCopy(ex: Exclusion, sx: number, sy: number, hw: number, hh: number): [number, number] {
  const ox0 = ex.x0 - PAD_X - hw;
  const ox1 = ex.x1 + PAD_X + hw;
  const oy0 = ex.y0 - PAD_Y - hh;
  const oy1 = ex.y1 + PAD_Y + hh;
  if (sx <= ox0 || sx >= ox1 || sy <= oy0 || sy >= oy1) return [sx, sy];
  const fitsX = (x: number) => x - hw * 0.6 >= -0.5 && x + hw * 0.6 <= 0.5;
  const fitsY = (y: number) => y - hh * 0.5 >= -0.5 && y + hh * 0.5 <= 0.5;
  const options: [number, number][] = [];
  if (fitsX(ox1)) options.push([ox1, sy]);
  if (fitsX(ox0)) options.push([ox0, sy]);
  if (fitsY(oy0)) options.push([sx, oy0]);
  if (fitsY(oy1)) options.push([sx, oy1]);
  if (!options.length) return [0.5 + hw * 1.2, sy];
  let best = options[0]!;
  for (const o of options) if (Math.hypot(o[0] - sx, o[1] - sy) < Math.hypot(best[0] - sx, best[1] - sy)) best = o;
  return best;
}

function computeLayout(w: number, h: number, ex: Exclusion | null): Layout {
  const tall = w / h < 0.9;
  const scatter = tall ? SCATTER_TALL : SCATTER_WIDE;
  const paperScale = tall ? Math.min(0.62, w * 0.17) : Math.min(1, w * 0.075);
  const sealSize = tall ? Math.min(0.62, w * 0.11) : Math.min(0.85, h * 0.085);

  let center = tall ? new THREE.Vector2(0, -h * 0.27) : new THREE.Vector2(w * 0.24, -h * 0.02);
  let half = tall ? new THREE.Vector2(w * 0.4, h * 0.17) : new THREE.Vector2(Math.min(w * 0.2, h * 0.45), h * 0.33);
  if (ex) {
    // The constellation settles in the free space beside (wide) or below (tall) the copy.
    const sealX = sealSize / w + 0.02;
    const sealY = sealSize / h + 0.02;
    if (tall) {
      const top = ex.y0 - PAD_Y;
      center = new THREE.Vector2(0, ((top - 0.47) / 2) * h);
      half = new THREE.Vector2(w * 0.4, Math.max(0.05, Math.min(0.17, (top + 0.47) / 2 - sealY)) * h);
    } else {
      const left = ex.x1 + PAD_X;
      center = new THREE.Vector2(((left + 0.5) / 2) * w, -h * 0.02);
      half = new THREE.Vector2(Math.min(Math.max(0.06, (0.5 - left) / 2 - sealX) * w, h * 0.45), h * 0.33);
    }
  }

  const start = scatter.map(([x, y, z, tilt]) => {
    if (!ex) return new THREE.Vector3(x * w, y * h, z);
    // Project onto the screen, clear the copy there, then un-project at the same depth.
    const f = CAM_Z / (CAM_Z - z);
    const c = Math.abs(Math.cos(tilt));
    const s = Math.abs(Math.sin(tilt));
    const hwWorld = ((PAPER_W * c + PAPER_H * s) * paperScale) / 2;
    const hhWorld = ((PAPER_W * s + PAPER_H * c) * paperScale) / 2;
    const [sx, sy] = clearOfCopy(ex, x * f, y * f, (hwWorld * f) / w, (hhWorld * f) / h);
    return new THREE.Vector3((sx / f) * w, (sy / f) * h, z);
  });

  return {
    start,
    tilt: scatter.map(([, , , t]) => t),
    end: STARS.map(([x, y]) => new THREE.Vector3(center.x + x * half.x, center.y + y * half.y, 0.5)),
    sealSize,
    paperScale,
  };
}

function Scene({ progress, dark, exclude }: { progress: MotionValue<number>; dark: boolean; exclude: Exclusion | null }) {
  const { viewport, size } = useThree();
  const items = useRef<(THREE.Group | null)[]>([]);
  const papers = useRef<(THREE.Mesh | null)[]>([]);
  const strikes = useRef<(THREE.Mesh | null)[]>([]);
  const seals = useRef<(THREE.Mesh | null)[]>([]);
  const root = useRef<THREE.Group>(null);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const smoothed = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });

  const w = viewport.width;
  const h = viewport.height;
  const layout = useMemo(() => computeLayout(w, h, exclude), [w, h, exclude]);

  // Redraw once webfonts are ready so claims render in Bricolage, not the fallback.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const paperTex = useMemo(() => CLAIMS.map((c) => paperTexture(c, dark, fontsReady)), [dark, fontsReady]);
  const sealTex = useMemo(() => sealTexture(), []);
  useEffect(() => () => paperTex.forEach((t) => t.dispose()), [paperTex]);
  useEffect(() => () => sealTex.dispose(), [sealTex]);

  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts: number[] = [];
    for (const [a, b] of EDGES) {
      const pa = layout.end[a]!;
      const pb = layout.end[b]!;
      pts.push(pa.x, pa.y, 0.2, pb.x, pb.y, 0.2);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [layout]);
  useEffect(() => () => lineGeo.dispose(), [lineGeo]);

  const dust = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts: number[] = [];
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 180; i++) pts.push((rnd() - 0.5) * w * 1.3, (rnd() - 0.5) * h * 1.3, -4 - rnd() * 4);
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [w, h]);
  useEffect(() => () => dust.dispose(), [dust]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / size.width) * 2 - 1;
      pointer.current.y = (e.clientY / size.height) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [size.width, size.height]);

  useFrame((state, dt) => {
    const target = progress.get();
    smoothed.current += (target - smoothed.current) * Math.min(1, dt * 5);
    const p = smoothed.current;
    const t = state.clock.elapsedTime;

    if (root.current) {
      root.current.rotation.y += (pointer.current.x * 0.07 - root.current.rotation.y) * Math.min(1, dt * 3);
      root.current.rotation.x += (pointer.current.y * 0.05 - root.current.rotation.x) * Math.min(1, dt * 3);
    }

    for (let i = 0; i < CLAIMS.length; i++) {
      const g = items.current[i];
      if (!g) continue;
      const local = clamp01((p - 0.06 - i * 0.022) / 0.55);
      const e = easeInOut(local);
      const s = layout.start[i]!;
      const end = layout.end[i]!;
      const float = 1 - e;
      g.position.set(
        THREE.MathUtils.lerp(s.x, end.x, e) + Math.sin(t * 0.5 + i * 1.7) * 0.12 * float,
        THREE.MathUtils.lerp(s.y, end.y, e) + Math.cos(t * 0.6 + i) * 0.14 * float,
        THREE.MathUtils.lerp(s.z, end.z, e),
      );
      g.rotation.z = THREE.MathUtils.lerp(layout.tilt[i]!, 0, e) + Math.sin(t * 0.4 + i) * 0.04 * float;
      g.rotation.y = Math.sin(t * 0.35 + i * 2.1) * 0.35 * float;

      const paper = papers.current[i];
      const fade = 1 - smooth(0.62, 0.86, local);
      if (paper) {
        paper.scale.setScalar(layout.paperScale * (0.35 + 0.65 * fade));
        (paper.material as THREE.MeshBasicMaterial).opacity = fade;
        paper.visible = fade > 0.01;
      }
      const strike = strikes.current[i];
      if (strike) {
        const k = smooth(0.12, 0.42, local);
        strike.scale.set(Math.max(0.0001, k) * layout.paperScale * (0.35 + 0.65 * fade), layout.paperScale, 1);
        const ps = layout.paperScale * (0.35 + 0.65 * fade);
        strike.position.x = (-1.05 + 1.05 * k) * ps - 0.2 * ps;
        strike.position.y = -0.1 * ps;
        (strike.material as THREE.MeshBasicMaterial).opacity = fade;
        strike.visible = k > 0.001 && fade > 0.01;
      }
      const seal = seals.current[i];
      if (seal) {
        const k = smooth(0.66, 1, local);
        seal.scale.setScalar(Math.max(0.0001, easeOutBack(k)) * layout.sealSize);
        seal.rotation.z = -0.14 - (1 - k) * 0.9;
        seal.visible = k > 0.001;
      }
    }
    if (lineMat.current) lineMat.current.opacity = smooth(0.72, 0.98, p) * (dark ? 0.55 : 0.5);
  });

  return (
    <group ref={root}>
      <points geometry={dust}>
        <pointsMaterial size={0.035} color={dark ? "#3a4052" : "#c9c1ae"} transparent opacity={0.9} sizeAttenuation />
      </points>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial ref={lineMat} color={dark ? "#c6f432" : "#3f5a00"} transparent opacity={0} />
      </lineSegments>
      {CLAIMS.map((c, i) => (
        <group
          key={c}
          ref={(el) => {
            items.current[i] = el;
          }}
        >
          <mesh
            ref={(el) => {
              papers.current[i] = el;
            }}
            renderOrder={1}
          >
            <planeGeometry args={[3.2, 1]} />
            <meshBasicMaterial map={paperTex[i]} transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh
            ref={(el) => {
              strikes.current[i] = el;
            }}
            position={[0, 0, 0.01]}
            renderOrder={2}
          >
            <planeGeometry args={[2.1, 0.05]} />
            <meshBasicMaterial color="#ff6b4a" transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh
            ref={(el) => {
              seals.current[i] = el;
            }}
            position={[0, 0, 0.05]}
            renderOrder={3}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={sealTex} transparent depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function HeroCanvas({
  progress,
  dark,
  active,
  exclude,
}: {
  progress: MotionValue<number>;
  dark: boolean;
  active: boolean;
  exclude: Exclusion | null;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, CAM_Z], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop={active ? "always" : "never"}
      aria-hidden
      style={{ position: "absolute", inset: 0 }}
    >
      <Scene progress={progress} dark={dark} exclude={exclude} />
    </Canvas>
  );
}
