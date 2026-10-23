"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Cell renderer; defaults to String(row[key]). */
  cell?: (row: T) => ReactNode;
  /** Value used for sorting; enables the sort toggle on this column. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hide below the sm breakpoint to stay clean at 375px. */
  hideOnMobile?: boolean;
};

type Sort = { key: string; dir: "asc" | "desc" } | null;

/**
 * Basic sortable table. For server-side pagination/filtering, sort on the server and pass rows;
 * this component only handles presentation and client-side sorting of the given rows.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: { icon?: LucideIcon; title: ReactNode; description?: ReactNode; action?: ReactNode };
  className?: string;
  caption?: string;
}) {
  const [sort, setSort] = useState<Sort>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      const r = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? r : -r;
    });
  }, [rows, sort, columns]);

  if (rows.length === 0 && empty) return <EmptyState {...empty} />;

  const toggle = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "desc" } : s.dir === "desc" ? { key, dir: "asc" } : null));

  return (
    <div className={cn("overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-card", className)}>
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line bg-surface-2/60">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    "h-10 px-4 text-left font-mono text-[11px] font-medium tracking-wider whitespace-nowrap text-subtle uppercase",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.hideOnMobile && "hidden sm:table-cell",
                    c.className,
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className="inline-flex items-center gap-1 rounded hover:text-ink"
                    >
                      {c.header}
                      {active ? (
                        sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-line last:border-0 transition-colors",
                onRowClick && "cursor-pointer hover:bg-surface-2/70",
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-4 py-3 align-middle",
                    c.align === "right" && "text-right tabular",
                    c.align === "center" && "text-center",
                    c.hideOnMobile && "hidden sm:table-cell",
                    c.className,
                  )}
                >
                  {c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
