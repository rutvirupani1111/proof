"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { confirmDomainVerification } from "@/server/mentor/actions";
import { SealMoment, type SealMomentData } from "../../student/_components/seal-moment";

export function ConfirmDomain({ token, domain }: { token: string; domain: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moment, setMoment] = useState<SealMomentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    start(async () => {
      const res = await confirmDomainVerification({ token });
      if (!res.ok) {
        setError(res.error ?? "Could not verify.");
        toast.error(res.error ?? "Could not verify.");
        return;
      }
      setMoment({
        title: `Verified mentor at @${res.domain}`,
        detail: "Your endorsements now carry your institution's name, signed into every credential you issue.",
      });
    });
  }

  return (
    <>
      <div className="grid gap-3">
        <Button size="lg" onClick={confirm} loading={pending} disabled={!!moment} className="w-full">
          <ShieldCheck aria-hidden />
          Confirm @{domain}
        </Button>
        {error && (
          <p role="alert" className="rounded-xl border border-coral/30 bg-coral-soft px-3 py-2 text-sm text-coral-text">
            {error}
          </p>
        )}
      </div>
      <SealMoment
        data={moment}
        onClose={() => {
          setMoment(null);
          router.push("/mentor/requests");
          router.refresh();
        }}
      />
    </>
  );
}
