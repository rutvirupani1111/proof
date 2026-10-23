import { ShieldQuestion, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Seal } from "@/components/ui/seal";
import { getCredentialForVerify } from "@/server/public/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify a credential" };

/**
 * Placeholder verifier. The credential engine will re-check the Ed25519 signature over the stored
 * VC JSON here and show red on any tamper. Today it confirms the credential exists and is unrevoked.
 */
export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const credential = await getCredentialForVerify(id);

  if (!credential) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={ShieldX}
          title="Credential not found"
          description="No Proof credential has this id. Check the link or QR code you were given."
          className="border-coral/50"
        />
      </main>
    );
  }

  const revoked = !!credential.revokedAt;
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Card variant={revoked ? "default" : "verified"} className="p-8 text-center">
        <div className="flex justify-center">
          {revoked ? <ShieldQuestion className="size-16 text-coral-text" /> : <Seal size={104} stamp="mount" />}
        </div>
        <p className="mt-6 font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{credential.type}</p>
        <h1 className="mt-2 text-2xl font-semibold">{credential.evidence.title}</h1>
        <p className="mt-1 text-muted">Issued to {credential.subject.name}</p>
        <div className="mt-5 flex justify-center gap-2">
          {revoked ? <Badge variant="coral">Revoked</Badge> : <Badge variant="verified">On record</Badge>}
          <Badge variant="neutral" mono>
            {credential.issuedAt.toISOString().slice(0, 10)}
          </Badge>
        </div>
        <p className="mt-6 text-xs text-subtle">Cryptographic signature check arrives with the credential engine.</p>
      </Card>
    </main>
  );
}
