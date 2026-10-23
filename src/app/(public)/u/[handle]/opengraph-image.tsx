import { ImageResponse } from "next/og";
import { rosettePath } from "@/components/ui/seal-glyph";
import { getShareCard } from "@/server/public/queries";

export const dynamic = "force-dynamic";
export const alt = "A verified Proof dossier";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0A0B10";
const PAPER = "#F6F3EC";
const LIME = "#C6F432";
const MUTED = "#A7A399";

function sealDataUri(px: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}"><g transform="rotate(-8 50 50)"><path d="${rosettePath(50, 50, 49, 45.5, 36)}" fill="${LIME}"/><circle cx="50" cy="50" r="41" fill="none" stroke="${INK}" stroke-width="1.4"/><circle cx="50" cy="50" r="27.5" fill="none" stroke="${INK}" stroke-width="1.4"/><path d="M38.5 50.5l8 8 15-16" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Link-preview card. Only PUBLIC profiles reveal a name; anything else gets a generic card. */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const card = await getShareCard(handle);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: INK, color: PAPER, padding: 72, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage: "radial-gradient(rgba(243,240,232,0.10) 1.5px, transparent 1.5px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sealDataUri(44)} width={44} height={44} alt="" />
            proof
            <span style={{ fontSize: 22, fontWeight: 400, color: MUTED, marginLeft: 10 }}>verified dossier</span>
          </div>
          {card ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 26, color: MUTED }}>{`@${card.handle}`}</div>
              <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.02, marginTop: 8 }}>{card.name}</div>
              {card.headline && <div style={{ fontSize: 30, color: MUTED, marginTop: 14, maxWidth: 760 }}>{card.headline}</div>}
              <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
                {card.skills.map((s) => (
                  <div key={s} style={{ display: "flex", fontSize: 22, padding: "8px 18px", borderRadius: 999, border: `1.5px solid rgba(198,244,50,0.45)`, color: LIME }}>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2 }}>Resumes are claims.</div>
              <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, color: LIME }}>Proof is evidence.</div>
            </div>
          )}
          <div style={{ fontSize: 22, color: MUTED }}>{`${card?.college ? `${card.college} · ` : ""}Every seal links to a signed, verifiable credential.`}</div>
        </div>
        {card && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 300, position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sealDataUri(220)} width={220} height={220} alt="" />
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 26 }}>
              <span style={{ fontSize: 84, fontWeight: 700, color: LIME }}>{card.score}</span>
              <span style={{ fontSize: 24, color: MUTED }}>Proof Score</span>
            </div>
            <div style={{ fontSize: 26, marginTop: 4 }}>{`${card.seals} seals`}</div>
          </div>
        )}
      </div>
    ),
    size,
  );
}
