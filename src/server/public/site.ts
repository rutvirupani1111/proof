import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";

/** Absolute origin of the current request (works on localhost, previews and production). */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:5190";
}

/**
 * QR code as an SVG string. Always dark modules on a light plate (scanners need the contrast),
 * so render it on a white/paper tile in both themes.
 */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#0a0b10", light: "#00000000" },
  });
}
