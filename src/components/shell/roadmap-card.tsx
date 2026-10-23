import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type RoadmapItem = { icon: LucideIcon; title: string; description: string; href?: string };

/** Placeholder block on portal dashboards: states exactly what will live on this page. */
export function RoadmapCard({ title, description, items }: { title: string; description: string; items: RoadmapItem[] }) {
  return (
    <Card variant="ledger">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Badge variant="violet" mono>
            in build
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {items.map(({ icon: Icon, title: t, description: d }) => (
            <li key={t} className="flex gap-3 bg-surface p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                <Icon className="size-4" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-medium">{t}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
