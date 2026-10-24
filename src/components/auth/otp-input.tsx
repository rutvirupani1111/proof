"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Six single-digit boxes for a one-time code.
 * - Autofocuses the first empty box; typing advances, Backspace steps back, arrows move.
 * - Pasting anywhere fills every box ("123 456", "123-456" are fine); `autocomplete="one-time-code"`
 *   lets iOS / Android offer the code from the email or SMS.
 * - Calls `onComplete` once all boxes are filled.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus = true,
  idPrefix = "otp",
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  idPrefix?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (!autoFocus || disabled) return;
    refs.current[Math.min(value.length, length - 1)]?.focus();
    // Only on mount / when re-enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled]);

  function set(next: string, focusIndex: number) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    refs.current[Math.min(focusIndex, length - 1)]?.focus();
    if (clean.length === length) onComplete?.(clean);
  }

  function onInput(i: number, raw: string) {
    const d = raw.replace(/\D/g, "");
    if (!d) return;
    if (d.length > 1) return set(value.slice(0, i) + d, i + d.length);
    const arr = digits.slice();
    arr[i] = d;
    set(arr.join("").slice(0, Math.max(value.length, i + 1)), i + 1);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) set(value.slice(0, i) + value.slice(i + 1), i);
      else if (i > 0) set(value.slice(0, i - 1) + value.slice(i), i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const d = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!d) return;
    e.preventDefault();
    set(d, d.length);
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label={`${length}-digit code`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          id={`${idPrefix}-${i}`}
          value={d}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="\d*"
          maxLength={length}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border bg-surface text-center font-mono text-2xl font-semibold text-ink transition-colors outline-none",
            "focus:border-violet focus:ring-2 focus:ring-violet/30 disabled:opacity-50",
            invalid ? "border-coral" : d ? "border-ink/40" : "border-line",
          )}
        />
      ))}
    </div>
  );
}
