"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/theme/theme-provider";

export { toast } from "sonner";

/** Mounted once in <Providers>. Call `toast.success("Verified")` anywhere on the client. */
export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-line !bg-surface !text-ink !shadow-pop !font-sans",
          description: "!text-muted",
          actionButton: "!bg-lime !text-lime-ink",
          success: "[&_[data-icon]]:!text-verified",
          error: "[&_[data-icon]]:!text-coral-text",
        },
      }}
    />
  );
}
