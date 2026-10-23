"use client";

import { motion, type HTMLMotionProps, type Variants } from "motion/react";
import { springs } from "./transitions";

const container: Variants = {
  hidden: {},
  show: (stagger: number = 0.06) => ({ transition: { staggerChildren: stagger } }),
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: springs.gentle },
};

/** Children wrapped in <StaggerItem> reveal one after another. */
export function Stagger({
  stagger = 0.06,
  inView = false,
  ...props
}: HTMLMotionProps<"div"> & { stagger?: number; inView?: boolean }) {
  return (
    <motion.div
      variants={container}
      custom={stagger}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true } } : { animate: "show" })}
      {...props}
    />
  );
}

export function StaggerItem(props: HTMLMotionProps<"div">) {
  return <motion.div variants={item} {...props} />;
}
