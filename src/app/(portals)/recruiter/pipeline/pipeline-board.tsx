"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { GripVertical, KanbanSquare, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import { PIPELINE_STAGE_LABEL, PIPELINE_STAGES, type PipelineStageId } from "@/lib/validation/recruiter";
import { movePipelineCardAction, removeFromPipelineAction } from "@/server/recruiter/actions";
import type { BoardCard } from "@/server/recruiter/queries";
import { positionBetween } from "./position";

type Columns = Record<PipelineStageId, BoardCard[]>;

const TONE: Record<PipelineStageId, string> = {
  sourced: "bg-subtle",
  contacted: "bg-violet/60",
  skill_check: "bg-violet",
  interview: "bg-violet-text",
  offer: "bg-lime",
  hired: "bg-lime",
  rejected: "bg-coral",
};

function toColumns(cards: BoardCard[]): Columns {
  const cols = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, [] as BoardCard[]])) as Columns;
  for (const c of [...cards].sort((a, b) => a.position - b.position)) cols[c.stage].push(c);
  return cols;
}

function findStage(cols: Columns, id: UniqueIdentifier): PipelineStageId | null {
  if ((PIPELINE_STAGES as readonly string[]).includes(String(id))) return id as PipelineStageId;
  for (const s of PIPELINE_STAGES) if (cols[s].some((c) => c.id === id)) return s;
  return null;
}

export function PipelineBoard({ initial }: { initial: BoardCard[] }) {
  const [cols, setCols] = useState<Columns>(() => toColumns(initial));
  const [activeId, setActiveId] = useState<string | null>(null);
  const snapshot = useRef<Columns | null>(null);
  const byId = useMemo(() => new Map(PIPELINE_STAGES.flatMap((s) => cols[s]).map((c) => [c.id, c])), [cols]);
  const active = activeId ? byId.get(activeId) : undefined;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Persist one card's new stage + position; roll the whole board back if the server refuses. */
  async function persist(next: Columns, cardId: string, before: Columns) {
    const stage = findStage(next, cardId);
    if (!stage) return;
    const list = next[stage];
    const i = list.findIndex((c) => c.id === cardId);
    const position = positionBetween(list[i - 1]?.position, list[i + 1]?.position);
    const moved = { ...list[i]!, stage, position };
    const committed = { ...next, [stage]: list.map((c) => (c.id === cardId ? moved : c)) };
    setCols(committed);
    const res = await movePipelineCardAction({ cardId, stage, position });
    if (!res.ok) {
      setCols(before);
      toast.error(res.error);
    } else if (findStage(before, cardId) !== stage) {
      toast.success(`${moved.name} → ${PIPELINE_STAGE_LABEL[stage]}`);
    }
  }

  function moveTo(cardId: string, stage: PipelineStageId) {
    const from = findStage(cols, cardId);
    if (!from || from === stage) return;
    const card = cols[from].find((c) => c.id === cardId)!;
    const next = { ...cols, [from]: cols[from].filter((c) => c.id !== cardId), [stage]: [...cols[stage], { ...card, stage }] };
    void persist(next, cardId, cols);
  }

  function onDragStart(e: DragStartEvent) {
    snapshot.current = cols;
    setActiveId(String(e.active.id));
  }

  function onDragOver({ active: a, over }: DragOverEvent) {
    if (!over) return;
    const from = findStage(cols, a.id);
    const to = findStage(cols, over.id);
    if (!from || !to || from === to) return;
    setCols((prev) => {
      const card = prev[from].find((c) => c.id === a.id);
      if (!card) return prev;
      const target = prev[to];
      const overIndex = target.findIndex((c) => c.id === over.id);
      const index = overIndex >= 0 ? overIndex : target.length;
      return {
        ...prev,
        [from]: prev[from].filter((c) => c.id !== a.id),
        [to]: [...target.slice(0, index), { ...card, stage: to }, ...target.slice(index)],
      };
    });
  }

  function onDragEnd({ active: a, over }: DragEndEvent) {
    setActiveId(null);
    const before = snapshot.current ?? cols;
    snapshot.current = null;
    if (!over) {
      setCols(before);
      return;
    }
    const stage = findStage(cols, a.id);
    if (!stage) return;
    let next = cols;
    const list = cols[stage];
    const oldIndex = list.findIndex((c) => c.id === a.id);
    const overIndex = list.findIndex((c) => c.id === over.id);
    if (overIndex >= 0 && oldIndex !== overIndex) next = { ...cols, [stage]: arrayMove(list, oldIndex, overIndex) };
    const prevStage = findStage(before, a.id);
    const prevIndex = prevStage ? before[prevStage].findIndex((c) => c.id === a.id) : -1;
    const newIndex = next[stage].findIndex((c) => c.id === a.id);
    if (prevStage === stage && prevIndex === newIndex) {
      setCols(before);
      return;
    }
    void persist(next, String(a.id), before);
  }

  async function remove(card: BoardCard) {
    const before = cols;
    setCols({ ...cols, [card.stage]: cols[card.stage].filter((c) => c.id !== card.id) });
    const res = await removeFromPipelineAction(card.id);
    if (!res.ok) {
      setCols(before);
      toast.error(res.error);
    }
  }

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Picked up ${byId.get(String(a.id))?.name ?? "card"}.`,
    onDragOver: ({ active: a, over }) => {
      const s = over ? findStage(cols, over.id) : null;
      return s ? `${byId.get(String(a.id))?.name ?? "Card"} is over ${PIPELINE_STAGE_LABEL[s]}.` : "";
    },
    onDragEnd: ({ active: a, over }) => {
      const s = over ? findStage(cols, over.id) : null;
      return s ? `${byId.get(String(a.id))?.name ?? "Card"} moved to ${PIPELINE_STAGE_LABEL[s]}.` : "Move cancelled.";
    },
    onDragCancel: () => "Move cancelled.",
  };

  if (initial.length === 0) {
    return (
      <EmptyState
        icon={KanbanSquare}
        title="Your board is empty"
        description="Open a candidate from evidence search and choose “Add to pipeline”. They land in Sourced."
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        if (snapshot.current) setCols(snapshot.current);
        snapshot.current = null;
        setActiveId(null);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Press space or enter to pick up a candidate. Use arrow keys to move between stages, space or enter to drop, escape to cancel.",
        },
      }}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex snap-x snap-mandatory gap-3 sm:snap-none">
          {PIPELINE_STAGES.map((stage) => (
            <Column key={stage} stage={stage} cards={cols[stage]} onMove={moveTo} onRemove={remove} />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {active ? <CardBody card={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  cards,
  onMove,
  onRemove,
}: {
  stage: PipelineStageId;
  cards: BoardCard[];
  onMove: (id: string, stage: PipelineStageId) => void;
  onRemove: (card: BoardCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      aria-label={`${PIPELINE_STAGE_LABEL[stage]}, ${cards.length} candidates`}
      className={cn(
        "flex w-[78vw] max-w-[17.5rem] shrink-0 snap-start flex-col rounded-[var(--radius-card)] border bg-surface-2/60 transition-colors sm:w-[16.5rem]",
        isOver ? "border-violet/50 bg-violet-soft/40" : "border-line",
      )}
    >
      <header className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <span className={cn("size-2 rounded-full", TONE[stage])} aria-hidden />
          {PIPELINE_STAGE_LABEL[stage]}
        </h2>
        <motion.span key={cards.length} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="font-mono text-xs text-muted tabular">
          {cards.length}
        </motion.span>
      </header>
      <SortableContext id={stage} items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-28 flex-1 flex-col gap-2 px-2 pb-2">
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} onMove={onMove} onRemove={onRemove} />
          ))}
          {cards.length === 0 && (
            <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-line-strong/70 px-3 py-6 text-center text-xs text-subtle">
              Drop a candidate here
            </li>
          )}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({
  card,
  onMove,
  onRemove,
}: {
  card: BoardCard;
  onMove: (id: string, stage: PipelineStageId) => void;
  onRemove: (card: BoardCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-35")}
    >
      <CardBody
        card={card}
        handle={
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag ${card.name}`}
            aria-roledescription="draggable candidate"
            className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        }
        menu={
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${card.name}`}
              className="grid size-7 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-ink"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {PIPELINE_STAGES.filter((s) => s !== card.stage).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onMove(card.id, s)}>
                  <span className={cn("size-2 rounded-full", TONE[s])} aria-hidden /> {PIPELINE_STAGE_LABEL[s]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => onRemove(card)}>
                <Trash2 className="size-4" /> Remove from board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </li>
  );
}

function CardBody({
  card,
  handle,
  menu,
  overlay,
}: {
  card: BoardCard;
  handle?: React.ReactNode;
  menu?: React.ReactNode;
  overlay?: boolean;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-line bg-surface p-2.5 shadow-card",
        overlay && "rotate-[-2deg] cursor-grabbing border-violet/50 shadow-pop ring-2 ring-violet/20",
      )}
    >
      <div className="flex items-start gap-1.5">
        {handle ?? <span className="grid size-7 place-items-center text-subtle"><GripVertical className="size-4" /></span>}
        <Avatar name={card.name} src={card.image} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1 pl-1">
          <Link href={`/recruiter/candidates/${card.studentUserId}`} className="block truncate text-sm font-medium hover:underline">
            {card.name}
          </Link>
          <p className="truncate text-xs text-muted">{card.headline ?? card.handle}</p>
        </div>
        {menu}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 pl-8">
        <ul className="flex min-w-0 flex-wrap gap-1">
          {card.skills.map((s) => (
            <li key={s} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
              {s}
            </li>
          ))}
        </ul>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular",
            card.proofScore >= 70 ? "bg-lime text-lime-ink" : "bg-surface-3 text-ink",
          )}
          title="Proof Score"
        >
          {card.proofScore}
        </span>
      </div>
      <p className="mt-1.5 truncate pl-8 text-[11px] text-subtle">
        {card.jobTitle ?? "General"} · {timeAgo(card.updatedAt)}
      </p>
    </article>
  );
}
