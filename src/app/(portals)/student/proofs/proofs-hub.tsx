"use client";

import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  ExternalLink,
  GitBranch,
  GitFork,
  Globe,
  RefreshCw,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import type { ProofsHub as Hub } from "@/server/student/proofs";
import {
  addDeploymentAction,
  checkGithubProofAction,
  importRepoAction,
  listCandidateReposAction,
  recheckDeploymentAction,
  removeDeploymentAction,
  requestEndorsementAction,
  startGithubProofAction,
  verifyDeploymentAction,
  type Moment,
} from "@/server/student/proof-actions";
import { SealMoment } from "../_components/seal-moment";

export type HubTab = "github" | "repos" | "deployments" | "checks" | "endorsements";
type CheckSummary = { slug: string; title: string; level: string; best: number | null; passed: boolean; attempts: number };

const FLAG_COPY: Record<string, string> = {
  all_commits_one_day: "All commits on one day",
  bulk_import: "Bulk-imported history",
  backdated_history: "New repo, years of history",
  fork_without_own_commits: "Fork with no own commits",
  low_authorship: "Under 20% authorship",
};

export function ProofsHub({ hub, checks, initialTab }: { hub: Hub; checks: CheckSummary[]; initialTab: HubTab }) {
  const [tab, setTab] = useState<HubTab>(initialTab);
  const [moment, setMoment] = useState<Moment | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const counts: Record<HubTab, number> = {
    github: hub.github?.status === "verified" ? 1 : 0,
    repos: hub.repos.filter((r) => r.status === "verified").length,
    deployments: hub.deployments.filter((d) => d.status === "verified").length,
    checks: checks.filter((c) => c.passed).length,
    endorsements: hub.endorsements.filter((e) => e.status === "endorsed").length,
  };
  const items: { value: HubTab; label: string; icon: typeof GitBranch }[] = [
    { value: "github", label: "GitHub", icon: GitBranch },
    { value: "repos", label: "Repos", icon: GitFork },
    { value: "deployments", label: "Deployments", icon: Globe },
    { value: "checks", label: "Skill checks", icon: Code2 },
    { value: "endorsements", label: "Endorsements", icon: Users },
  ];

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as HubTab);
          router.replace(`${pathname}?tab=${v}`, { scroll: false });
        }}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            {items.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                <t.icon aria-hidden />
                {t.label}
                {counts[t.value] > 0 && (
                  <span className="ml-0.5 inline-flex items-center gap-0.5 font-mono text-[11px] text-verified">
                    <SealGlyph className="size-3" />
                    {counts[t.value]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="github">
          <GithubPanel hub={hub} onMoment={setMoment} />
        </TabsContent>
        <TabsContent value="repos">
          <ReposPanel hub={hub} onMoment={setMoment} goGithub={() => setTab("github")} />
        </TabsContent>
        <TabsContent value="deployments">
          <DeploymentsPanel hub={hub} onMoment={setMoment} />
        </TabsContent>
        <TabsContent value="checks">
          <ChecksPanel checks={checks} />
        </TabsContent>
        <TabsContent value="endorsements">
          <EndorsementsPanel hub={hub} />
        </TabsContent>
      </Tabs>
      <SealMoment data={moment} onClose={() => setMoment(null)} />
    </>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Copy failed; select the text instead.");
        }
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "Copied" : label}
    </Button>
  );
}

function Step({ n, title, children, done }: { n: number; title: string; children?: React.ReactNode; done?: boolean }) {
  return (
    <li className="relative grid grid-cols-[2rem_1fr] gap-3">
      <span className={cn("grid size-8 place-items-center rounded-full border font-mono text-xs", done ? "border-verified/40 bg-verified-soft text-verified" : "border-line-strong bg-surface text-muted")}>
        {done ? <Check className="size-4" /> : n}
      </span>
      <div className="min-w-0 pb-5">
        <p className="pt-1 text-sm font-medium">{title}</p>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ GitHub */

function GithubPanel({ hub, onMoment }: { hub: Hub; onMoment: (m: Moment) => void }) {
  const gh = hub.github;
  const [username, setUsername] = useState(gh?.username ?? "");
  const [statement, setStatement] = useState(gh?.status !== "verified" ? gh?.statement : undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [checking, startCheck] = useTransition();

  if (gh?.status === "verified") {
    return (
      <Card variant="verified">
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center">
          {gh.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gh.avatarUrl} alt="" className="size-14 rounded-2xl border border-line" />
          ) : (
            <span className="grid size-14 place-items-center rounded-2xl border border-line bg-surface-2">
              <GitBranch className="size-6 text-muted" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-display text-lg font-semibold">
              github.com/{gh.username} <Badge variant="verified">Owner proven</Badge>
            </p>
            <p className="text-sm text-muted">
              Verified {timeAgo(gh.verifiedAt)} with a signed <span className="font-mono">proof.md</span> gist. Last checked {timeAgo(gh.lastCheckedAt)}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {gh.gistUrl && (
              <Button variant="secondary" size="sm" asChild>
                <a href={gh.gistUrl} target="_blank" rel="noreferrer">
                  Gist <ExternalLink />
                </a>
              </Button>
            )}
            {gh.credentialId && (
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/verify/${gh.credentialId}`}>Credential</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prove you own your GitHub</CardTitle>
        <CardDescription>
          No OAuth, no access to your code. You publish a public gist with a one-time code; we read it through GitHub&apos;s public API.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol>
          <Step n={1} title="Your GitHub username" done={!!statement}>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await startGithubProofAction({ username });
                  if (!res.ok) return void toast.error(res.error);
                  setStatement(res.statement);
                  setMessage(null);
                });
              }}
            >
              <Input aria-label="GitHub username" placeholder="your-github-username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className="sm:max-w-xs" />
              <Button type="submit" variant="secondary" loading={pending}>
                {statement ? "New code" : "Get my code"}
              </Button>
            </form>
          </Step>
          <Step n={2} title={`Create a public gist named proof.md with exactly this text`}>
            {statement ? (
              <div className="grid gap-2">
                <pre className="overflow-x-auto rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed">{statement}</pre>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={statement} label="Copy statement" />
                  <Button variant="secondary" size="sm" asChild>
                    <a href="https://gist.github.com/" target="_blank" rel="noreferrer">
                      Open gist.github.com <ExternalLink />
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Enter your username first.</p>
            )}
          </Step>
          <Step n={3} title="Check it">
            <Button
              disabled={!statement}
              loading={checking}
              onClick={() =>
                startCheck(async () => {
                  const res = await checkGithubProofAction();
                  if (!res.ok) return void toast.error(res.error);
                  if (res.verified && res.moment) onMoment(res.moment);
                  else setMessage(res.message ?? "Not found yet.");
                })
              }
            >
              Verify my gist
            </Button>
            <AnimatePresence>
              {message && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 flex items-start gap-2 text-sm text-coral-text" role="status">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {message}
                </motion.p>
              )}
            </AnimatePresence>
          </Step>
        </ol>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ repos */

type Candidate = { fullName: string; name: string; description: string | null; language: string | null; stars: number; fork: boolean; pushedAt: string; imported: boolean };

function ReposPanel({ hub, onMoment, goGithub }: { hub: Hub; onMoment: (m: Moment) => void; goGithub: () => void }) {
  const proven = hub.github?.status === "verified";
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  const doImport = async (fullName: string) => {
    setBusy(fullName);
    const res = await importRepoAction({ fullName });
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    setCandidates((c) => c?.map((x) => (x.fullName === fullName ? { ...x, imported: true } : x)) ?? null);
    if (res.verified && res.moment) onMoment(res.moment);
    else toast.warning(res.message ?? "Imported, not counted.");
  };

  if (!proven) {
    return (
      <EmptyState
        icon={GitBranch}
        title="Prove your GitHub first"
        description="Repo authorship only counts once we know the commits are yours."
        action={<Button onClick={goGithub}>Prove ownership</Button>}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Import repos</CardTitle>
            <CardDescription>We count commits authored by @{hub.github?.username}, active weeks and languages, and flag anything that looks copied.</CardDescription>
          </div>
          <Button
            variant="secondary"
            loading={loading}
            onClick={() =>
              startLoad(async () => {
                const res = await listCandidateReposAction();
                if (!res.ok) return void toast.error(res.error);
                setCandidates(res.repos);
              })
            }
          >
            <RefreshCw /> {candidates ? "Refresh" : "Load my repos"}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) void doImport(manual.trim());
            }}
          >
            <Input aria-label="Repository owner/name" placeholder="owner/repo, e.g. team/hackathon-app" autoComplete="off" autoCapitalize="none" spellCheck={false} value={manual} onChange={(e) => setManual(e.target.value)} />
            <Button type="submit" variant="secondary" loading={busy === manual.trim() && !!manual}>
              Import
            </Button>
          </form>
          {candidates && (
            <ul className="grid max-h-80 gap-1 overflow-y-auto rounded-xl border border-line p-1">
              {candidates.length === 0 && <li className="p-3 text-sm text-muted">No public repos with code found.</li>}
              {candidates.map((c) => (
                <li key={c.fullName} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {c.name}
                      {c.fork && <Badge>fork</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted">{[c.language, c.description].filter(Boolean).join(" · ") || "No description"}</p>
                  </div>
                  {c.imported ? (
                    <Badge variant="verified">Imported</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" loading={busy === c.fullName} onClick={() => doImport(c.fullName)}>
                      Import
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {hub.repos.length === 0 ? (
        <EmptyState icon={GitFork} title="No repos imported" description="Import a repo you wrote most of. It becomes authorship evidence." />
      ) : (
        <motion.ul layout className="grid gap-4 md:grid-cols-2">
          {hub.repos.map((r) => (
            <motion.li layout key={r.id} transition={springs.layout}>
              <RepoCard repo={r} />
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

function RepoCard({ repo: r }: { repo: Hub["repos"][number] }) {
  const s = r.stats;
  const langs = Object.entries(r.languages).sort((a, b) => b[1] - a[1]);
  const totalBytes = langs.reduce((a, [, b]) => a + b, 0) || 1;
  const tones = ["bg-lime", "bg-violet", "bg-coral", "bg-ink/40"];
  const verified = r.status === "verified";
  return (
    <Card variant={verified ? "verified" : "default"} className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <a href={r.url} target="_blank" rel="noreferrer" className="min-w-0 font-display text-base font-semibold hover:underline">
            <span className="block truncate">{r.fullName}</span>
          </a>
          {verified ? <Badge variant="verified">Authorship</Badge> : r.status === "failed" ? <Badge variant="coral">Not yours</Badge> : <Badge variant="coral">Needs review</Badge>}
        </div>
        {r.description && <CardDescription className="line-clamp-2">{r.description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-3">
        {s && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Own commits", v: s.ownCommits },
                { k: "Active weeks", v: s.activeWeeks },
                { k: "Authorship", v: `${Math.round(s.share * 100)}%` },
              ].map((x) => (
                <div key={x.k} className="rounded-xl border border-line bg-surface-2 px-2 py-2">
                  <div className="font-display text-lg font-semibold tabular">{x.v}</div>
                  <div className="text-[11px] text-muted">{x.k}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-subtle">
                <span>
                  {s.ownCommits} of {s.totalCommits} commits
                </span>
                {s.firstCommitAt && <span>since {new Date(s.firstCommitAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <motion.div className="h-full rounded-full bg-lime" initial={{ width: 0 }} animate={{ width: `${Math.round(s.share * 100)}%` }} transition={springs.gentle} />
              </div>
            </div>
          </>
        )}
        {langs.length > 0 && (
          <div>
            <div className="flex h-1.5 overflow-hidden rounded-full">
              {langs.slice(0, 4).map(([l, b], i) => (
                <span key={l} className={tones[i]} style={{ width: `${(b / totalBytes) * 100}%` }} />
              ))}
            </div>
            <p className="mt-1.5 truncate text-[11px] text-muted">
              {langs
                .slice(0, 4)
                .map(([l, b]) => `${l} ${Math.round((b / totalBytes) * 100)}%`)
                .join(" · ")}
            </p>
          </div>
        )}
        {s && s.redFlags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {s.redFlags.map((f) => (
              <li key={f}>
                <Badge variant="coral">
                  <AlertTriangle /> {FLAG_COPY[f] ?? f}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between text-xs text-subtle">
          <span className="flex items-center gap-3">
            {r.isFork && (
              <span className="flex items-center gap-1">
                <GitFork className="size-3" /> fork
              </span>
            )}
            <span className="flex items-center gap-1">
              <Star className="size-3" /> {r.stars}
            </span>
          </span>
          {r.credentialId && (
            <Link href={`/verify/${r.credentialId}`} className="font-mono text-violet-text hover:underline">
              credential
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ deployments */

function DeploymentsPanel({ hub, onMoment }: { hub: Hub; onMoment: (m: Moment) => void }) {
  const [url, setUrl] = useState("");
  const [repoId, setRepoId] = useState<string>("none");
  const [adding, startAdd] = useTransition();
  const router = useRouter();
  const pending = hub.deployments.filter((d) => d.status !== "verified");
  const live = hub.deployments.filter((d) => d.status === "verified");

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a live deployment</CardTitle>
          <CardDescription>Something you shipped and host yourself. You will get a token to place on the site.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              startAdd(async () => {
                const res = await addDeploymentAction({ url, repoId: repoId === "none" ? null : repoId });
                if (!res.ok) return void toast.error(res.error);
                setUrl("");
                toast.success("Added. Place the token, then verify.");
                router.refresh();
              });
            }}
          >
            <Input aria-label="Deployment URL" autoComplete="url" spellCheck={false} placeholder="https://your-app.vercel.app" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
            <Select value={repoId} onValueChange={setRepoId}>
              <SelectTrigger aria-label="Linked repo">
                <SelectValue placeholder="Linked repo (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked repo</SelectItem>
                {hub.repos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" loading={adding}>
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {pending.map((d) => (
        <PendingDeployment key={d.id} dep={d} onMoment={onMoment} />
      ))}

      {live.length === 0 && pending.length === 0 ? (
        <EmptyState icon={Globe} title="No deployments yet" description="A live, working site is the strongest proof that you can ship." />
      ) : (
        live.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2">
            {live.map((d) => (
              <LiveDeployment key={d.id} dep={d} />
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function PendingDeployment({ dep, onMoment }: { dep: Hub["deployments"][number]; onMoment: (m: Moment) => void }) {
  const [verifying, start] = useTransition();
  const [removing, startRemove] = useTransition();
  const [message, setMessage] = useState<string | null>(dep.status === "failed" ? "Last check did not find the token." : null);
  const router = useRouter();
  const meta = `<meta name="proof-verification" content="${dep.token}">`;
  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="min-w-0 truncate font-mono text-sm">{dep.url}</CardTitle>
          <Badge variant={dep.status === "failed" ? "coral" : "neutral"}>{dep.status === "failed" ? "Not found" : "Awaiting token"}</Badge>
        </div>
        <CardDescription>Use either method, deploy, then verify.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2 rounded-xl border border-line bg-surface-2 p-3">
            <p className="text-xs font-medium">A. Meta tag in your page&apos;s &lt;head&gt;</p>
            <code className="block overflow-x-auto font-mono text-[11px] whitespace-nowrap">{meta}</code>
            <div>
              <CopyButton text={meta} />
            </div>
          </div>
          <div className="grid gap-2 rounded-xl border border-line bg-surface-2 p-3">
            <p className="text-xs font-medium">
              B. A file at <span className="font-mono">/.well-known/proof.txt</span>
            </p>
            <code className="block overflow-x-auto font-mono text-[11px]">{dep.token}</code>
            <div>
              <CopyButton text={dep.token} label="Copy token" />
            </div>
          </div>
        </div>
        {message && (
          <p className="flex items-start gap-2 text-sm text-coral-text" role="status">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            loading={verifying}
            onClick={() =>
              start(async () => {
                const res = await verifyDeploymentAction({ deploymentId: dep.id });
                if (!res.ok) return void toast.error(res.error);
                if (res.verified && res.moment) onMoment(res.moment);
                else setMessage(res.message ?? "Token not found.");
              })
            }
          >
            Verify now
          </Button>
          <Button
            variant="ghost"
            loading={removing}
            onClick={() =>
              startRemove(async () => {
                const res = await removeDeploymentAction({ deploymentId: dep.id });
                if (!res.ok) return void toast.error(res.error);
                router.refresh();
              })
            }
          >
            <Trash2 /> Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveDeployment({ dep }: { dep: Hub["deployments"][number] }) {
  const [busy, start] = useTransition();
  const healthy = dep.lastStatusCode != null && dep.lastStatusCode >= 200 && dep.lastStatusCode < 400;
  let host = dep.url;
  try {
    host = new URL(dep.url).host;
  } catch {}
  return (
    <li>
      <Card variant="verified" className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <a href={dep.url} target="_blank" rel="noreferrer" className="min-w-0 truncate font-display text-base font-semibold hover:underline">
              {host}
            </a>
            <Badge variant="verified">Live</Badge>
          </div>
          <CardDescription>
            {dep.method === "meta" ? "Meta tag" : "proof.txt"}
            {dep.repo ? ` · ${dep.repo.name}` : ""}
            {dep.homepageMatchesRepo ? " · repo homepage matches" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
            <span className="relative flex size-2.5">
              {healthy && <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-60" />}
              <span className={cn("relative inline-flex size-2.5 rounded-full", healthy ? "bg-lime" : "bg-coral")} />
            </span>
            <span className="font-mono text-xs tabular">{dep.lastStatusCode ?? "—"}</span>
            <span className="font-mono text-xs text-muted tabular">{dep.lastResponseMs != null ? `${dep.lastResponseMs} ms` : ""}</span>
            <span className="ml-auto text-xs text-subtle">checked {timeAgo(dep.lastCheckedAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              loading={busy}
              onClick={() =>
                start(async () => {
                  const res = await recheckDeploymentAction({ deploymentId: dep.id });
                  if (!res.ok) toast.error(res.error);
                  else toast(res.message);
                })
              }
            >
              <RefreshCw /> Health check
            </Button>
            {dep.credentialId && (
              <Link href={`/verify/${dep.credentialId}`} className="font-mono text-xs text-violet-text hover:underline">
                credential
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

/* ------------------------------------------------------------------ checks */

function ChecksPanel({ checks }: { checks: CheckSummary[] }) {
  const passed = checks.filter((c) => c.passed);
  const suggested = checks.filter((c) => !c.passed).slice(0, 3);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Passed</CardTitle>
          <CardDescription>Graded in a sandbox against hidden tests.</CardDescription>
        </CardHeader>
        <CardContent>
          {passed.length === 0 ? (
            <p className="text-sm text-muted">None yet. Beginner checks take about 15 minutes.</p>
          ) : (
            <ul className="grid gap-2">
              {passed.map((c) => (
                <li key={c.slug} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <SealGlyph className="size-4 shrink-0 text-verified" />
                    <span className="truncate">{c.title}</span>
                  </span>
                  <Badge variant="verified" mono>
                    {c.best}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Try next</CardTitle>
          <CardDescription>Timed, in the browser, no setup.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {suggested.map((c) => (
            <Link key={c.slug} href={`/student/checks/${c.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-sm transition-colors hover:bg-surface-2">
              <span className="truncate">{c.title}</span>
              <Badge variant={c.level === "advanced" ? "violet" : "neutral"}>{c.level}</Badge>
            </Link>
          ))}
          <Button variant="secondary" asChild className="mt-1">
            <Link href="/student/checks">All skill checks</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ endorsements */

function EndorsementsPanel({ hub }: { hub: Hub }) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted">
          Endorsements come only from mentors who proved their institutional email. They vouch for one skill or project at a time.
        </p>
        <RequestDialog hub={hub} />
      </div>
      {hub.endorsements.length === 0 ? (
        <EmptyState icon={Users} title="No endorsements yet" description="Ask a professor, TA or senior who has seen your work first-hand." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {hub.endorsements.map((e) => (
            <li key={e.id}>
              <Card variant={e.status === "endorsed" ? "verified" : "default"} className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{e.mentorName}</CardTitle>
                      <CardDescription className="truncate">{[e.mentorTitle, e.mentorOrg].filter(Boolean).join(", ")}</CardDescription>
                    </div>
                    <Badge variant={e.status === "endorsed" ? "verified" : e.status === "requested" ? "violet" : "coral"}>
                      {e.status === "endorsed" ? "Endorsed" : e.status === "requested" ? "Requested" : e.status === "declined" ? "Declined" : "Revoked"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm">
                  <p className="text-xs text-muted">
                    {e.subjectType === "skill" ? "Skill" : "Project"}: <span className="font-medium text-ink">{e.skillName ?? e.repoName ?? "—"}</span> · Verified mentor at @{e.mentorDomain}
                  </p>
                  {e.statement && <blockquote className="border-l-2 border-lime pl-3 text-pretty italic">“{e.statement}”</blockquote>}
                  <div className="flex items-center justify-between text-xs text-subtle">
                    <span>{e.status === "requested" ? `asked ${timeAgo(e.requestedAt)}` : timeAgo(e.respondedAt)}</span>
                    {e.credentialId && (
                      <Link href={`/verify/${e.credentialId}`} className="font-mono text-violet-text hover:underline">
                        credential
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestDialog({ hub }: { hub: Hub }) {
  const [open, setOpen] = useState(false);
  const [mentorId, setMentorId] = useState("");
  const [subjectType, setSubjectType] = useState<"skill" | "project">("skill");
  const [subjectId, setSubjectId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const verifiedRepos = hub.repos.filter((r) => r.status === "verified");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Request an endorsement</Button>
      </DialogTrigger>
      <DialogContent>
        <h2 className="font-display text-lg font-semibold">Request an endorsement</h2>
        <p className="mt-1 text-sm text-muted">They will see your request in their inbox and can write a short statement.</p>
        <form
          className="mt-5 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const res = await requestEndorsementAction({
                mentorId,
                subjectType,
                skillId: subjectType === "skill" ? subjectId || null : null,
                repoId: subjectType === "project" ? subjectId || null : null,
                relationship,
              });
              if (!res.ok) return setError(res.error);
              toast.success("Request sent");
              setOpen(false);
              setRelationship("");
              router.refresh();
            });
          }}
        >
          <Field label="Mentor" htmlFor="mentor">
            <Select value={mentorId} onValueChange={setMentorId}>
              <SelectTrigger id="mentor">
                <SelectValue placeholder={hub.mentors.length ? "Choose a verified mentor" : "No verified mentors yet"} />
              </SelectTrigger>
              <SelectContent>
                {hub.mentors.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} · @{m.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium">Endorse</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Subject type">
              {(["skill", "project"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={subjectType === t}
                  onClick={() => {
                    setSubjectType(t);
                    setSubjectId("");
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm transition-colors",
                    subjectType === t ? "border-violet bg-violet-soft text-violet-text" : "border-line-strong hover:bg-surface-2",
                  )}
                >
                  {t === "skill" ? "A skill" : "A project"}
                </button>
              ))}
            </div>
          </div>
          <Field label={subjectType === "skill" ? "Skill" : "Repo"} htmlFor="subject">
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger id="subject">
                <SelectValue placeholder={subjectType === "skill" ? "Choose a skill" : verifiedRepos.length ? "Choose a verified repo" : "Import a repo first"} />
              </SelectTrigger>
              <SelectContent>
                {subjectType === "skill"
                  ? hub.skills.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))
                  : verifiedRepos.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="How they know your work" htmlFor="relationship" hint="e.g. Guided my final-year project">
            <Textarea id="relationship" placeholder="e.g. Professor for my capstone project" value={relationship} onChange={(e) => setRelationship(e.target.value)} maxLength={160} className="min-h-16" />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-coral-text">
              {error}
            </p>
          )}
          <Button type="submit" loading={pending}>
            Send request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
