"use client";

import { AnimatePresence, motion } from "motion/react";
import { ClipboardCheck, KanbanSquare, ListPlus, MessageSquare, NotebookPen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import {
  addNoteAction,
  addToPipelineAction,
  addToShortlistAction,
  createShortlistAction,
  deleteNoteAction,
  inviteToCheckAction,
} from "@/server/recruiter/actions";

type Note = { id: string; body: string; createdAt: string; authorName: string };

export function CandidateActions({
  studentUserId,
  firstName,
  jobs,
  shortlists: initialLists,
  memberOf: initialMember,
  checks,
  notes: initialNotes,
}: {
  studentUserId: string;
  firstName: string;
  jobs: { id: string; title: string }[];
  shortlists: { id: string; name: string }[];
  memberOf: string[];
  checks: { id: string; title: string; level: string }[];
  notes: Note[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jobId, setJobId] = useState<string>(jobs[0]?.id ?? "none");
  const [lists, setLists] = useState(initialLists);
  const [member, setMember] = useState(initialMember);
  const [listId, setListId] = useState<string>(initialLists.find((l) => !initialMember.includes(l.id))?.id ?? "new");
  const [checkId, setCheckId] = useState<string>(checks[0]?.id ?? "");
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");

  const addToPipeline = () =>
    start(async () => {
      const res = await addToPipelineAction({ studentUserId, jobId: jobId === "none" ? undefined : jobId, stage: "sourced" });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.created ? `${firstName} added to Sourced` : `${firstName} is already on that board`, {
        action: { label: "Open pipeline", onClick: () => router.push("/recruiter/pipeline") },
      });
    });

  const addToList = () =>
    start(async () => {
      let target = listId;
      if (target === "new") {
        const created = await createShortlistAction({ name: `Shortlist ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` });
        if (!created.ok) return void toast.error(created.error);
        setLists((l) => [created.data, ...l]);
        target = created.data.id;
      }
      const res = await addToShortlistAction({ shortlistId: target, studentUserId });
      if (!res.ok) return void toast.error(res.error);
      setMember((m) => [...m, target]);
      toast.success(`Added to ${lists.find((l) => l.id === target)?.name ?? "the new shortlist"}`);
    });

  const invite = () =>
    start(async () => {
      const res = await inviteToCheckAction({ studentUserId, skillCheckId: checkId });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.created ? `Invite sent. ${firstName} will see it in their notifications.` : "An invite for this check is already open.");
    });

  const addNote = () =>
    start(async () => {
      const res = await addNoteAction({ studentUserId, body: draft });
      if (!res.ok) return void toast.error(res.fieldErrors?.body ?? res.error);
      setNotes((n) => [{ ...res.data, authorName: "You" }, ...n]);
      setDraft("");
    });

  const available = lists.filter((l) => !member.includes(l.id));

  return (
    <>
      <Card className="grid gap-4 p-4">
        <Button asChild variant="ink" className="w-full">
          <Link href={`/recruiter/messages?with=${studentUserId}`}>
            <MessageSquare /> Message {firstName}
          </Link>
        </Button>

        <ActionRow icon={KanbanSquare} label="Pipeline">
          <Select value={jobId} onValueChange={setJobId}>
            <SelectTrigger aria-label="Job for the pipeline card" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">General pipeline</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="secondary" onClick={addToPipeline} disabled={pending}>
            Add
          </Button>
        </ActionRow>

        <ActionRow icon={ListPlus} label="Shortlist">
          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger aria-label="Shortlist" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {available.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
              <SelectItem value="new">+ New shortlist</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="secondary" onClick={addToList} disabled={pending}>
            Add
          </Button>
        </ActionRow>
        {member.length > 0 && (
          <p className="-mt-2 text-xs text-muted">
            On {member.length} shortlist{member.length === 1 ? "" : "s"}:{" "}
            {lists
              .filter((l) => member.includes(l.id))
              .map((l) => l.name)
              .join(", ")}
          </p>
        )}

        {checks.length > 0 && (
          <ActionRow icon={ClipboardCheck} label="Skill check">
            <Select value={checkId} onValueChange={setCheckId}>
              <SelectTrigger aria-label="Skill check to invite to" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {checks.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.title} · {k.level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="secondary" onClick={invite} disabled={pending || !checkId}>
              Invite
            </Button>
          </ActionRow>
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
          <NotebookPen className="size-4 text-subtle" aria-hidden /> Team notes
          <span className="font-normal text-subtle">· private to your company</span>
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) addNote();
          }}
          className="grid gap-2"
        >
          <label htmlFor="note-body" className="sr-only">
            New note
          </label>
          <Textarea
            id="note-body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What should the next interviewer probe?"
            className="min-h-20"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={pending || !draft.trim()} className="justify-self-end">
            Add note
          </Button>
        </form>
        <ul className="mt-3 grid gap-2">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <motion.li
                key={n.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={springs.gentle}
                className="group rounded-lg border border-line bg-surface-2/50 p-2.5 text-sm"
              >
                <p className="whitespace-pre-wrap text-pretty">{n.body}</p>
                <p className="mt-1 flex items-center justify-between text-xs text-subtle">
                  <span>
                    {n.authorName} · {timeAgo(n.createdAt)}
                  </span>
                  <button
                    type="button"
                    aria-label="Delete note"
                    className="rounded p-1 opacity-60 hover:bg-coral-soft hover:text-coral-text hover:opacity-100"
                    onClick={() =>
                      start(async () => {
                        const res = await deleteNoteAction(n.id);
                        if (res.ok) setNotes((all) => all.filter((x) => x.id !== n.id));
                        else toast.error(res.error);
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </Card>
    </>
  );
}

function ActionRow({ icon: Icon, label, children }: { icon: typeof ListPlus; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-subtle uppercase">
        <Icon className="size-3.5" aria-hidden /> {label}
      </span>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">{children}</div>
    </div>
  );
}
