import jsQR from "jsqr";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildPassQr, renderPassQrSvg } from "./qr";

/** Rasterise the exact SVG string the card ships, add a white quiet zone, and decode it. */
async function decode(svg: string, px: number) {
  const pad = Math.round(px * 0.08);
  const { data, info } = await sharp(Buffer.from(svg), { density: 288 })
    .resize(px, px)
    .flatten({ background: "#ffffff" })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
}

const URLS = [
  "https://proof-pink-eta.vercel.app/u/ishita-varma?via=pass",
  "http://localhost:5190/u/a?via=pass",
  "https://proof-pink-eta.vercel.app/u/a-really-long-handle-for-someone-with-many-names?via=pass",
];

describe("Proof Pass QR", () => {
  it("uses error correction H and clears a centre disc for the seal", () => {
    const qr = buildPassQr(URLS[0]!);
    expect(qr.finders).toHaveLength(3);
    expect(qr.logo.r).toBeGreaterThanOrEqual(3.5);
    // The cleared disc stays well inside H's ~30% recovery budget.
    const cleared = Math.PI * qr.logo.r ** 2;
    expect(cleared / qr.size ** 2).toBeLessThan(0.12);
  });

  for (const url of URLS) {
    for (const px of [240, 520]) {
      it(`decodes ${url.length} chars at ${px}px (static and animated markup)`, async () => {
        const qr = buildPassQr(url);
        for (const animate of [false, true]) {
          const svg = renderPassQrSvg(qr, { id: "t", px: 512, animate });
          const result = await decode(svg, px);
          expect(result?.data).toBe(url);
        }
      });
    }
  }
});
