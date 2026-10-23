import { FileCheck2, KeyRound, ScanLine } from "lucide-react";
import type { Metadata } from "next";
import { FadeIn } from "@/components/motion";
import { PasteVerifier } from "./_components/paste-verifier";
import { VerifyById } from "./_components/verify-by-id";

export const metadata: Metadata = {
  title: "Verify a credential",
  description: "Check any Proof credential: paste its JSON or enter its id. Authentic credentials show a lime seal; tampered ones turn coral.",
};

const HOW = [
  { icon: ScanLine, title: "Scan or open the link", body: "Every seal on a Proof dossier links to /verify/{id}, also printed as a QR code." },
  { icon: FileCheck2, title: "Or paste the JSON", body: "A W3C Verifiable Credential. Proof compares it with what it issued, field by field." },
  { icon: KeyRound, title: "Signature, not trust", body: "Each credential carries an Ed25519 signature over its canonical JSON. One edited byte breaks it." },
];

export default function VerifyIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <FadeIn>
        <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Credential verifier</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">Don&apos;t trust. Verify.</h1>
        <p className="mt-3 max-w-xl text-muted">
          Anyone can check a Proof credential, no account needed. Lime means Proof issued it and nothing changed since. Coral
          means walk away.
        </p>
      </FadeIn>
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {HOW.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <Icon className="size-4 text-verified" aria-hidden />
            <p className="mt-2.5 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-10">
        <VerifyById />
      </div>
      <div className="mt-6">
        <PasteVerifier />
      </div>
    </main>
  );
}
