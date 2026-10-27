import { describe, expect, it } from "vitest";
import sample from "../../data/sample/local-news.json";
import { LIMITS } from "../../lib/agent/limits";
import { runAgent } from "../../lib/agent/orchestrator";
import type { SourceRecord, Watch } from "../../lib/agent/types";
import { message, noNetwork, scriptedClient, toolUse } from "./helpers";

const localRecords = sample as unknown as SourceRecord[];
const watch: Watch = { topics: ["labor"], organizations: "", questions: "", depth: "student", county: "santa-clara-ca" };
const base = { watch, model: "test-model", fetchImpl: noNetwork, localRecords, arxivThrottle: false };

describe("orchestrator limits", () => {
  it("stops at the step limit", async () => {
    const client = scriptedClient(() => message([toolUse("search_local", { county: "santa-clara-ca", query: "layoff" })]));
    const result = await runAgent({ ...base, client, limits: { maxToolCalls: 100 } });
    expect(client.calls).toBe(LIMITS.maxSteps);
    expect(result.usage.steps).toBe(6);
    expect(result.usage.stopReason).toBe("step limit reached");
    expect(result.submission).toBeNull();
  });

  it("stops at the tool-call limit", async () => {
    const three = () =>
      message([
        toolUse("search_local", { county: "santa-clara-ca", query: "layoff" }),
        toolUse("search_local", { county: "santa-clara-ca", query: "tutor" }),
        toolUse("search_local", { county: "santa-clara-ca", query: "hiring" }),
      ]);
    const client = scriptedClient(three);
    const result = await runAgent({ ...base, client });
    expect(result.usage.toolCalls).toBe(LIMITS.maxToolCalls);
    expect(result.usage.stopReason).toBe("tool call limit reached");
    expect(client.calls).toBe(3);
  });

  it("stops when the token budget is spent", async () => {
    const client = scriptedClient(() =>
      message([toolUse("search_local", { county: "santa-clara-ca", query: "layoff" })], { input: 11_000, output: 1_000 }),
    );
    const result = await runAgent({ ...base, client });
    expect(result.usage.inputTokens + result.usage.outputTokens).toBeLessThanOrEqual(LIMITS.tokenBudgetPerRun);
    expect(result.usage.stopReason).toBe("token budget reached");
    expect(client.calls).toBe(2);
  });

  it("stops at the wall-clock timeout", async () => {
    const client = {
      messages: {
        create: (_body: unknown, opts?: { signal?: AbortSignal }) =>
          new Promise<never>((_, reject) => opts?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
      },
    };
    const result = await runAgent({ ...base, client, limits: { timeoutMs: 50 } });
    expect(result.usage.stopReason).toBe("time limit reached");
  });

  it("uses the configured per-call max_tokens and finishes on submit_briefing", async () => {
    const seen: number[] = [];
    let call = 0;
    const client = {
      messages: {
        create: async (body: { max_tokens: number }) => {
          seen.push(body.max_tokens);
          call++;
          if (call === 1) return message([toolUse("search_local", { county: "santa-clara-ca", query: "Orchard" })]);
          return message([
            toolUse("submit_briefing", {
              items: [{ sourceId: "sc-warn-orchard", claims: [{ text: "x", quote: "reporting a layoff affecting 214 employees", sourceId: "sc-warn-orchard" }], whyItMatters: "" }],
            }),
          ]);
        },
      },
    };
    const result = await runAgent({ ...base, client: client as never });
    expect(seen.every((m) => m === LIMITS.maxTokensPerCall)).toBe(true);
    expect(result.usage.stopReason).toBe("submitted");
    expect(result.retrieved.has("sc-warn-orchard")).toBe(true);
  });
});
