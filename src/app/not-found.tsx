import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ledger px-4">
      <div className="text-center">
        <p className="font-mono text-xs tracking-[0.14em] text-subtle uppercase">404 · no evidence found</p>
        <h1 className="mt-3 text-4xl font-semibold">This page has no proof.</h1>
        <p className="mt-2 text-muted">It may have moved, or it never existed.</p>
        <Button asChild className="mt-6">
          <Link href="/">Back to Proof</Link>
        </Button>
      </div>
    </main>
  );
}
