import type Anthropic from "@anthropic-ai/sdk";
import { LIMITS, estimateCostUsd, type Limits } from "./limits";
import { searchArxiv, searchFederalRegister, searchLocal, type FetchLike } from "./sources";
import { COUNTY_IDS, type CountyId, type SourceRecord, type Submission, type TraceStep, type Usage, type Watch } from "./types";
import { outletOf, sourceLabel, truncate } from "./util";

// The live agent loop. The model plans its own research by calling tools
// until it calls submit_briefing or reaches a limit. Every limit is enforced
// here, in code, not by the prompt.

export const GOAL = "Produce a grounded personal briefing for this watch.";

export const SYSTEM_PROMPT = `You are the research agent for My Newsren, a news service whose product is human journalism and primary documents. Your goal: ${GOAL}

Rules:
- You never write news stories. You find, link, verify and explain existing reporting and documents.
- You may only state claims supported by text you retrieved with your tools in this run.
- For every claim, copy the exact supporting span from the source as "quote" and give its sourceId. Quotes must be verbatim.
- Report anything you looked for but could not find in "couldNotFind".
- Never give investment advice: no buy, sell or hold calls, no price targets.
- Never describe a source as biased. If sources disagree, list both positions with quotes.
- Sample local records are fictional demo data; describe them as sample data.
- "whyItMatters" explains relevance at the reader's depth (student, educator or professional). Add no facts or figures there.
- You have a small budget: at most 6 steps and 8 tool calls. Search briefly, then call submit_briefing.`;

const sourceIdList = { type: "string", description: "A sourceId returned by a search tool in this run." } as const;
const quoteRef = {
  type: "object",
  properties: { sourceId: sourceIdList, quote: { type: "string" } },
  required: ["sourceId", "quote"],
} as const;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_federal_register",
    description: "Search Federal Register rules, proposed rules and notices. Returns up to 8 documents with sourceIds.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search terms, for example 'artificial intelligence hiring'." },
        agencies: { type: "array", items: { type: "string" }, description: "Optional agency slugs, e.g. securities-and-exchange-commission, education-department." },
        since: { type: "string", description: "Optional YYYY-MM-DD lower bound on publication date." },
      },
      required: ["query"],
    },
  },
  {
    name: "search_arxiv",
    description: "Search arXiv preprints (not peer reviewed). Returns up to 8 papers with sourceIds.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        categories: { type: "array", items: { type: "string" }, description: "Optional: cs.AI, cs.CL, cs.CY, econ.GN, q-fin.GN" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_local",
    description: "Search bundled sample local news and local documents for a county. All results are fictional sample data.",
    input_schema: {
      type: "object",
      properties: { county: { type: "string", enum: [...COUNTY_IDS] }, query: { type: "string" } },
      required: ["county", "query"],
    },
  },
  {
    name: "get_document",
    description: "Return the full stored text of an item already retrieved in this run.",
    input_schema: { type: "object", properties: { sourceId: sourceIdList }, required: ["sourceId"] },
  },
  {
    name: "submit_briefing",
    description: "Submit the final briefing. Every claim needs a verbatim quote and the sourceId it came from.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sourceId: sourceIdList,
              claims: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    quote: { type: "string" },
                    sourceId: sourceIdList,
                    corroboration: { type: "array", items: quoteRef },
                  },
                  required: ["text", "quote", "sourceId"],
                },
              },
              whyItMatters: { type: "string" },
              labels: { type: "array", items: { type: "string" } },
              nextQuestions: {
                type: "array",
                items: { type: "object", properties: { question: { type: "string" }, sourceId: sourceIdList }, required: ["question", "sourceId"] },
              },
              disagreements: {
                type: "array",
                items: {
                  type: "object",
                  properties: { about: { type: "string" }, positions: { type: "array", items: quoteRef } },
                  required: ["about", "positions"],
                },
              },
            },
            required: ["sourceId", "claims", "whyItMatters"],
          },
        },
        couldNotFind: { type: "array", items: { type: "string" } },
      },
      required: ["items"],
    },
  },
];

export interface ModelClient {
  messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming, options?: { signal?: AbortSignal }): Promise<Anthropic.Message>;
  };
}

export type AgentEvent = { type: "step"; label: string };

export interface RunOptions {
  watch: Watch;
  question?: string;
  client: ModelClient;
  model: string;
  fetchImpl: FetchLike;
  localRecords: SourceRecord[];
  onEvent?: (e: AgentEvent) => void;
  limits?: Partial<Limits>;
  arxivThrottle?: boolean;
  now?: () => number;
}

export interface RunResult {
  submission: Submission | null;
  retrieved: Map<string, SourceRecord>;
  trace: TraceStep[];
  usage: Usage;
}

const TOOL_LABELS: Record<string, string> = {
  search_federal_register: "Searching Federal Register",
  search_arxiv: "Searching arXiv",
  search_local: "Searching sample local news",
  get_document: "Reading a retrieved document",
  submit_briefing: "Submitting briefing for verification",
};

function summarize(r: SourceRecord) {
  return {
    sourceId: r.id,
    label: sourceLabel(r),
    outlet: outletOf(r),
    author: r.provenance.author,
    title: r.title,
    date: r.provenance.publishedAt,
    docType: r.docType,
    excerpt: truncate(r.excerpt, 400),
  };
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
}

export async function runAgent(opts: RunOptions): Promise<RunResult> {
  const limits: Limits = { ...LIMITS, ...opts.limits };
  const now = opts.now ?? Date.now;
  const started = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
  const retrieved = new Map<string, SourceRecord>();
  const trace: TraceStep[] = [];
  let steps = 0;
  let toolCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let submission: Submission | null = null;
  let stopReason = "";
  const emit = (label: string) => opts.onEvent?.({ type: "step", label });

  const remember = (records: SourceRecord[]) => {
    for (const r of records) retrieved.set(r.id, r);
    return records;
  };

  async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "search_federal_register":
        return remember(
          await searchFederalRegister(
            { query: str(input.query, 120), agencies: strList(input.agencies), since: str(input.since, 10) || undefined },
            opts.fetchImpl,
            controller.signal,
          ),
        ).map(summarize);
      case "search_arxiv":
        return remember(
          await searchArxiv({ query: str(input.query, 120), categories: strList(input.categories) }, opts.fetchImpl, controller.signal, opts.arxivThrottle ?? true),
        ).map(summarize);
      case "search_local": {
        const county = str(input.county, 40) as CountyId;
        if (!COUNTY_IDS.includes(county)) throw new Error("Unknown county.");
        return remember(searchLocal(opts.localRecords, county, str(input.query, 120))).map(summarize);
      }
      case "get_document": {
        const r = retrieved.get(str(input.sourceId, 120));
        if (!r) throw new Error("That sourceId has not been retrieved in this run.");
        return { ...summarize(r), text: truncate(r.text, 3000), url: r.provenance.sourceUrl };
      }
      default:
        throw new Error(`Unknown tool ${name}`);
    }
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: JSON.stringify({
        goal: GOAL,
        watch: opts.watch,
        question: opts.question ?? null,
        today: new Date(started).toISOString().slice(0, 10),
      }),
    },
  ];

  try {
    while (!submission) {
      if (steps >= limits.maxSteps) { stopReason = "step limit reached"; break; }
      if (toolCalls >= limits.maxToolCalls) { stopReason = "tool call limit reached"; break; }
      if (inputTokens + outputTokens + limits.maxTokensPerCall > limits.tokenBudgetPerRun) { stopReason = "token budget reached"; break; }
      if (now() - started >= limits.timeoutMs || controller.signal.aborted) { stopReason = "time limit reached"; break; }

      steps++;
      emit(steps === 1 ? "Planning research" : "Reviewing results");
      const response = await opts.client.messages.create(
        {
          model: opts.model,
          max_tokens: limits.maxTokensPerCall,
          // Thinking off keeps each call inside the small per-call cap.
          thinking: { type: "disabled" },
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          tool_choice: { type: "auto" },
          messages,
        },
        { signal: controller.signal },
      );
      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;
      trace.push({ step: steps, kind: "model", inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, note: response.stop_reason ?? undefined });
      messages.push({ role: "assistant", content: response.content });

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!toolUses.length) { stopReason = response.stop_reason === "refusal" ? "model declined" : "model ended without submitting"; break; }
      if (inputTokens + outputTokens >= limits.tokenBudgetPerRun) { stopReason = "token budget reached"; break; }

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        if (toolCalls >= limits.maxToolCalls) {
          results.push({ type: "tool_result", tool_use_id: tu.id, content: "Tool call limit reached.", is_error: true });
          continue;
        }
        toolCalls++;
        const input = (tu.input ?? {}) as Record<string, unknown>;
        emit(TOOL_LABELS[tu.name] ?? `Running ${tu.name}`);
        if (tu.name === "submit_briefing") {
          submission = { items: Array.isArray(input.items) ? (input.items as Submission["items"]) : [], couldNotFind: strList(input.couldNotFind) };
          trace.push({ step: steps, kind: "tool", tool: tu.name, resultCount: submission.items.length });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: "Received." });
          continue;
        }
        try {
          const result = await executeTool(tu.name, input);
          const count = Array.isArray(result) ? result.length : 1;
          trace.push({ step: steps, kind: "tool", tool: tu.name, args: input, resultCount: count });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
        } catch (err) {
          trace.push({ step: steps, kind: "tool", tool: tu.name, args: input, resultCount: 0, note: "error" });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: err instanceof Error ? err.message : "Tool failed.", is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    if (submission) stopReason = "submitted";
  } catch {
    // The trace and usage so far are still returned; the caller shows the saved briefing context.
    stopReason = controller.signal.aborted ? "time limit reached" : "model or tool error";
  } finally {
    clearTimeout(timer);
  }

  emit("Verifying quotes against retrieved text");
  return {
    submission,
    retrieved,
    trace,
    usage: {
      steps,
      toolCalls,
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens),
      stopReason,
      elapsedMs: now() - started,
    },
  };
}
