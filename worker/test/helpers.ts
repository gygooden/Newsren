import type Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "../../lib/agent/orchestrator";
import type { Env } from "../src/index";

export function message(content: Anthropic.ContentBlock[], usage = { input: 500, output: 100 }): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "test-model",
    content,
    stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: usage.input, output_tokens: usage.output },
  } as unknown as Anthropic.Message;
}

let n = 0;
export function toolUse(name: string, input: Record<string, unknown>): Anthropic.ContentBlock {
  n++;
  return { type: "tool_use", id: `toolu_${n}`, name, input } as unknown as Anthropic.ContentBlock;
}

/** A model that replies with the given function on every call. */
export function scriptedClient(reply: (call: number) => Anthropic.Message | Promise<Anthropic.Message>): ModelClient & { calls: number } {
  const client = {
    calls: 0,
    messages: {
      create: async () => {
        client.calls++;
        return reply(client.calls);
      },
    },
  };
  return client;
}

export class MemoryKV {
  store = new Map<string, string>();
  ttls = new Map<string, number | undefined>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string, opts?: { expirationTtl?: number }) {
    this.store.set(key, value);
    this.ttls.set(key, opts?.expirationTtl);
  }
}

export function testEnv(kv = new MemoryKV()): Env {
  return {
    ANTHROPIC_API_KEY: "test-key-not-real",
    ALLOWED_ORIGIN: "https://example.github.io,http://localhost:3000",
    DAILY_GLOBAL_LIMIT: "50",
    DAILY_PER_VISITOR_LIMIT: "3",
    RATE_LIMIT_SALT: "test-salt",
    LIMITS: kv as unknown as KVNamespace,
  };
}

/** fetch stub: no network in tests. */
export const noNetwork = async (): Promise<Response> => new Response(JSON.stringify({ results: [] }), { status: 200 });
