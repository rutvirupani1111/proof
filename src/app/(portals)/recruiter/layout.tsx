import type { ReactNode } from "react";
import { PortalLayout } from "@/components/shell/portal-layout";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return <PortalLayout portal="recruiter">{children}</PortalLayout>;
}
