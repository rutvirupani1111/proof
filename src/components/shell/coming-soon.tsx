import { Hammer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { NAV } from "./nav-config";
import type { Portal } from "@/lib/auth/roles";

/** Rendered by each portal's [...slug] catch-all until the real page exists. */
export function ComingSoon({ portal, slug }: { portal: Portal; slug: string[] }) {
  const href = `/${portal}/${slug.join("/")}`;
  const item = NAV[portal].flatMap((s) => s.items).find((i) => i.href === href);
  return (
    <>
      <PageHeader eyebrow="Coming soon" title={item?.label ?? "Not built yet"} />
      <EmptyState
        icon={Hammer}
        title="This page is being built"
        description="The foundation is in place; this feature lands in an upcoming build."
        action={
          <Button variant="secondary" asChild>
            <Link href={`/${portal}`}>Back to dashboard</Link>
          </Button>
        }
      />
    </>
  );
}
