// Original inline SVG icons. Decorative icons are hidden from assistive technology.

import type { ReactNode } from "react";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** The brand mark: a receipt with a torn bottom edge. */
export function MarkIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path d="M5 2h18v22l-3-2-3 2-3-2-3 2-3-2-3 2z" fill="#ffe27a" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <line x1="9" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="12.5" x2="19" y2="12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="17" x2="14" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DocumentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" style={{ verticalAlign: "-2px", marginRight: 4 }}>
      <path d="M3 1h7l3 3v11H3z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5" y1="10" x2="11" y2="10" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** A flask, for AI research. */
export function ResearchIcon() {
  return (
    <Icon>
      <path {...STROKE} d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
      <path {...STROKE} d="M7.5 15h9" />
    </Icon>
  );
}

/** A schoolhouse, for schools. */
export function SchoolIcon() {
  return (
    <Icon>
      <path {...STROKE} d="M3 10l9-6 9 6M5 9v11h14V9" />
      <path {...STROKE} d="M10 20v-5h4v5" />
    </Icon>
  );
}

/** A briefcase, for jobs. */
export function JobsIcon() {
  return (
    <Icon>
      <rect {...STROKE} x="3" y="7" width="18" height="13" rx="2" />
      <path {...STROKE} d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" />
    </Icon>
  );
}

/** A coin stack, for money. */
export function MoneyIcon() {
  return (
    <Icon>
      <ellipse {...STROKE} cx="12" cy="6" rx="7" ry="3" />
      <path {...STROKE} d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </Icon>
  );
}
