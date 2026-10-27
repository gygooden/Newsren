import { describe, expect, it } from "vitest";
import { createHandler, LIMIT_MESSAGE } from "../src/index";
import { MemoryKV, message, noNetwork, scriptedClient, testEnv, toolUse } from "./helpers";

const watch = { topics: ["labor"], organizations: "", questions: "", depth: "student", county: "santa-clara-ca" };
const ORIGIN = "https://example.github.io";

function handlerWith() {
  const client = scriptedClient(() => message([toolUse("submit_briefing", { items: [] })]));
  return createHandler({ createClient: () => client, fetchImpl: noNetwork, now: () => Date.parse("2026-10-27T12:00:00Z"), arxivThrottle: false });
}

function post(path: string, body: unknown, origin = ORIGIN, ip = "203.0.113.7") {
  return new Request(`https://agent.example${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify(body),
  });
}

describe("worker gatekeeping", () => {
  it("rejects a disallowed origin", async () => {
    const res = await handlerWith()(post("/run", { watch }, "https://evil.example"), testEnv());
    expect(res.status).toBe(403);
  });

  it("answers CORS preflight for an allowed origin", async () => {
    const req = new Request("https://agent.example/run", { method: "OPTIONS", headers: { Origin: ORIGIN } });
    const res = await handlerWith()(req, testEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("accepts POST only", async () => {
    const req = new Request("https://agent.example/run", { method: "GET", headers: { Origin: ORIGIN } });
    expect((await handlerWith()(req, testEnv())).status).toBe(405);
  });

  it("rejects topics outside the allowlist and long questions", async () => {
    const h = handlerWith();
    expect((await h(post("/run", { watch: { ...watch, topics: ["crypto"] } }), testEnv())).status).toBe(400);
    expect((await h(post("/ask", { watch, question: "x".repeat(301) }), testEnv())).status).toBe(400);
    expect((await h(post("/run", { watch: { ...watch, county: "atlantis" } }), testEnv())).status).toBe(400);
  });

  it("returns 429 after the per-visitor limit and stores only a hash with a 24-hour TTL", async () => {
    const kv = new MemoryKV();
    const env = testEnv(kv);
    const h = handlerWith();
    for (let i = 0; i < 3; i++) {
      const res = await h(post("/run", { watch }), env);
      expect(res.status).toBe(200);
      await res.text();
    }
    const blocked = await h(post("/run", { watch }), env);
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as { message: string }).message).toBe(LIMIT_MESSAGE);

    const keys = [...kv.store.keys()];
    expect(keys.some((k) => k.includes("203.0.113.7"))).toBe(false);
    expect(keys.find((k) => k.startsWith("v:"))).toMatch(/^v:[0-9a-f]{64}$/);
    expect([...kv.ttls.values()].every((t) => t === 86400)).toBe(true);

    // A different visitor is still allowed.
    const other = await h(post("/run", { watch }, ORIGIN, "198.51.100.2"), env);
    expect(other.status).toBe(200);
  });

  it("returns 429 when the global daily limit is reached", async () => {
    const kv = new MemoryKV();
    await kv.put("g:2026-10-27", "50");
    const res = await handlerWith()(post("/run", { watch }), testEnv(kv));
    expect(res.status).toBe(429);
  });

  it("streams steps and a verified result", async () => {
    const res = await handlerWith()(post("/run", { watch }), testEnv());
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as { type: string; remaining?: number });
    expect(lines.some((l) => l.type === "step")).toBe(true);
    const result = lines.find((l) => l.type === "result");
    expect(result?.remaining).toBe(2);
  });
});
