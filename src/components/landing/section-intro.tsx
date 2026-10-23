import type { ReactNode } from "react";
import { FadeIn } from "@/components/motion";
import { cn } from "@/lib/utils";

/** Eyebrow + display heading + lede, the opening of every marketing section. */
export function SectionIntro({
  eyebrow,
  title,
  children,
  align = "left",
  id,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  align?: "left" | "center";
  id?: string;
  className?: string;
}) {
  return (
    <FadeIn inView className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-[2.75rem]">
        {title}
      </h2>
      {children && <div className="mt-4 text-pretty text-muted sm:text-lg">{children}</div>}
    </FadeIn>
  );
}
