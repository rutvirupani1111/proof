import QRCode from "qrcode";
import { rosettePath } from "@/components/ui/seal-glyph";

/**
 * Proof Pass QR: error correction H, data modules as rounded dots, the three finder patterns
 * drawn as mini seals (a scalloped ring around a scalloped core, which keeps the 1:1:3:1:1 run
 * scanners look for on every axis), alignment patterns as concentric rings, and the Proof seal
 * in a cleared disc at the centre (well inside H's 30% recovery budget).
 *
 * Pure and isomorphic: the profile page renders it to an SVG string for the card, the pass
 * image route embeds the same string, and the unit test decodes it with jsQR.
 */

export type PassQr = {
  /** Modules per side (excluding the quiet margin). */
  size: number;
  version: number;
  margin: number;
  dots: Array<[number, number]>;
  finders: Array<[number, number]>;
  aligns: Array<[number, number]>;
  logo: { cx: number; cy: number; r: number };
};

const INK = "#0a0b10";
const DEEP_VIOLET = "#4b2fd8";
const LIME = "#c6f432";
const PLATE = "#fffdf8";

/** Alignment pattern centres per ISO 18004 (same table qrcode derives internally). */
function alignmentCoords(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const interval = size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2;
  const pos = [size - 7];
  for (let i = 1; i < count - 1; i++) pos[i] = pos[i - 1]! - interval;
  pos.push(6);
  return pos.reverse();
}

export function buildPassQr(text: string, margin = 2): PassQr {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const dark = (r: number, c: number) => data[r * size + c] === 1;

  const finderOrigins: Array<[number, number]> = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  const inFinder = (r: number, c: number) => finderOrigins.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);

  const coords = alignmentCoords(qr.version);
  const aligns: Array<[number, number]> = [];
  for (const r of coords)
    for (const c of coords) {
      // Skip the three that would sit on a finder.
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      aligns.push([r, c]);
    }
  const inAlign = (r: number, c: number) => aligns.some(([ar, ac]) => Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2);

  // Centre logo: a disc about a fifth of the symbol wide, never touching an alignment pattern.
  const centre = (size - 1) / 2;
  const logoR = Math.max(3.5, Math.round(size * 0.11) + 0.5);
  const inLogo = (r: number, c: number) => Math.hypot(r - centre, c - centre) <= logoR + 0.35;

  const dots: Array<[number, number]> = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      if (!dark(r, c) || inFinder(r, c) || inAlign(r, c)) continue;
      if (inLogo(r, c)) continue;
      dots.push([r, c]);
    }

  return {
    size,
    version: qr.version,
    margin,
    dots,
    finders: finderOrigins.map(([r, c]) => [r + 3, c + 3]),
    aligns,
    logo: { cx: centre, cy: centre, r: logoR },
  };
}

/** Deterministic 0..1 noise so server and client agree on every dot's scatter. */
function noise(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export type RenderOpts = {
  /** Unique id prefix for gradient defs (several QRs can share a page). */
  id: string;
  /** Pixel width/height attributes. CSS can still resize it. */
  px?: number;
  /** Paint the light plate behind the modules. */
  plate?: string | null;
  /** Emit per-dot scatter vars and classes for the assemble animation. */
  animate?: boolean;
  /** Accessible label; omitted means decorative (aria-hidden). */
  label?: string;
};

export function renderPassQrSvg(qr: PassQr, { id, px = 512, plate = PLATE, animate = false, label }: RenderOpts): string {
  const w = qr.size + qr.margin * 2;
  const o = qr.margin + 0.5; // module centre offset
  const f = (n: number) => +n.toFixed(3);
  const g = `${id}-g`;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" width="${px}" height="${px}" shape-rendering="geometricPrecision"${
      label ? ` role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : ` aria-hidden="true"`
    }>`,
  );
  parts.push(
    `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${INK}"/><stop offset="0.55" stop-color="#1d1450"/><stop offset="1" stop-color="${DEEP_VIOLET}"/></linearGradient></defs>`,
  );
  if (plate) parts.push(`<rect width="${w}" height="${w}" fill="${plate}"/>`);

  // Data dots.
  parts.push(`<g fill="url(#${g})">`);
  qr.dots.forEach(([r, c], i) => {
    const cx = f(c + o);
    const cy = f(r + o);
    if (animate) {
      const a = noise(i, 1) * Math.PI * 2;
      const d = 4 + noise(i, 2) * 10;
      const dx = f(Math.cos(a) * d);
      const dy = f(Math.sin(a) * d);
      const delay = Math.round((Math.hypot(r - qr.size / 2, c - qr.size / 2) / qr.size) * 520 + noise(i, 3) * 260);
      parts.push(`<circle class="pq-dot" cx="${cx}" cy="${cy}" r="0.44" style="--dx:${dx}px;--dy:${dy}px;--d:${delay}ms"/>`);
    } else {
      parts.push(`<circle cx="${cx}" cy="${cy}" r="0.44"/>`);
    }
  });
  parts.push(`</g>`);

  // Finders as mini seals. 16 scallops put a peak on both axes and both diagonals.
  const bg = plate ?? PLATE;
  for (const [r, c] of qr.finders) {
    const cx = c + o;
    const cy = r + o;
    parts.push(
      `<g class="pq-finder"><path d="${rosettePath(cx, cy, 3.55, 3.28, 16)}" fill="url(#${g})"/><circle cx="${f(cx)}" cy="${f(cy)}" r="2.5" fill="${bg}"/><path d="${rosettePath(cx, cy, 1.6, 1.38, 10)}" fill="${INK}"/></g>`,
    );
  }

  // Alignment patterns as concentric rings.
  for (const [r, c] of qr.aligns) {
    const cx = f(c + o);
    const cy = f(r + o);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="2.5" fill="url(#${g})"/><circle cx="${cx}" cy="${cy}" r="1.5" fill="${bg}"/><circle cx="${cx}" cy="${cy}" r="0.55" fill="${INK}"/>`);
  }

  // Centre seal: lime rosette, ink rings and check, tilted like the brand mark.
  const { cx: lx, cy: ly, r: lr } = qr.logo;
  const cx = lx + o;
  const cy = ly + o;
  const s = lr / 50; // seal artwork is authored on a 100-unit box
  parts.push(
    `<g class="pq-logo"><g transform="translate(${f(cx - 50 * s)} ${f(cy - 50 * s)}) scale(${f(s)}) rotate(-8 50 50)"><path d="${rosettePath(50, 50, 49, 45.5, 24)}" fill="${LIME}" stroke="${INK}" stroke-width="2"/><circle cx="50" cy="50" r="40" fill="none" stroke="${INK}" stroke-width="2.2"/><path d="M33 51l11.5 11.5 22-23" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g></g>`,
  );
  parts.push(`</svg>`);
  return parts.join("");
}

export function passQrDataUri(svg: string) {
  const b64 = typeof Buffer !== "undefined" ? Buffer.from(svg).toString("base64") : btoa(svg);
  return `data:image/svg+xml;base64,${b64}`;
}
