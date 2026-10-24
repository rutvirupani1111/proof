import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "./password-input";

describe("PasswordInput", () => {
  const html = renderToStaticMarkup(
    createElement(PasswordInput, { id: "pw", name: "password", autoComplete: "new-password", placeholder: "At least 8 characters" }),
  );

  it("starts masked with the right autocomplete", () => {
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('placeholder="At least 8 characters"');
  });

  it("has a non-submitting, labelled toggle", () => {
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-controls="pw"');
  });

  it("defaults to current-password", () => {
    expect(renderToStaticMarkup(createElement(PasswordInput, { id: "x" }))).toContain('autoComplete="current-password"');
  });
});

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("placeholder contrast", () => {
  // Placeholders use `placeholder:text-subtle` on `bg-surface` (src/components/ui/input.tsx).
  const css = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf8");
  const tokens = (name: string) => [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`, "g"))].map((m) => m[1]!);

  it("meets 4.5:1 against the field background in light and dark themes", () => {
    const subtle = tokens("subtle");
    const surface = tokens("surface");
    expect(subtle.length).toBeGreaterThanOrEqual(2);
    expect(surface.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < 2; i++) expect(contrast(subtle[i]!, surface[i]!)).toBeGreaterThanOrEqual(4.5);
  });
});
