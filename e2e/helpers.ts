import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const briefings = JSON.parse(readFileSync("data/generated/briefings.json", "utf8")) as { briefings: { briefing: object }[] };

export const AGENT = "http://localhost:8787";

/** A mocked Worker response: NDJSON steps followed by a result. No real model is called. */
export function mockWorkerOk(page: Page) {
  const briefing = { ...briefings.briefings[0].briefing, mode: "live", id: "live-test" };
  const usage = { steps: 3, toolCalls: 4, inputTokens: 4200, outputTokens: 900, estimatedCostUsd: 0.00087, stopReason: "submitted", elapsedMs: 9000 };
  const trace = [{ step: 1, kind: "model", inputTokens: 1200, outputTokens: 200 }, { step: 1, kind: "tool", tool: "search_local", args: { county: "santa-clara-ca", query: "layoffs" }, resultCount: 5 }];
  const body =
    [
      { type: "step", label: "Planning research" },
      { type: "step", label: "Searching sample local news" },
      { type: "step", label: "Searching Federal Register" },
      { type: "step", label: "Verifying quotes against retrieved text" },
      { type: "result", briefing, trace, usage, remaining: 2, run: { id: "live-test", createdAt: "2026-10-27T00:00:00Z", model: "mock", watch: briefing, submission: null, retrieved: [], trace, usage } },
    ]
      .map((l) => JSON.stringify(l))
      .join("\n") + "\n";
  return page.route(`${AGENT}/**`, (route) =>
    route.fulfill({ status: 200, headers: { "Content-Type": "application/x-ndjson", "Access-Control-Allow-Origin": "*" }, body }),
  );
}

export function mockWorker429(page: Page) {
  return page.route(`${AGENT}/**`, (route) =>
    route.fulfill({
      status: 429,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "limit", message: "Today's live research limit has been reached." }),
    }),
  );
}

/** Press Tab until the focused element matches, failing after a bound. */
export async function tabTo(page: Page, predicate: string, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, predicate)) return;
  }
  throw new Error(`Could not reach ${predicate} with Tab`);
}
