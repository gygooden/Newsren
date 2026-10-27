"use client";

import type { Briefing, RunRecord, TraceStep, Usage, Watch } from "../agent/types";

// The only network calls the site makes. They run when the reader presses
// "Run live research" or submits a question, and go only to the Worker.

export const AGENT_URL = (process.env.NEXT_PUBLIC_AGENT_URL ?? "").replace(/\/$/, "");
export const LIMIT_FALLBACK_MESSAGE =
  "Today's live research limit has been reached. Showing the most recent saved briefing.";

export interface LiveResult {
  briefing: Briefing;
  trace: TraceStep[];
  usage: Usage;
  remaining: number;
  run: RunRecord;
}

export type LiveOutcome =
  | { kind: "ok"; result: LiveResult }
  | { kind: "limit"; message: string }
  | { kind: "error"; message: string };

export async function runLive(
  path: "/run" | "/ask",
  body: { watch: Watch; question?: string },
  onStep: (label: string) => void,
): Promise<LiveOutcome> {
  if (!AGENT_URL) return { kind: "error", message: "Live research is not configured for this site. Showing the saved briefing." };
  let res: Response;
  try {
    res = await fetch(`${AGENT_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "error", message: "Could not reach the research service. Showing the saved briefing." };
  }
  if (res.status === 429) return { kind: "limit", message: LIMIT_FALLBACK_MESSAGE };
  if (!res.ok || !res.body) {
    let message = "The research service returned an error. Showing the saved briefing.";
    try {
      const data = (await res.json()) as { message?: string };
      if (res.status === 400 && data.message) message = data.message;
    } catch {
      // keep the default message
    }
    return { kind: "error", message };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: LiveResult | null = null;
  let failure: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as { type: string; label?: string; message?: string } & Partial<LiveResult>;
      if (msg.type === "step" && msg.label) onStep(msg.label);
      if (msg.type === "result") result = msg as unknown as LiveResult;
      if (msg.type === "error") failure = msg.message ?? "The live run failed.";
    }
    if (done) break;
  }
  if (result) return { kind: "ok", result };
  return { kind: "error", message: failure ?? "The live run ended without a result. Showing the saved briefing." };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
