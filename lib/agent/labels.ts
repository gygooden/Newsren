import type { SourceRecord } from "./types";

// Claim status labels. Each label is shown as text, never as color alone.

export const FINANCE_STATUSES = [
  "Announcement",
  "Pilot",
  "Backtest",
  "Live deployment",
  "Regulatory finding",
] as const;
export type FinanceStatus = (typeof FINANCE_STATUSES)[number];

const FINANCE_PATTERNS: [FinanceStatus, RegExp][] = [
  ["Regulatory finding", /\b(final rule|proposed rule|enforcement|order|finding|examination|regulator)\b/i],
  ["Backtest", /\b(backtest|back-test|historical data|simulated)\b/i],
  ["Pilot", /\b(pilot|trial|test program|limited rollout)\b/i],
  ["Live deployment", /\b(in production|now uses|deployed|live for all|rolled out to all)\b/i],
  ["Announcement", /\b(announce|plans to|will launch|intends to)\b/i],
];

export function financeStatus(text: string, source?: SourceRecord): FinanceStatus | undefined {
  if (source?.kind === "federal-register") return "Regulatory finding";
  for (const [label, re] of FINANCE_PATTERNS) if (re.test(text)) return label;
  return undefined;
}

const HEDGES = /\b(may|might|could|would|possibly|potentially|expected to|likely|hypothes\w*|projected|forecast\w*)\b/i;
const FORECAST = /\b(will (rise|fall|grow|increase|decrease|reach)|projected|projection|forecast\w*|by 20\d\d|expected to)\b/i;

export function impactLabel(text: string, independentSources: number, source?: SourceRecord): "Supported" | "Speculative" {
  if (HEDGES.test(text)) return "Speculative";
  if (source && source.recordType === "document") return "Supported";
  return independentSources >= 1 ? "Supported" : "Speculative";
}

export function researchLabel(source: SourceRecord): "Preprint, not peer reviewed" | "Peer reviewed" | undefined {
  if (source.kind === "arxiv") return "Preprint, not peer reviewed";
  if (source.recordType === "study") return source.peerReviewed ? "Peer reviewed" : "Preprint, not peer reviewed";
  return undefined;
}

export function isForecast(text: string): boolean {
  return FORECAST.test(text);
}

/** All labels for one verified claim. */
export function claimLabels(text: string, source: SourceRecord, independentSources: number): string[] {
  const labels: string[] = [impactLabel(text, independentSources, source)];
  const research = researchLabel(source);
  if (research) labels.push(research);
  if (source.section === "finance" || source.topics.includes("finance-regulation")) {
    const fs = financeStatus(text, source);
    if (fs) labels.push(fs);
  }
  if (isForecast(text)) labels.push("Projection");
  return labels;
}

const ADVICE = /\b(buy|sell|hold|short)\b[^.]{0,40}\b(stock|shares|position|security|securities|fund)\b|\bprice target\b|\byou should (invest|trade)\b|\bstrong buy\b/i;

export function looksLikeInvestmentAdvice(text: string): boolean {
  return ADVICE.test(text);
}
