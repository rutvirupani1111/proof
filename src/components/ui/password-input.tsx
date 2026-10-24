"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useRef, useState, type ComponentProps, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

type PasswordInputProps = Omit<ComponentProps<"input">, "type" | "ref"> & {
  /** `current-password` to sign in, `new-password` to create or change one. */
  autoComplete?: "current-password" | "new-password";
};

/**
 * Password field with a show / hide toggle and a Caps Lock hint.
 *
 * - The toggle is `type="button"`, so it never submits the form, and carries `aria-pressed` plus
 *   an "Show password" / "Hide password" label.
 * - Pressing it with a mouse or finger does not steal focus (pointerdown is cancelled), and the
 *   caret / selection is restored after the input type flips, so typing just continues.
 * - Keyboard users can Tab to it and press Enter or Space; focus then stays on the button.
 */
export function PasswordInput({
  className,
  autoComplete = "current-password",
  id,
  onKeyDown,
  onKeyUp,
  onBlur,
  ...props
}: PasswordInputProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  function toggle() {
    const el = inputRef.current;
    const focused = !!el && document.activeElement === el;
    const start = el?.selectionStart ?? null;
    const end = el?.selectionEnd ?? null;
    setVisible((v) => !v);
    if (!el || !focused) return;
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true });
      if (start != null && end != null) el.setSelectionRange(start, end);
    });
  }

  function readCaps(e: KeyboardEvent<HTMLInputElement>) {
    if (typeof e.getModifierState === "function") setCapsLock(e.getModifierState("CapsLock"));
  }

  const capsId = `${inputId}-caps`;
  const describedBy = [props["aria-describedby"], capsLock ? capsId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Input
          {...props}
          ref={inputRef}
          id={inputId}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={describedBy}
          className={cn("pr-11", className)}
          onKeyDown={(e) => {
            readCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            readCaps(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsLock(false);
            onBlur?.(e);
          }}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={inputId}
          title={visible ? "Hide password" : "Show password"}
          onPointerDown={(e) => e.preventDefault()}
          onClick={toggle}
          disabled={props.disabled}
          className="absolute inset-y-0 right-0 grid w-11 min-w-0 touch-manipulation place-items-center rounded-r-xl text-subtle transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-violet disabled:opacity-60"
        >
          {visible ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
        </button>
      </div>
      {capsLock && (
        <p id={capsId} role="status" className="text-xs font-medium text-coral-text">
          Caps Lock is on.
        </p>
      )}
    </div>
  );
}
