"use client";

import { Check, Copy, Download, GraduationCap, MessageCircle, Nfc, Share2, Smartphone } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "@/components/ui/toast";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { cn } from "@/lib/utils";
import { PASS_CSS } from "./pass-css";

export type ProofPassProps = {
  name: string;
  handle: string;
  score: number;
  sealCount: number;
  skills: string[];
  college: string | null;
  /** Canonical dossier URL (what links share). */
  url: string;
  /** URL the QR and NFC tag carry (`?via=pass`). */
  passUrl: string;
  /** Server-built SVG markup for the branded QR. */
  qrSvg: string;
  /** Path of the server-rendered PNG; null when the dossier is not public. */
  passImage: string | null;
};

type NdefWriter = { write: (msg: { records: Array<{ recordType: string; data: string }> }) => Promise<void> };

const noopSubscribe = () => () => {};
const hasNfc = () => "NDEFReader" in window;
/** iOS gates DeviceOrientation behind a permission prompt that needs a tap. */
const tiltNeedsPermission = () =>
  window.matchMedia("(pointer: coarse)").matches &&
  typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown } | undefined)?.requestPermission === "function";
const serverFalse = () => false;

function serial(handle: string) {
  let h = 2166136261;
  for (const ch of handle) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 6);
}

/**
 * The Proof Pass: a holographic wallet-style credential with the branded QR. Tilts with the
 * pointer (or the phone's orientation), a foil sheen tracks the tilt, a laser sweeps the QR and
 * the modules assemble from scattered dots the first time the card scrolls into view. Reduced
 * motion gets a static card.
 */
export function ProofPass(props: ProofPassProps) {
  const { name, handle, score, sealCount, skills, college, url, passUrl, qrSvg, passImage } = props;
  const reduce = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [stamp, setStamp] = useState(0);
  const nfc = useSyncExternalStore(noopSubscribe, hasNfc, serverFalse);
  const askTilt = useSyncExternalStore(noopSubscribe, tiltNeedsPermission, serverFalse);
  const [tiltOn, setTiltOn] = useState(false);
  const needsTiltPermission = askTilt && !tiltOn;

  const title = `${name} on Proof`;
  const text = `${name}'s verified dossier on Proof: ${sealCount} sealed items, Proof Score ${score}.`;
  const enc = encodeURIComponent;

  // Hide the modules before first paint when the card starts off-screen, then assemble on view.
  useLayoutEffect(() => {
    const el = qrRef.current;
    if (!el || reduce) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return; // already visible: no flash
    el.dataset.assemble = "off";
  }, [reduce]);

  useEffect(() => {
    const el = qrRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        requestAnimationFrame(() => {
          if (el.dataset.assemble === "off") el.dataset.assemble = "on";
        });
        // Prefetch the pass PNG so native share can attach it inside the click's user activation.
        if (passImage && typeof navigator.canShare === "function") {
          fetch(passImage)
            .then((res) => (res.ok ? res.blob() : null))
            .then((blob) => {
              if (blob) fileRef.current = new File([blob], `proof-pass-${handle}.png`, { type: "image/png" });
            })
            .catch(() => {});
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [passImage, handle]);

  // Tilt: pointer on desktop, device orientation on touch screens.
  useEffect(() => {
    const scene = sceneRef.current;
    const card = cardRef.current;
    if (!scene || !card || reduce) return;
    let frame = 0;
    const apply = (px: number, py: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.style.setProperty("--ry", `${((px - 0.5) * 18).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - py) * 16).toFixed(2)}deg`);
        card.style.setProperty("--mx", px.toFixed(3));
        card.style.setProperty("--my", py.toFixed(3));
      });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = scene.getBoundingClientRect();
      card.dataset.live = "";
      apply(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
    };
    const onLeave = () => {
      delete card.dataset.live;
      apply(0.5, 0.5);
    };
    scene.addEventListener("pointermove", onMove);
    scene.addEventListener("pointerleave", onLeave);

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      card.dataset.live = "";
      const px = 0.5 + Math.max(-1, Math.min(1, e.gamma / 35)) / 2;
      const py = 0.5 + Math.max(-1, Math.min(1, (e.beta - 40) / 35)) / 2;
      apply(px, py);
    };
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (coarse && DOE) {
      if (typeof DOE.requestPermission !== "function" || tiltOn) window.addEventListener("deviceorientation", onOrient);
    }
    return () => {
      cancelAnimationFrame(frame);
      scene.removeEventListener("pointermove", onMove);
      scene.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [reduce, tiltOn]);

  async function enableTilt() {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    try {
      const res = await DOE.requestPermission?.();
      if (res === "granted") setTiltOn(true);
      else toast.error("Motion access was declined. The pass still works without tilt.");
    } catch {
      toast.error("Motion access is unavailable here.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setStamp((n) => n + 1);
      toast.success("Link copied", { description: url.replace(/^https?:\/\//, "") });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy. Select the link and copy it manually.");
    }
  }

  async function share() {
    const data: ShareData = { title, text, url };
    const file = fileRef.current;
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ ...data, files: [file] });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(data);
      } catch {
        /* dismissed */
      }
      return;
    }
    void copy();
  }

  async function writeNfc() {
    try {
      const Reader = (window as unknown as { NDEFReader: new () => NdefWriter }).NDEFReader;
      const writer = new Reader();
      toast("Hold the tag to the back of your phone", { description: "Writing your Proof Pass link…" });
      await writer.write({ records: [{ recordType: "url", data: passUrl }] });
      toast.success("NFC tag written", { description: "A tap now opens your verified dossier." });
    } catch (e) {
      toast.error((e as Error).name === "NotAllowedError" ? "NFC permission was declined." : "Could not write the tag. Try again, holding it still.");
    }
  }

  const ring = 2 * Math.PI * 21;
  const pct = Math.max(0, Math.min(100, score)) / 100;

  return (
    <div className="grid gap-4">
      <style href="proof-pass" precedence="default">
        {PASS_CSS}
      </style>

      <div ref={sceneRef} className="pp-scene">
        <div ref={cardRef} className="pp-card relative overflow-hidden rounded-[22px] bg-[#0b0c12] text-[#f3f0e8] shadow-[0_30px_60px_-30px_rgb(10_11_16/0.7),0_0_0_1px_rgb(255_255_255/0.08)_inset]">
          <div className="pp-mesh pointer-events-none absolute inset-0" aria-hidden />
          <div className="pp-foil pointer-events-none absolute inset-0" aria-hidden />

          <div className="pp-lift relative px-5 pt-5 pb-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 font-display text-[17px] font-bold tracking-tight">
                <SealGlyph className="size-5 -rotate-8 text-[#c6f432]" /> proof
              </span>
              <span className="font-mono text-[9.5px] tracking-[0.18em] text-[#a7a399] uppercase">Pass · No. {serial(handle)}</span>
            </div>

            <div className="mt-4 min-w-0">
              <p className="truncate font-display text-[1.55rem] leading-[1.05] font-semibold tracking-[-0.02em]">{name}</p>
              <p className="mt-1 truncate font-mono text-[12px] text-[#c6f432]">@{handle}</p>
              {college && (
                <p className="mt-1.5 flex items-center gap-1.5 truncate text-[12px] text-[#a7a399]">
                  <GraduationCap className="size-3.5 shrink-0" aria-hidden /> {college}
                </p>
              )}
            </div>

            <div className="relative mx-auto mt-4 w-[min(100%,15.5rem)]">
              <div className="pp-plate relative overflow-hidden rounded-2xl bg-[#fffdf8] p-2.5 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)]">
                <div
                  ref={qrRef}
                  className="pp-qr aspect-square [&_svg]:block [&_svg]:size-full"
                  role="img"
                  aria-label={`QR code linking to ${passUrl}`}
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <div className="pp-laser pointer-events-none absolute inset-x-2" aria-hidden />
              </div>
              <AnimatePresence>
                {stamp > 0 && copied && (
                  <motion.div
                    key={stamp}
                    className="pointer-events-none absolute -top-3 -right-3 grid size-[84px] place-items-center"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.3, rotate: -28 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -10 }}
                    exit={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
                    transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 520, damping: 22 }}
                    aria-hidden
                  >
                    <StampSeal text="LINK COPIED · PROOF · " />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="mt-2 text-center font-mono text-[9.5px] tracking-[0.16em] text-[#8d8981] uppercase">Scan to open the verified dossier</p>
          </div>

          {/* Perforation */}
          <div className="pp-lift relative flex items-center" aria-hidden>
            <span className="-ml-3 size-6 shrink-0 rounded-full bg-canvas" />
            <span className="mx-2 h-px flex-1 border-t border-dashed border-white/15" />
            <span className="-mr-3 size-6 shrink-0 rounded-full bg-canvas" />
          </div>

          <div className="pp-lift relative flex items-center gap-4 px-5 pt-3 pb-5">
            <div className="relative grid size-[58px] shrink-0 place-items-center">
              <svg viewBox="0 0 50 50" className="absolute inset-0 size-full -rotate-90" role="img" aria-label={`Proof Score ${score} out of 100`}>
                <circle cx="25" cy="25" r="21" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="4" />
                <circle cx="25" cy="25" r="21" fill="none" stroke="#c6f432" strokeWidth="4" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - pct)} />
              </svg>
              <span className="font-display text-[17px] font-semibold tabular">{score}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[12.5px]">
                <SealGlyph className="size-3.5 text-[#c6f432]" />
                <span className="font-semibold tabular">{sealCount}</span>
                <span className="text-[#a7a399]">{sealCount === 1 ? "seal" : "seals"} · Proof Score</span>
              </p>
              {skills.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Top verified skills">
                  {skills.map((s) => (
                    <li key={s} className="rounded-full border border-[#c6f432]/40 px-2 py-0.5 text-[11px] leading-tight text-[#c6f432]">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="pp-glare pointer-events-none absolute inset-0" aria-hidden />
        </div>
      </div>

      {needsTiltPermission && !reduce && (
        <button type="button" onClick={enableTilt} className="mx-auto flex items-center gap-1.5 text-[12px] text-violet-text underline-offset-4 hover:underline">
          <Smartphone className="size-3.5" aria-hidden /> Tilt the pass with your phone
        </button>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Action onClick={copy} label="Copy link" primary>
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Action>
        <Action onClick={share} label="Share pass">
          <Share2 /> Share
        </Action>
        {passImage ? (
          <a href={passImage} download={`proof-pass-${handle}.png`} aria-label="Download pass as PNG" className={actionClass()}>
            <Download /> Save
          </a>
        ) : (
          <Action onClick={copy} label="Copy link (pass image needs a public dossier)" disabled>
            <Download /> Save
          </Action>
        )}
        <a href={`https://wa.me/?text=${enc(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" className={actionClass()}>
          <MessageCircle /> WhatsApp
        </a>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" className={actionClass()}>
          <LinkedInGlyph /> LinkedIn
        </a>
        <a href={`https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X" className={actionClass()}>
          <XGlyph /> Post
        </a>
        {nfc && (
          <Action onClick={writeNfc} label="Write pass link to an NFC tag" className="col-span-3">
            <Nfc /> Write to NFC tag
          </Action>
        )}
      </div>
      <p className="truncate text-center font-mono text-[11.5px] text-subtle" title={url}>
        {url.replace(/^https?:\/\//, "")}
      </p>
    </div>
  );
}

function actionClass(primary = false) {
  return cn(
    "inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-violet sm:h-10 [&_svg]:size-4 [&_svg]:shrink-0",
    primary
      ? "bg-lime text-lime-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)] hover:brightness-[1.04]"
      : "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  );
}

function Action({ children, onClick, label, primary, disabled, className }: { children: ReactNode; onClick: () => void; label: string; primary?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled} className={cn(actionClass(primary), "disabled:opacity-45", className)}>
      {children}
    </button>
  );
}

function StampSeal({ text }: { text: string }) {
  const id = "pp-stamp-arc";
  return (
    <svg viewBox="0 0 100 100" className="size-full drop-shadow-[0_6px_14px_rgb(0_0_0/0.35)]">
      <defs>
        <path id={id} d="M50 50m-33 0a33 33 0 1 1 66 0a33 33 0 1 1 -66 0" />
      </defs>
      <circle cx="50" cy="50" r="47" fill="#c6f432" />
      <circle cx="50" cy="50" r="43" fill="none" stroke="#0a0b10" strokeWidth="1.6" />
      <circle cx="50" cy="50" r="24" fill="none" stroke="#0a0b10" strokeWidth="1.6" />
      <text fontSize="9.2" fontFamily="var(--font-mono)" fontWeight="700" letterSpacing="1.2" fill="#0a0b10">
        <textPath href={`#${id}`}>{text}</textPath>
      </text>
      <path d="M39 51l8 8 15-16" fill="none" stroke="#0a0b10" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LinkedInGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z" />
    </svg>
  );
}
