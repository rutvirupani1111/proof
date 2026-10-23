import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm text-muted md:flex">
          <Link href="/#students" className="rounded-lg px-3 py-1.5 hover:bg-surface-2 hover:text-ink">Students</Link>
          <Link href="/#recruiters" className="rounded-lg px-3 py-1.5 hover:bg-surface-2 hover:text-ink">Recruiters</Link>
          <Link href="/#colleges" className="rounded-lg px-3 py-1.5 hover:bg-surface-2 hover:text-ink">Colleges</Link>
          <Link href="/#engine" className="rounded-lg px-3 py-1.5 hover:bg-surface-2 hover:text-ink">How it works</Link>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span>Hiring on verified work, not resumes.</span>
        </div>
        <p className="font-mono text-xs text-subtle">Demo data is fictional. Credentials are verifiable at /verify.</p>
      </div>
    </footer>
  );
}
