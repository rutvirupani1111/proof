"use client";

import { Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Print and copy-as-text actions for the interview kit page (hidden in the printout). */
export function InterviewKitToolbar({ text }: { text: string }) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            toast.success("Interview kit copied as text");
          } catch {
            toast.error("Could not copy. Use Print instead.");
          }
        }}
      >
        <Copy /> Copy as text
      </Button>
      <Button onClick={() => window.print()}>
        <Printer /> Print
      </Button>
    </div>
  );
}
