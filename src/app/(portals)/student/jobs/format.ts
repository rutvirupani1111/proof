import { formatLpa } from "@/lib/utils";

export const EMPLOYMENT_LABEL = { full_time: "Full-time", internship: "Internship", contract: "Contract" } as const;
export const WORK_MODE_LABEL = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" } as const;

function compactInr(n: number) {
  return n >= 1000 ? `₹${Math.round(n / 1000)}k` : `₹${n}`;
}

/** Annual CTC for full-time roles, monthly stipend for internships (as stored on jobs). */
export function formatPay(type: keyof typeof EMPLOYMENT_LABEL, min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (type === "internship") {
    if (min != null && max != null && min !== max) return `${compactInr(min)}–${compactInr(max).replace("₹", "")} / month`;
    return `${compactInr((min ?? max)!)} / month`;
  }
  if (min != null && max != null && min !== max) return `${formatLpa(min).replace(" LPA", "")}–${formatLpa(max).replace("₹", "")}`;
  return formatLpa((min ?? max)!);
}

export function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
