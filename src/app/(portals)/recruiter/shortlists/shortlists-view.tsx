"use client";

import { AnimatePresence, motion } from "motion/react";
import { GitCompare, ListChecks, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { createShortlistAction, deleteShortlistAction, removeFromShortlistAction } from "@/server/recruiter/actions";
import type { CandidateHit } from "@/server/search/engine";
import { EvidenceFacts } from "../_components/evidence-facts";

type List = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  jobTitle: string | null;
  ownerName: string;
  candidates: CandidateHit[];
};

export function ShortlistsView({ lists: initial, jobs }: { lists: List[]; jobs: { id: string; title: string }[] }) {
  const [lists, setLists] = useState(initial);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> New shortlist
            </Button>
          </DialogTrigger>
          <NewShortlist
            jobs={jobs}
            onCreated={(l) => {
              setLists((all) => [{ ...l, description: null, createdAt: new Date().toISOString(), jobTitle: null, ownerName: "You", candidates: [] }, ...all]);
              setOpen(false);
            }}
          />
        </Dialog>
      </div>

      {lists.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No shortlists yet"
          description="Create one here, or add candidates from their evidence dossier."
          action={
            <Button variant="secondary" asChild>
              <Link href="/recruiter/search">
                <Search /> Find candidates
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5">
          <AnimatePresence initial={false}>
            {lists.map((l) => (
              <motion.div key={l.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={springs.gentle}>
                <ShortlistCard list={l} onDeleted={() => setLists((all) => all.filter((x) => x.id !== l.id))} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}

function ShortlistCard({ list, onDeleted }: { list: List; onDeleted: () => void }) {
  const [people, setPeople] = useState(list.candidates);
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const togglePick = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{list.name}</h2>
          {list.description && <p className="mt-0.5 text-sm text-muted">{list.description}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-subtle">
            <span>
              {people.length} candidate{people.length === 1 ? "" : "s"} · by {list.ownerName}
            </span>
            {list.jobTitle && <Badge variant="violet">{list.jobTitle}</Badge>}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={picked.length === 0}
            onClick={() => router.push(`/recruiter/compare?ids=${picked.join(",")}`)}
          >
            <GitCompare /> Compare {picked.length > 0 ? picked.length : ""}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Delete shortlist ${list.name}`}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteShortlistAction(list.id);
                if (res.ok) {
                  onDeleted();
                  toast.success("Shortlist deleted");
                } else toast.error(res.error);
              })
            }
          >
            <Trash2 />
          </Button>
        </div>
      </header>
      {people.length === 0 ? (
        <p className="p-5 text-sm text-muted">Empty. Add candidates from their dossier.</p>
      ) : (
        <ul className="divide-y divide-line">
          <AnimatePresence initial={false}>
            {people.map((p) => {
              const on = picked.includes(p.userId);
              return (
                <motion.li key={p.userId} layout exit={{ opacity: 0, height: 0 }} transition={springs.gentle} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-[var(--violet)] max-sm:size-5"
                    checked={on}
                    disabled={!on && picked.length >= 3}
                    onChange={() => togglePick(p.userId)}
                    aria-label={`Select ${p.name} to compare`}
                  />
                  <Avatar name={p.name} src={p.image} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/recruiter/candidates/${p.userId}`} className="text-sm font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {p.collegeName}
                      {p.graduationYear ? ` · ’${String(p.graduationYear).slice(2)}` : ""} · {p.skills.slice(0, 3).map((s) => s.name).join(", ")}
                    </p>
                    <EvidenceFacts facts={p} compact className="mt-1 sm:hidden" />
                  </div>
                  <EvidenceFacts facts={p} compact className="hidden sm:flex" />
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular",
                      p.proofScore >= 70 ? "bg-lime text-lime-ink" : "bg-surface-3",
                    )}
                  >
                    {p.proofScore}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${p.name} from ${list.name}`}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle hover:bg-coral-soft hover:text-coral-text"
                    onClick={() =>
                      start(async () => {
                        const before = people;
                        setPeople((all) => all.filter((x) => x.userId !== p.userId));
                        setPicked((x) => x.filter((id) => id !== p.userId));
                        const res = await removeFromShortlistAction({ shortlistId: list.id, studentUserId: p.userId });
                        if (!res.ok) {
                          setPeople(before);
                          toast.error(res.error);
                        }
                      })
                    }
                  >
                    <X className="size-4" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  );
}

function NewShortlist({ jobs, onCreated }: { jobs: { id: string; title: string }[]; onCreated: (l: { id: string; name: string }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jobId, setJobId] = useState("none");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New shortlist</DialogTitle>
        <DialogDescription>Visible to everyone in your company workspace.</DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await createShortlistAction({ name, description: description || undefined, jobId: jobId === "none" ? undefined : jobId });
            if (!res.ok) return setErrors(res.fieldErrors ?? { name: res.error });
            toast.success("Shortlist created");
            onCreated(res.data);
          });
        }}
      >
        <Field label="Name" htmlFor="sl-name" error={errors.name}>
          <Input id="sl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Frontend new grads, 2026" aria-invalid={!!errors.name} />
        </Field>
        <Field label="Description" htmlFor="sl-desc" hint="Optional: what the bar is.">
          <Textarea id="sl-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
        </Field>
        {jobs.length > 0 && (
          <Field label="For job" htmlFor="sl-job">
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger id="sl-job">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not tied to a job</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <DialogFooter>
          <Button type="submit" loading={pending}>
            Create shortlist
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
