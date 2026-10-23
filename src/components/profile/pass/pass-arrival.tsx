"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";

/**
 * Arrival moment for a scanned Proof Pass: the QR and NFC tag carry `?via=pass`. On arrival a
 * lime scan line sweeps the viewport, a "Scanned · verified dossier" stamp lands, and a toast
 * confirms. Plays once per tab, so a reload does not replay it.
 */
export function PassArrival({ handle, sealCount }: { handle: string; sealCount: number }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  const fired = useRef(false);

  useEffect(() => {
    // Once per page load. Timers are not cancelled on a re-run (StrictMode, or the reduced-motion
    // preference resolving) so the moment still plays.
    if (fired.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("via") !== "pass") return;
    fired.current = true;
    // Do not rewrite the URL (the app router owns history); remember the arrival per tab so a
    // reload does not replay it.
    const key = `proof:pass-arrival:${handle}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: play it anyway */
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => setShow(true), 0);
    setTimeout(
      () =>
        toast.success("Scanned: verified dossier", {
          description: `@${handle} · ${sealCount} ${sealCount === 1 ? "seal" : "seals"}, each linked to a signed credential.`,
        }),
      still ? 0 : 650,
    );
    setTimeout(() => setShow(false), still ? 1400 : 2100);
  }, [handle, sealCount]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60] grid place-items-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          role="status"
          aria-label="Scanned: verified dossier"
        >
          {!reduce && (
            <motion.div
              className="absolute inset-x-0 h-24 bg-[linear-gradient(180deg,transparent,rgb(198_244_50/0.28)_70%,#c6f432_100%)]"
              initial={{ top: "-6rem" }}
              animate={{ top: "100%" }}
              transition={{ duration: 0.75, ease: [0.45, 0, 0.2, 1] }}
              aria-hidden
            />
          )}
          <motion.div
            className="relative grid size-[180px] place-items-center sm:size-[220px]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.6, rotate: -32 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -9 }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 420, damping: 20, delay: 0.35 }}
            aria-hidden
          >
            <svg viewBox="0 0 100 100" className="size-full drop-shadow-[0_18px_40px_rgb(10_11_16/0.45)]">
              <defs>
                <path id="pa-arc" d="M50 50m-36 0a36 36 0 1 1 72 0a36 36 0 1 1 -72 0" />
              </defs>
              <circle cx="50" cy="50" r="48" fill="#c6f432" />
              <circle cx="50" cy="50" r="44.5" fill="none" stroke="#0a0b10" strokeWidth="1.4" />
              <circle cx="50" cy="50" r="27" fill="none" stroke="#0a0b10" strokeWidth="1.4" />
              <text fontSize="7.4" fontFamily="var(--font-mono)" fontWeight="700" letterSpacing="1.1" fill="#0a0b10">
                <textPath href="#pa-arc">SCANNED · VERIFIED DOSSIER · PROOF ·</textPath>
              </text>
              <path d="M38 51l8.5 8.5 16-17" fill="none" stroke="#0a0b10" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
