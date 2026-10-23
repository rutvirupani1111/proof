"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function JobFilter({ jobs, value }: { jobs: { id: string; title: string }[]; value: string | null }) {
  const router = useRouter();
  return (
    <Select value={value ?? "all"} onValueChange={(v) => router.push(v === "all" ? "/recruiter/pipeline" : `/recruiter/pipeline?job=${v}`)}>
      <SelectTrigger className="w-[min(16rem,100%)]" aria-label="Filter the board by job">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All jobs</SelectItem>
        {jobs.map((j) => (
          <SelectItem key={j.id} value={j.id}>
            {j.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
