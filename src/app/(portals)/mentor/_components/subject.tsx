import { FolderGit2, Globe, Sparkles } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { AttestationRow } from "@/server/mentor/queries";

/** What the student asked to be vouched for: a skill, a repo, or a live deployment. */
export function subjectLabel(row: Pick<AttestationRow, "skillName" | "repoName" | "deploymentUrl">) {
  if (row.skillName) return row.skillName;
  if (row.repoName) return row.repoName.split("/")[1] ?? row.repoName;
  if (row.deploymentUrl) return row.deploymentUrl.replace(/^https?:\/\//, "");
  return "their work";
}

export function SubjectChip({ row }: { row: AttestationRow }) {
  if (row.skillName) {
    return (
      <Badge variant="violet">
        <Sparkles aria-hidden />
        {row.skillName}
      </Badge>
    );
  }
  if (row.repoName) {
    return (
      <a href={row.repoUrl ?? "#"} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink hover:border-line-strong">
        <FolderGit2 className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{row.repoName}</span>
      </a>
    );
  }
  if (row.deploymentUrl) {
    return (
      <a href={row.deploymentUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink hover:border-line-strong">
        <Globe className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{subjectLabel(row)}</span>
      </a>
    );
  }
  return <Badge>Project</Badge>;
}

export function StudentLine({ row }: { row: AttestationRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={row.studentName} size="md" />
      <div className="min-w-0">
        <p className="truncate font-medium">
          {row.handle ? (
            <Link href={`/u/${row.handle}`} target="_blank" className="hover:text-violet-text hover:underline underline-offset-4">
              {row.studentName}
            </Link>
          ) : (
            row.studentName
          )}
        </p>
        <p className="truncate text-xs text-muted">
          {[row.college, row.graduationYear ? `Class of ${row.graduationYear}` : null, row.handle ? `@${row.handle}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {row.proofScore != null && (
        <span className="ml-auto hidden shrink-0 flex-col items-end sm:flex">
          <span className="font-mono text-[10px] tracking-wider text-subtle uppercase">Proof</span>
          <span className="font-display text-lg font-semibold tabular">{row.proofScore}</span>
        </span>
      )}
    </div>
  );
}
