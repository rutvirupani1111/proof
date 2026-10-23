"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * Share block: the QR (server-rendered SVG on a light plate, so it scans in either theme), the
 * canonical URL, copy and native share.
 */
export function SharePanel({ url, qr, title, caption = "Scan to open this dossier" }: { url: string; qr: string; title: string; caption?: string }) {
  const [copied, setCopied] = useState(false);
  const display = url.replace(/^https?:\/\//, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        return; // dismissed
      }
    }
    void copy();
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className="size-[92px] shrink-0 rounded-xl bg-[#fffdf8] p-2 shadow-card ring-1 ring-line [&_svg]:size-full"
        role="img"
        aria-label={caption}
        dangerouslySetInnerHTML={{ __html: qr }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-subtle">{caption}</p>
        <p className="mt-0.5 truncate font-mono text-[12.5px]" title={url}>
          {display}
        </p>
        <div className="mt-2 flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={copy} aria-label="Copy link">
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
          </Button>
          <Button size="sm" variant="ghost" onClick={share} aria-label="Share">
            <Share2 /> Share
          </Button>
        </div>
      </div>
    </div>
  );
}
