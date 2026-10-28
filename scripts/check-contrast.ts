// Checks WCAG 2.2 contrast ratios for the palette defined in app/globals.css.
// Uses the WCAG relative-luminance formula. Exits non-zero on any failure.

import { readFileSync } from "node:fs";

const css = readFileSync("app/globals.css", "utf8");
const root = css.match(/:root\s*{([\s\S]*?)}/)?.[1] ?? "";
const vars = Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [foreground, background, minimum, purpose]
const CHECKS: [string, string, number, string][] = [
  ["color-text", "color-bg", 4.5, "Body text"],
  ["color-text", "color-surface", 4.5, "Text on notice panels"],
  ["color-muted", "color-bg", 4.5, "Muted text"],
  ["color-muted", "color-surface", 4.5, "Muted text on notice panels"],
  ["color-text", "color-card", 4.5, "Text on cards"],
  ["color-muted", "color-card", 4.5, "Muted text on cards"],
  ["color-accent", "color-card", 4.5, "Links on cards"],
  ["color-text", "color-highlight", 4.5, "Highlighted text and step numbers"],
  ["color-border", "color-card", 3, "Control borders on cards (UI component)"],
  ["color-accent", "color-bg", 4.5, "Links and accent text"],
  ["color-accent", "color-surface", 4.5, "Links on notice panels"],
  ["color-reported", "color-bg", 4.5, "Reported label text"],
  ["color-unreported", "color-bg", 4.5, "Not yet reported label text"],
  ["color-error", "color-bg", 4.5, "Error messages"],
  ["color-focus", "color-bg", 3, "Focus ring (UI component)"],
  ["color-border", "color-bg", 3, "Form control borders (UI component)"],
  ["color-unreported", "color-surface", 3, "Notice accent border"],
];

let failed = 0;
console.log("Contrast check (WCAG 2.2 AA)\n");
for (const [fg, bg, min, purpose] of CHECKS) {
  if (!vars[fg] || !vars[bg]) {
    console.log(`MISSING  --${fg} or --${bg}`);
    failed++;
    continue;
  }
  const ratio = contrast(vars[fg], vars[bg]);
  const ok = ratio >= min;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${ratio.toFixed(2)}:1 (min ${min}:1)  ${purpose}: ${vars[fg]} on ${vars[bg]}`);
}
// Primary button: white text on the accent color.
const button = contrast("#ffffff", vars["color-accent"]);
if (button < 4.5) failed++;
console.log(`${button >= 4.5 ? "PASS" : "FAIL"}  ${button.toFixed(2)}:1 (min 4.5:1)  Button text: #ffffff on ${vars["color-accent"]}`);

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
