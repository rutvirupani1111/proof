import type { LucideIcon } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";

export type Feature = { icon: LucideIcon; title: string; body: string };

/** Hairline-ruled grid of features (one cell per feature, icon + numbered tab). */
export function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <Stagger inView className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {features.map(({ icon: Icon, title, body }, i) => (
        <StaggerItem key={title} className="bg-surface p-6">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <h3 className="mt-5 text-lg font-semibold">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
