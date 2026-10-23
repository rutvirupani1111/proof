"use client";

import { motion } from "motion/react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { createContext, useContext, useId, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { springs } from "@/components/motion/transitions";

const TabsCtx = createContext<{ value?: string; group: string }>({ group: "tabs" });

/** Radix Tabs with a sliding indicator. Works controlled (`value`) or uncontrolled (`defaultValue`). */
export function Tabs({
  value: controlled,
  defaultValue,
  onValueChange,
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>) {
  const [inner, setInner] = useState(defaultValue);
  const value = controlled ?? inner;
  const group = useId();
  return (
    <TabsCtx.Provider value={{ value, group }}>
      <TabsPrimitive.Root
        value={value}
        onValueChange={(v) => {
          setInner(v);
          onValueChange?.(v);
        }}
        {...props}
      />
    </TabsCtx.Provider>
  );
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  children,
  value,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  const ctx = useContext(TabsCtx);
  const active = ctx.value === value;
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "relative inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted transition-colors",
        "hover:text-ink data-[state=active]:text-ink disabled:opacity-50 [&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {active && (
        <motion.span
          layoutId={`${ctx.group}-indicator`}
          className="absolute inset-0 rounded-lg border border-line bg-surface shadow-card"
          transition={springs.snappy}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-4 focus-visible:outline-none data-[state=active]:animate-fade-in", className)}
      {...props}
    />
  );
}
