import Anthropic from "@anthropic-ai/sdk";
import sampleRecords from "../../data/sample/local-news.json";
import { assembleBriefing } from "../../lib/agent/finalize";
import { DEFAULT_MODEL, LIMITS, type Limits } from "../../lib/agent/limits";
import { runAgent, type ModelClient } from "../../lib/agent/orchestrator";
import type { FetchLike } from "../../lib/agent/sources";
import { COUNTY_IDS, DEPTHS, TOPICS, type CountyId, type Depth, type RunRecord, type SourceRecord, type Topic, type Watch } from "../../lib/agent/types";
import { sha256Hex } from "../../lib/agent/util";
import { COMMUNITY_PATHS, handleCommunity } from "./community";

// The live research Worker. It never logs request bodies and stores only a
// salted daily hash of the visitor IP, which expires after 24 hours. It also
// serves the community pulse and moderated notes (see community.ts).

export interface Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL?: string;
  ALLOWED_ORIGIN: string;
  DAILY_GLOBAL_LIMIT?: string;
  DAILY_PER_VISITOR_LIMIT?: string;
  RATE_LIMIT_SALT?: string;
  MODERATOR_TOKEN?: string;
  LIMITS: KVNamespace;
}

export interface Deps {
  createClient: (env: Env) => ModelClient;
  fetchImpl: FetchLike;
  now: () => number;
  agentLimits?: Partial<Limits>;
  arxivThrottle?: boolean;
}

const LOCAL = sampleRecords as unknown as SourceRecord[];
const DAY_SECONDS = 24 * 60 * 60;
const MAX_BODY_BYTES = 4096;

export const LIMIT_MESSAGE = "Today's live research limit has been reached.";

class InputError extends Error {}

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGIN.split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

export function validateWatch(raw: unknown): Watch {
  if (!raw || typeof raw !== "object") throw new InputError("Missing watch.");
  const w = raw as Record<string, unknown>;
  const topics = Array.isArray(w.topics) ? w.topics : [];
  if (!topics.length || topics.length > TOPICS.length || !topics.every((t) => (TOPICS as readonly unknown[]).includes(t))) {
    throw new InputError("Choose at least one topic from the list.");
  }
  if (!(DEPTHS as readonly unknown[]).includes(w.depth)) throw new InputError("Choose a depth.");
  if (w.county !== undefined && w.county !== "" && !(COUNTY_IDS as readonly unknown[]).includes(w.county)) {
    throw new InputError("Choose a county from the list.");
  }
  const organizations = typeof w.organizations === "string" ? w.organizations : "";
  const questions = typeof w.questions === "string" ? w.questions : "";
  if (organizations.length > LIMITS.maxOrganizationsChars) throw new InputError(`Organizations must be at most ${LIMITS.maxOrganizationsChars} characters.`);
  if (questions.length > LIMITS.maxQuestionChars) throw new InputError(`Questions must be at most ${LIMITS.maxQuestionChars} characters.`);
  return {
    topics: [...new Set(topics as Topic[])],
    organizations,
    questions,
    depth: w.depth as Depth,
    county: w.county ? (w.county as CountyId) : undefined,
  };
}

export function validateQuestion(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) throw new InputError("Enter a question.");
  if (raw.length > LIMITS.maxQuestionChars) throw new InputError(`A question is at most ${LIMITS.maxQuestionChars} characters.`);
  return raw.trim();
}

function today(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

async function counters(env: Env, request: Request, now: number) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const date = today(now);
  // Only the hash is stored. The raw IP never leaves this function.
  const visitorKey = `v:${await sha256Hex(`${ip}|${date}|${env.RATE_LIMIT_SALT ?? "newsren"}`)}`;
  const globalKey = `g:${date}`;
  const [visitor, global] = await Promise.all([env.LIMITS.get(visitorKey), env.LIMITS.get(globalKey)]);
  return {
    visitorKey,
    globalKey,
    visitor: Number(visitor ?? 0),
    global: Number(global ?? 0),
    perVisitorLimit: Number(env.DAILY_PER_VISITOR_LIMIT ?? LIMITS.dailyPerVisitor),
    globalLimit: Number(env.DAILY_GLOBAL_LIMIT ?? LIMITS.dailyGlobal),
  };
}

export function createHandler(deps: Deps) {
  return async function handle(request: Request, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    const origin = (request.headers.get("Origin") ?? "").replace(/\/$/, "");
    if (!allowedOrigins(env).includes(origin)) return json({ error: "origin", message: "Origin not allowed." }, 403);
    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "method", message: "Use POST." }, 405, { ...cors, Allow: "POST, OPTIONS" });

    const path = new URL(request.url).pathname.replace(/\/$/, "");
    const community = COMMUNITY_PATHS.includes(path);
    if (!community && !["/run", "/ask", "/quota"].includes(path)) return json({ error: "not_found", message: "Unknown endpoint." }, 404, cors);
    if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) return json({ error: "input", message: "Request too large." }, 413, cors);

    if (community) {
      let body: Record<string, unknown>;
      try {
        const text = await request.text();
        if (text.length > MAX_BODY_BYTES) throw new InputError("Request too large.");
        const parsed: unknown = JSON.parse(text || "{}");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new InputError("Invalid request.");
        body = parsed as Record<string, unknown>;
      } catch {
        return json({ error: "input", message: "Invalid request." }, 400, cors);
      }
      const reply = await handleCommunity(path, body, env, request, deps.now());
      return json(reply.body, reply.status, { ...cors, "Cache-Control": "no-store" });
    }

    let watch: Watch;
    let question: string | undefined;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) throw new InputError("Request too large.");
      const body = JSON.parse(text || "{}") as { watch?: unknown; question?: unknown };
      watch = validateWatch(body.watch);
      if (path === "/ask") question = validateQuestion(body.question);
    } catch (err) {
      const message = err instanceof InputError ? err.message : "Invalid request.";
      return json({ error: "input", message }, 400, cors);
    }

    const now = deps.now();
    const c = await counters(env, request, now);
    if (path === "/quota") {
      return json({ remaining: Math.max(0, c.perVisitorLimit - c.visitor), globalRemaining: Math.max(0, c.globalLimit - c.global) }, 200, cors);
    }
    if (c.visitor >= c.perVisitorLimit || c.global >= c.globalLimit) {
      return json({ error: "limit", message: LIMIT_MESSAGE, remaining: 0 }, 429, cors);
    }
    // Reserve the run before starting it.
    await Promise.all([
      env.LIMITS.put(c.visitorKey, String(c.visitor + 1), { expirationTtl: DAY_SECONDS }),
      env.LIMITS.put(c.globalKey, String(c.global + 1), { expirationTtl: DAY_SECONDS }),
    ]);
    const remaining = Math.max(0, c.perVisitorLimit - c.visitor - 1);

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const send = (obj: unknown) => writer.write(encoder.encode(JSON.stringify(obj) + "\n"));

    const work = (async () => {
      try {
        const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
        const result = await runAgent({
          watch,
          question,
          client: deps.createClient(env),
          model,
          fetchImpl: deps.fetchImpl,
          localRecords: LOCAL,
          onEvent: (e) => void send(e),
          limits: deps.agentLimits,
          arxivThrottle: deps.arxivThrottle,
          now: deps.now,
        });
        const createdAt = new Date(deps.now()).toISOString();
        const id = `live-${await sha256Hex(`${createdAt}|${Math.random()}`).then((h) => h.slice(0, 12))}`;
        const submission = result.submission ?? { items: [], couldNotFind: [`The agent stopped (${result.usage.stopReason}) before submitting a briefing.`] };
        const { briefing } = assembleBriefing({
          id,
          watch,
          question,
          submission,
          retrieved: result.retrieved,
          corpus: LOCAL,
          mode: "live",
          createdAt,
          usage: result.usage,
        });
        const run: RunRecord = {
          id,
          createdAt,
          model,
          watch,
          question,
          submission: result.submission,
          retrieved: [...result.retrieved.values()],
          trace: result.trace,
          usage: result.usage,
        };
        await send({ type: "result", briefing, trace: result.trace, usage: result.usage, remaining, run });
      } catch {
        await send({ type: "error", message: "The live run failed. Showing the saved briefing instead." });
      } finally {
        await writer.close();
      }
    })();
    ctx?.waitUntil(work);

    return new Response(readable, {
      status: 200,
      headers: { ...cors, "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
    });
  };
}

const handler = createHandler({
  createClient: (env) => new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 }),
  fetchImpl: (input, init) => fetch(input, init),
  now: () => Date.now(),
});

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => handler(request, env, ctx),
};
