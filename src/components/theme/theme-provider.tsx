"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { THEME_STORAGE_KEY } from "./theme-constants";

export type ThemePref = "light" | "dark" | "system";
type Resolved = "light" | "dark";

type Ctx = { theme: ThemePref; resolved: Resolved; setTheme: (t: ThemePref) => void };
const ThemeCtx = createContext<Ctx>({ theme: "system", resolved: "dark", setTheme: () => {} });

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): Resolved {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(resolved: Resolved) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readPref() === "system") apply(systemTheme());
    notify();
  };
  mq.addEventListener("change", onSystem);
  window.addEventListener("storage", onSystem);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onSystem);
  };
}

// Snapshot is a primitive string so React can compare it cheaply.
const getSnapshot = () => `${readPref()}|${document.documentElement.dataset.theme === "light" ? "light" : "dark"}`;
const getServerSnapshot = () => "system|dark";

/**
 * Theme state lives in localStorage + <html data-theme>. The inline ThemeScript sets it before
 * paint; this provider only reads and updates it, so there is never a flash.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [theme, resolved] = snapshot.split("|") as [ThemePref, Resolved];

  const setTheme = useCallback((t: ThemePref) => {
    try {
      if (t === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {}
    apply(t === "system" ? systemTheme() : t);
    notify();
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
