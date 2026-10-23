import { ImageResponse } from "next/og";
import { buildPassQr, passQrDataUri, renderPassQrSvg } from "@/components/profile/pass/qr";
import { rosettePath } from "@/components/ui/seal-glyph";
import { getShareCard } from "@/server/public/queries";
import { getOrigin } from "@/server/public/site";

export const dynamic = "force-dynamic";

const INK = "#0B0C12";
const PAPER = "#F3F0E8";
const LIME = "#C6F432";
const MUTED = "#A7A399";

function seal(px: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"><g transform="rotate(-8 50 50)"><path d="${rosettePath(50, 50, 49, 45.5, 36)}" fill="${LIME}"/><circle cx="50" cy="50" r="41" fill="none" stroke="#0A0B10" stroke-width="1.6"/><path d="M36 51l10 10 19-20" fill="none" stroke="#0A0B10" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function ring(score: number, px: number) {
  const c = 2 * Math.PI * 42;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="8"/><circle cx="50" cy="50" r="42" fill="none" stroke="${LIME}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(2)}" transform="rotate(-90 50 50)"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function serial(handle: string) {
  let h = 2166136261;
  for (const ch of handle) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}

/** The Proof Pass as a 1080x1440 PNG (Download pass, and the file attached to native share). Public dossiers only. */
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const card = await getShareCard(handle);
  if (!card) return new Response("Not found", { status: 404 });

  const origin = await getOrigin();
  const passUrl = `${origin}/u/${card.handle}?via=pass`;
  const qr = passQrDataUri(renderPassQrSvg(buildPassQr(passUrl), { id: "og", px: 560 }));
  const skills = card.skills.slice(0, 3);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#E9E4D8", padding: 48 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: 56,
            background: INK,
            color: PAPER,
            overflow: "hidden",
            position: "relative",
            backgroundImage: `radial-gradient(circle at 0% 0%, rgba(124,92,255,0.45), transparent 55%), radial-gradient(circle at 100% 100%, rgba(198,244,50,0.20), transparent 55%), linear-gradient(115deg, rgba(124,92,255,0) 30%, rgba(124,92,255,0.22) 42%, rgba(64,214,255,0.16) 50%, rgba(198,244,50,0.18) 58%, rgba(124,92,255,0) 70%)`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "56px 64px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 44, fontWeight: 700 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={seal(56)} width={56} height={56} alt="" />
              proof
            </div>
            <div style={{ display: "flex", fontSize: 24, letterSpacing: 5, color: MUTED }}>{`PASS · NO. ${serial(card.handle)}`}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", padding: "44px 64px 0" }}>
            <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.04 }}>{card.name}</div>
            <div style={{ fontSize: 34, color: LIME, marginTop: 10 }}>{`@${card.handle}`}</div>
            {card.college && <div style={{ fontSize: 28, color: MUTED, marginTop: 8 }}>{card.college}</div>}
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
            <div style={{ display: "flex", padding: 26, borderRadius: 40, background: "#FFFDF8", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} width={500} height={500} alt="" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", fontSize: 22, letterSpacing: 5, color: "#8D8981", marginTop: 22 }}>SCAN TO OPEN THE VERIFIED DOSSIER</div>

          <div style={{ display: "flex", alignItems: "center", margin: "36px 0 0", position: "relative" }}>
            <div style={{ display: "flex", width: 56, height: 56, borderRadius: 999, background: "#E9E4D8", marginLeft: -28 }} />
            <div style={{ display: "flex", flex: 1, height: 0, borderTop: "3px dashed rgba(255,255,255,0.16)", margin: "0 18px" }} />
            <div style={{ display: "flex", width: 56, height: 56, borderRadius: 999, background: "#E9E4D8", marginRight: -28 }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 36, padding: "28px 64px 0" }}>
            <div style={{ display: "flex", width: 150, height: 150, position: "relative", alignItems: "center", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ring(card.score, 150)} width={150} height={150} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
              <div style={{ display: "flex", fontSize: 52, fontWeight: 700 }}>{String(card.score)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, fontSize: 30 }}>
                <span style={{ fontWeight: 700, fontSize: 40 }}>{String(card.seals)}</span>
                <span style={{ color: MUTED }}>{`${card.seals === 1 ? "seal" : "seals"} · Proof Score`}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
                {skills.map((s) => (
                  <div key={s} style={{ display: "flex", fontSize: 24, padding: "6px 18px", borderRadius: 999, border: "2px solid rgba(198,244,50,0.45)", color: LIME }}>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1440,
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300", "Content-Disposition": `inline; filename="proof-pass-${card.handle}.png"` },
    },
  );
}
