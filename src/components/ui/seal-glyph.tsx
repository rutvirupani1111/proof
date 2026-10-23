import type { SVGProps } from "react";

/** Scalloped rosette path, deterministic so it renders identically on server and client. */
export function rosettePath(cx: number, cy: number, outer: number, inner: number, points: number) {
  const step = Math.PI / points;
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = i * step - Math.PI / 2;
    const x = (cx + r * Math.cos(a)).toFixed(2);
    const y = (cy + r * Math.sin(a)).toFixed(2);
    d += `${i === 0 ? "M" : "L"}${x} ${y} `;
  }
  return `${d}Z`;
}

const GLYPH = rosettePath(12, 12, 11.5, 9.6, 12);

/** Inline verified mark (rosette + check). Inherits `currentColor`. */
export function SealGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" {...props}>
      <path d={GLYPH} fill="currentColor" />
      <path
        d="M7.6 12.3l2.9 2.9 5.9-6.2"
        fill="none"
        stroke="var(--surface, #fff)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
