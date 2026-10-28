"use client";

import type { Briefing, RunRecord, Watch } from "../agent/types";

// Everything the site remembers lives in this browser's localStorage.
// Every access is wrapped in try/catch: storage can be unavailable.

export const KEYS = {
  watch: "newsren.watch",
  queue: "newsren.reviewQueue",
  decisions: "newsren.reviewDecisions",
  alerts: "newsren.alerts",
  lastLive: "newsren.lastLiveBriefing",
  reacted: "newsren.communityReacted",
  role: "newsren.communityRole",
} as const;

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearAll(): boolean {
  try {
    for (const k of Object.values(KEYS)) window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export const loadWatch = () => readJson<Watch | null>(KEYS.watch, null);
export const saveWatch = (w: Watch) => writeJson(KEYS.watch, w);

export interface QueueEntry {
  briefing: Briefing;
  run?: RunRecord;
  submittedAt: string;
}

export interface Decision {
  id: string;
  decision: "approved" | "rejected";
  decidedAt: string;
  title: string;
}

export const loadQueue = () => readJson<QueueEntry[]>(KEYS.queue, []);
export function enqueue(entry: QueueEntry): boolean {
  const queue = loadQueue().filter((q) => q.briefing.id !== entry.briefing.id);
  return writeJson(KEYS.queue, [entry, ...queue].slice(0, 20));
}
export const loadDecisions = () => readJson<Decision[]>(KEYS.decisions, []);
