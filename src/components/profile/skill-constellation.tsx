"use client";

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { ArrowUpRight, MousePointerClick } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { cn } from "@/lib/utils";
import type { DossierEvidence, DossierSkill } from "@/server/public/queries";
import { formatDay, KIND_META, KIND_ORDER, shapePath } from "./kind-meta";

type SkillNode = SimulationNodeDatum & { id: string; type: "skill"; r: number; skill: DossierSkill };
type StarNode = SimulationNodeDatum & { id: string; type: "ev"; r: number; ev: DossierEvidence; index: number };
type Node = SkillNode | StarNode;
type Edge = SimulationLinkDatum<Node> & { source: Node | string; target: Node | string; skill: string; ev: string };

const titleCase = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The skill constellation: every star is one piece of verified evidence, tethered to the skills it
 * proves. Skills are the bright hubs. Hover, focus or tap a star to see the commit, deploy, check
 * or endorsement behind it. Rendered on a "night sky" island (data-theme="dark") in both themes
 * so lime always has contrast.
 */
export function SkillConstellation({ skills, evidence }: { skills: DossierSkill[]; evidence: DossierEvidence[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hover ?? pinned;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!width) return null;
    const w = Math.max(300, width);
    const compact = w < 560;
    const h = Math.round(compact ? w * 1.1 : Math.min(560, w * 0.62));

    // Hubs: profile skills that evidence actually points at (plus any evidence-only slugs).
    const bySlug = new Map(skills.map((s) => [s.slug, s]));
    const used = new Set(evidence.flatMap((e) => e.skillSlugs));
    const hubSkills: DossierSkill[] = [...used].map(
      (slug) => bySlug.get(slug) ?? { slug, name: titleCase(slug), category: "concept", score: 0, evidenceCount: 0 },
    );
    hubSkills.sort((a, b) => b.score - a.score);
    const hubs = hubSkills.slice(0, compact ? 7 : 10);
    const hubSet = new Set(hubs.map((h) => h.slug));

    const nodes: Node[] = hubs.map((s, i) => {
      const a = (i / hubs.length) * Math.PI * 2;
      return {
        id: `skill:${s.slug}`,
        type: "skill",
        r: 7 + Math.round((s.score / 100) * 9),
        skill: s,
        x: w / 2 + Math.cos(a) * w * 0.28,
        y: h / 2 + Math.sin(a) * h * 0.3,
      };
    });
    const edges: Edge[] = [];
    evidence.forEach((ev, index) => {
      nodes.push({ id: `ev:${ev.id}`, type: "ev", r: 4.5, ev, index });
      for (const slug of ev.skillSlugs) {
        if (hubSet.has(slug)) edges.push({ source: `ev:${ev.id}`, target: `skill:${slug}`, skill: slug, ev: ev.id });
      }
    });

    const sim = forceSimulation<Node>(nodes)
      .force(
        "link",
        forceLink<Node, Edge>(edges)
          .id((d) => d.id)
          .distance(compact ? 38 : 52)
          .strength(0.55),
      )
      .force("charge", forceManyBody<Node>().strength((d) => (d.type === "skill" ? (compact ? -220 : -340) : -34)))
      .force("x", forceX<Node>(w / 2).strength(0.05))
      .force("y", forceY<Node>(h / 2).strength(compact ? 0.05 : 0.09))
      .force("collide", forceCollide<Node>((d) => d.r + (d.type === "skill" ? 22 : 5)))
      .stop();
    for (let i = 0; i < 320; i++) sim.tick();

    const pad = 30;
    for (const n of nodes) {
      n.x = Math.max(pad, Math.min(w - pad, n.x ?? w / 2));
      n.y = Math.max(pad, Math.min(h - pad - 14, n.y ?? h / 2));
    }
    const pos = new Map(nodes.map((n) => [n.id, { x: n.x!, y: n.y! }]));
    // Faint background stars: deterministic so server and client agree.
    const dust = Array.from({ length: Math.round((w * h) / 5200) }, (_, i) => ({
      x: ((i * 7919) % 1000) / 1000 * w,
      y: ((i * 104729) % 997) / 997 * h,
      r: i % 5 === 0 ? 1.1 : 0.6,
    }));
    return { w, h, nodes, edges, pos, dust };
  }, [width, skills, evidence]);

  const activeEv = active?.startsWith("ev:") ? evidence.find((e) => `ev:${e.id}` === active) : undefined;
  const activeSkill = active?.startsWith("skill:") ? layout?.nodes.find((n): n is SkillNode => n.id === active && n.type === "skill") : undefined;

  const lit = useMemo(() => {
    const set = new Set<string>();
    if (!active || !layout) return set;
    set.add(active);
    for (const e of layout.edges) {
      const ev = `ev:${e.ev}`;
      const sk = `skill:${e.skill}`;
      if (ev === active || sk === active) {
        set.add(ev);
        set.add(sk);
      }
    }
    return set;
  }, [active, layout]);

  const select = (id: string) => setPinned((p) => (p === id ? null : id));

  return (
    <div data-theme="dark" className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas text-ink shadow-card">
      <style>{`@keyframes proof-twinkle{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      <div className="grid lg:grid-cols-[1fr_19rem]">
        <div ref={wrapRef} className="relative min-h-[320px] bg-[radial-gradient(70%_60%_at_50%_40%,rgb(124_92_255/0.16),transparent_70%)]">
          {!layout ? (
            <div className="aspect-[1/1.1] w-full animate-pulse sm:aspect-[1.6/1]" aria-hidden />
          ) : (
            <svg
              viewBox={`0 0 ${layout.w} ${layout.h}`}
              width="100%"
              height={layout.h}
              className="block select-none"
              role="group"
              aria-label={`Skill constellation: ${evidence.length} verified evidence stars across ${layout.nodes.filter((n) => n.type === "skill").length} skills`}
              onMouseLeave={() => setHover(null)}
            >
              <g aria-hidden>
                {layout.dust.map((d, i) => (
                  <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="var(--ink)" opacity={0.18} />
                ))}
              </g>
              <g aria-hidden>
                {layout.edges.map((e, i) => {
                  const a = layout.pos.get(`ev:${e.ev}`)!;
                  const b = layout.pos.get(`skill:${e.skill}`)!;
                  const on = lit.has(`ev:${e.ev}`) && lit.has(`skill:${e.skill}`);
                  return (
                    <motion.line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="var(--lime)"
                      strokeWidth={on ? 1.4 : 0.8}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: active ? (on ? 0.9 : 0.08) : 0.28 }}
                      transition={{ duration: 0.6, delay: active ? 0 : 0.3 + i * 0.008 }}
                    />
                  );
                })}
              </g>
              {layout.nodes.map((n) => {
                const p = layout.pos.get(n.id)!;
                const dim = active && !lit.has(n.id);
                const isActive = active === n.id;
                if (n.type === "skill") {
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${p.x} ${p.y})`}
                      tabIndex={0}
                      role="button"
                      aria-pressed={pinned === n.id}
                      aria-label={`${n.skill.name}: skill score ${n.skill.score}`}
                      className="cursor-pointer outline-none"
                      onMouseEnter={() => setHover(n.id)}
                      onFocus={() => setHover(n.id)}
                      onBlur={() => setHover(null)}
                      onClick={() => select(n.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          select(n.id);
                        }
                      }}
                      style={{ opacity: dim ? 0.35 : 1, transition: "opacity 200ms" }}
                    >
                      <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}>
                        <circle r={n.r + 9} fill="var(--lime)" opacity={isActive ? 0.22 : 0.08} />
                        <circle r={n.r} fill="var(--lime)" stroke="var(--canvas)" strokeWidth={2} />
                        {isActive && <circle r={n.r + 5} fill="none" stroke="var(--ring)" strokeWidth={2} />}
                      </motion.g>
                      <text y={n.r + 16} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="var(--ink)" style={{ fontFamily: "var(--font-display)" }}>
                        {n.skill.name}
                      </text>
                      <text y={n.r + 29} textAnchor="middle" fontSize={10} fill="var(--muted)" style={{ fontFamily: "var(--font-mono)" }}>
                        {n.skill.score > 0 ? n.skill.score : "new"}
                      </text>
                    </g>
                  );
                }
                const meta = KIND_META[n.ev.kind];
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x} ${p.y})`}
                    tabIndex={0}
                    role="button"
                    aria-pressed={pinned === n.id}
                    aria-label={`${meta.label}: ${n.ev.title}`}
                    className="cursor-pointer outline-none"
                    onMouseEnter={() => setHover(n.id)}
                    onFocus={() => setHover(n.id)}
                    onBlur={() => setHover(null)}
                    onClick={() => select(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(n.id);
                      }
                    }}
                    style={{ opacity: dim ? 0.25 : 1, transition: "opacity 200ms" }}
                  >
                    {/* Generous invisible hit area for touch. */}
                    <circle r={14} fill="transparent" />
                    <motion.g
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: isActive ? 1.5 : 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 20, delay: isActive ? 0 : 0.35 + n.index * 0.03 }}
                    >
                      <path
                        d={shapePath(meta.shape, n.r)}
                        fill={meta.shape === "ring" ? "none" : "var(--lime)"}
                        stroke={meta.shape === "ring" ? "var(--lime)" : "none"}
                        strokeWidth={1.8}
                        style={{ animation: `proof-twinkle ${3 + (n.index % 4)}s ease-in-out ${(n.index % 7) * 0.4}s infinite` }}
                      />
                    </motion.g>
                    {isActive && <circle r={n.r + 9} fill="none" stroke="var(--ring)" strokeWidth={1.6} />}
                  </g>
                );
              })}
            </svg>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-[11px] text-muted" aria-label="Legend">
            {KIND_ORDER.filter((k) => evidence.some((e) => e.kind === k)).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <svg viewBox="-8 -8 16 16" className="size-3" aria-hidden>
                  <path
                    d={shapePath(KIND_META[k].shape, 4.5)}
                    fill={KIND_META[k].shape === "ring" ? "none" : "var(--lime)"}
                    stroke={KIND_META[k].shape === "ring" ? "var(--lime)" : "none"}
                    strokeWidth={1.8}
                  />
                </svg>
                {KIND_META[k].label}
              </li>
            ))}
          </ul>
        </div>

        <aside className="border-t border-line bg-surface/60 p-5 lg:border-t-0 lg:border-l" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {activeEv ? (
              <motion.div key={activeEv.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                <EvidenceInspector ev={activeEv} />
              </motion.div>
            ) : activeSkill ? (
              <motion.div key={activeSkill.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
                <p className="font-mono text-[10.5px] tracking-[0.14em] text-subtle uppercase">Skill</p>
                <h3 className="mt-1 text-xl font-semibold">{activeSkill.skill.name}</h3>
                <p className="mt-1 font-mono text-sm text-verified">
                  {activeSkill.skill.score > 0 ? `${activeSkill.skill.score} / 100` : "Evidence arriving"}
                </p>
                <ul className="mt-4 grid gap-1.5">
                  {evidence
                    .filter((e) => e.skillSlugs.includes(activeSkill.skill.slug))
                    .map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setPinned(`ev:${e.id}`)}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                        >
                          <SealGlyph className="mt-0.5 size-3.5 shrink-0 text-lime" />
                          <span className="line-clamp-2">{e.title}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </motion.div>
            ) : (
              <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col justify-center">
                <MousePointerClick className="size-5 text-lime" aria-hidden />
                <p className="mt-3 font-display text-lg font-semibold">Every star is evidence.</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  Hover, focus or tap a star to see the commit, deployment, check or endorsement behind it. Bright hubs are
                  skills; their size follows the skill&apos;s Proof Score.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

function EvidenceInspector({ ev }: { ev: DossierEvidence }) {
  const meta = KIND_META[ev.kind];
  const Icon = meta.icon;
  return (
    <div>
      <p className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.14em] text-subtle uppercase">
        <Icon className="size-3.5 text-lime" aria-hidden /> {meta.label}
      </p>
      <h3 className="mt-1.5 text-lg leading-snug font-semibold">{ev.title}</h3>
      {ev.summary && <p className="mt-1 text-sm text-muted">{ev.summary}</p>}
      {ev.facts.length > 0 && (
        <dl className="mt-4 grid gap-1.5 border-t border-dashed border-line-strong pt-3 text-[13px]">
          {ev.facts.slice(0, 5).map((f) => (
            <div key={f.label} className="flex justify-between gap-3">
              <dt className="shrink-0 text-subtle">{f.label}</dt>
              <dd className={cn("min-w-0 text-right font-mono text-[12px]", f.label === "Statement" && "font-sans italic")}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        {ev.at && <span className="font-mono text-subtle">{formatDay(ev.at)}</span>}
        {ev.sourceUrl && (
          <a href={ev.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 text-violet-text hover:underline">
            Source <ArrowUpRight className="size-3" aria-hidden />
          </a>
        )}
        {ev.credentialId && (
          <Link href={`/verify/${ev.credentialId}`} className="inline-flex items-center gap-1 text-lime hover:underline">
            <SealGlyph className="size-3.5" /> Credential
          </Link>
        )}
      </div>
    </div>
  );
}
