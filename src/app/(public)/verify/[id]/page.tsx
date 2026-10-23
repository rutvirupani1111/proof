import type { Metadata } from "next";
import Link from "next/link";
import { FadeIn } from "@/components/motion";
import { SharePanel } from "@/components/profile/share-panel";
import { getVerification } from "@/server/public/verify";
import { getOrigin, qrSvg } from "@/server/public/site";
import { PasteVerifier } from "../_components/paste-verifier";
import { VerifyResult } from "../_components/verify-result";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Verify credential ${id.slice(0, 8)}`, robots: { index: false } };
}

/** Public credential check: lime seal when authentic, coral when tampered, revoked or unknown. */
export default async function VerifyCredentialPage({ params }: Props) {
  const { id } = await params;
  const view = await getVerification(id);
  const origin = await getOrigin();
  const url = `${origin}/verify/${encodeURIComponent(id)}`;
  const qr = view.status === "not_found" ? null : await qrSvg(url);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <FadeIn>
        <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Credential check</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Is this evidence real?</h1>
        <p className="mt-2 font-mono text-xs break-all text-subtle">{id}</p>
      </FadeIn>

      <div className="mt-8">
        <VerifyResult view={view} />
      </div>

      {qr && (
        <div className="mt-5 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
          <SharePanel url={url} qr={qr} title="Verify this Proof credential" caption="Scan to verify this credential" />
        </div>
      )}

      <section aria-labelledby="paste-h" className="mt-14 border-t border-dashed border-line-strong pt-10">
        <h2 id="paste-h" className="text-xl font-semibold">Have the JSON instead?</h2>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          Paste a credential document a candidate sent you. Change a single character and it turns coral.{" "}
          <Link href="/verify" className="text-violet-text hover:underline">
            Open the verifier on its own
          </Link>
          .
        </p>
        <div className="mt-5">
          <PasteVerifier />
        </div>
      </section>
    </main>
  );
}
