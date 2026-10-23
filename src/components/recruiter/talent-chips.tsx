"use client";

import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Building2, CalendarDays, ClipboardCheck, Gauge, GitCommitHorizontal, Globe, MapPin, Sparkles, X, type LucideIcon } from "lucide-react";
import { springs } from "@/components/motion/transitions";
import { cn } from "@/lib/utils";
import type { TalentChip, TalentChipKind } from "@/server/search/talent-query";

const KIND: Record<TalentChipKind, { icon: LucideIcon; tone: string; sr: string }> = {
  skill: { icon: Sparkles, tone: "border-lime/50 bg-lime/15 text-ink", sr: "Skill" },
  location: { icon: MapPin, tone: "border-violet/30 bg-violet-soft text-violet-text", sr: "Location" },
  college: { icon: Building2, tone: "border-violet/30 bg-violet-soft text-violet-text", sr: "College" },
  year: { icon: CalendarDays, tone: "border-violet/30 bg-violet-soft text-violet-text", sr: "Graduation year" },
  score: { icon: Gauge, tone: "border-verified/30 bg-verified-soft text-verified", sr: "Minimum score" },
  commits: { icon: GitCommitHorizontal, tone: "border-verified/30 bg-verified-soft text-verified", sr: "Own commits" },
  live: { icon: Globe, tone: "border-verified/30 bg-verified-soft text-verified", sr: "Evidence" },
  check: { icon: ClipboardCheck, tone: "border-verified/30 bg-verified-soft text-verified", sr: "Evidence" },
  endorsed: { icon: BadgeCheck, tone: "border-verified/30 bg-verified-soft text-verified", sr: "Evidence" },
};

/** The phrases the plain-English parser understood, popping in as the recruiter types. */
export function TalentChips({
  chips,
  text,
  onRemove,
  className,
  size = "md",
}: {
  chips: TalentChip[];
  /** Leftover words kept as full-text, shown as a quiet trailing chip. */
  text?: string;
  onRemove?: (chip: TalentChip) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  // Always mounted (and hidden once empty) so the last chip can animate out.
  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5 empty:hidden", className)} aria-label="Understood from your search">
      <AnimatePresence initial={false} mode="popLayout">
        {chips.map((c) => {
          const k = KIND[c.kind];
          const Icon = k.icon;
          return (
            <motion.li
              key={c.key}
              layout
              initial={{ opacity: 0, scale: 0.8, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.12 } }}
              transition={springs.snappy}
            >
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border font-medium",
                  size === "sm" ? "px-2 py-0.5 text-[11px]" : "py-1 pr-1 pl-2.5 text-xs",
                  !onRemove && size !== "sm" && "pr-2.5",
                  k.tone,
                )}
              >
                <Icon className="size-3 shrink-0" aria-hidden />
                <span className="sr-only">{k.sr}: </span>
                {c.label}
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(c)}
                    className="-my-1 ml-0.5 grid size-6 place-items-center rounded-full opacity-70 hover:bg-ink/10 hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Remove ${c.label}`}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                )}
              </span>
            </motion.li>
          );
        })}
        {text && (
          <motion.li key="text" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={springs.snappy}>
            <span className={cn("inline-flex items-center rounded-full border border-dashed border-line-strong text-muted", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs")}>
              <span className="mr-1 font-mono text-[10px] tracking-wider text-subtle uppercase">text</span>“{text}”
            </span>
          </motion.li>
        )}
      </AnimatePresence>
    </ul>
  );
}
