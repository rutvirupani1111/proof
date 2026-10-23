"use client";

import { Volume2, VolumeX } from "lucide-react";
import { motion } from "motion/react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { stampFeedback, playStampThud, useStampSound } from "./stamp-feedback";

/** Student settings: the seal-stamp sound (off by default, stored on this device). */
export function StampSoundSetting() {
  const [on, setOn] = useStampSound();
  const Icon = on ? Volume2 : VolumeX;
  return (
    <Card className="max-w-3xl">
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-soft text-violet-text">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">Verification feedback</h2>
            <p className="text-sm text-muted">
              When a seal stamps, supported phones give a short buzz. Add a soft stamp sound too. Saved on this device only.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
          <label htmlFor="stamp-sound" className="min-w-0 flex-1 cursor-pointer">
            <span className="block text-sm font-medium">Stamp sound</span>
            <span className="block text-xs text-muted">{on ? "On: a quiet thud plays as the seal lands." : "Off by default."}</span>
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                stampFeedback();
                if (!on) playStampThud();
              }}
            >
              Preview
            </Button>
            <button
              id="stamp-sound"
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => {
                setOn(!on);
                if (!on) playStampThud(0.35);
              }}
              className={cn(
                "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-violet focus-visible:outline-none",
                on ? "border-lime bg-lime" : "border-line-strong bg-surface-3",
              )}
            >
              <span className="sr-only">Stamp sound</span>
              <motion.span
                layout
                transition={springs.snappy}
                className={cn("block size-5 rounded-full shadow-card", on ? "ml-[1.45rem] bg-lime-ink" : "ml-1 bg-surface")}
              />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
