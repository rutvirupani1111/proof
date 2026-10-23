import { BookCheck, GitCommitHorizontal, Globe, KeyRound, UserRoundCheck, type LucideIcon } from "lucide-react";
import type { EvidenceKind } from "@/db/schema";

/**
 * One vocabulary for evidence kinds across the dossier. Kinds are told apart by SHAPE (and icon),
 * never by colour alone: every verified thing stays lime.
 */
export const KIND_META: Record<EvidenceKind, { label: string; noun: string; icon: LucideIcon; shape: "circle" | "diamond" | "square" | "star" | "ring" }> = {
  repo_authorship: { label: "Code authorship", noun: "commits", icon: GitCommitHorizontal, shape: "circle" },
  deployment: { label: "Live deployment", noun: "deploy", icon: Globe, shape: "diamond" },
  skill_check: { label: "Skill check", noun: "check", icon: BookCheck, shape: "square" },
  attestation: { label: "Mentor endorsement", noun: "endorsement", icon: UserRoundCheck, shape: "star" },
  github_ownership: { label: "GitHub ownership", noun: "ownership", icon: KeyRound, shape: "ring" },
};

export const KIND_ORDER: EvidenceKind[] = ["repo_authorship", "deployment", "skill_check", "attestation", "github_ownership"];

/** SVG path for a kind's star shape centred on 0,0 with radius r. */
export function shapePath(shape: (typeof KIND_META)[EvidenceKind]["shape"], r: number): string {
  switch (shape) {
    case "diamond":
      return `M0 ${-r * 1.25} L${r * 1.25} 0 L0 ${r * 1.25} L${-r * 1.25} 0 Z`;
    case "square":
      return `M${-r} ${-r} H${r} V${r} H${-r} Z`;
    case "star": {
      const o = r * 1.45;
      const i = r * 0.5;
      return `M0 ${-o} L${i} ${-i} L${o} 0 L${i} ${i} L0 ${o} L${-i} ${i} L${-o} 0 L${-i} ${-i} Z`;
    }
    default:
      return `M${-r} 0 a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
}

export function formatDay(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
