import { describe, expect, it } from "vitest";
import { summarizePulse, validateNote } from "../../lib/community";
import { createHandler } from "../src/index";
import { MemoryKV, noNetwork, scriptedClient, testEnv } from "./helpers";

const ORIGIN = "https://example.github.io";
const TOKEN = "moderator-test-token";

function handler() {
  return createHandler({ createClient: () => scriptedClient(() => Promise.reject(new Error("unused"))), fetchImpl: noNetwork, now: () => Date.parse("2026-10-27T12:00:00Z") });
}

function env(kv = new MemoryKV()) {
  return { ...testEnv(kv), MODERATOR_TOKEN: TOKEN };
}

function post(path: string, body: unknown, ip = "203.0.113.7") {
  return new Request(`https://agent.example${path}`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify(body),
  });
}

const note = { story: "layoffs", text: "Two people on my street got the WARN letter last week.", role: "worker", county: "santa-clara-ca", name: "Dana" };

describe("community notes", () => {
  it("refuses links, emails, phone numbers and names without a county", () => {
    expect(() => validateNote({ ...note, text: "see www.example.com" })).toThrow(/links/);
    expect(() => validateNote({ ...note, text: "email me at a@b.co" })).toThrow(/email/);
    expect(() => validateNote({ ...note, text: "call 408 555 0199" })).toThrow(/phone/);
    expect(() => validateNote({ ...note, county: "" })).toThrow(/county/);
    expect(validateNote({ ...note, name: "" }).name).toBeUndefined();
  });

  it("holds notes until approved, then shows the name only to the same county", async () => {
    const h = handler();
    const e = env();
    expect((await h(post("/community/note", note), e)).status).toBe(200);

    const before = (await (await h(post("/community/read", { story: "layoffs" }), e)).json()) as { notes: unknown[] };
    expect(before.notes).toEqual([]);

    expect((await h(post("/community/pending", { token: "wrong-token-wrong-token" }), e)).status).toBe(401);
    const { pending } = (await (await h(post("/community/pending", { token: TOKEN }), e)).json()) as { pending: { id: string }[] };
    expect(pending).toHaveLength(1);
    expect((await h(post("/community/moderate", { token: TOKEN, id: pending[0].id, decision: "approve" }), e)).status).toBe(200);

    const local = (await (await h(post("/community/read", { story: "layoffs", viewerCounty: "santa-clara-ca" }), e)).json()) as { notes: { name?: string }[] };
    const other = (await (await h(post("/community/read", { story: "layoffs", viewerCounty: "stanislaus-ca" }), e)).json()) as { notes: { name?: string }[] };
    const none = (await (await h(post("/community/read", { story: "layoffs" }), e)).json()) as { notes: { name?: string }[] };
    expect(local.notes[0].name).toBe("Dana");
    expect(other.notes[0].name).toBeUndefined();
    expect(none.notes[0].name).toBeUndefined();
  });

  it("limits notes per visitor and stores no IP with the note", async () => {
    const kv = new MemoryKV();
    const h = handler();
    const e = env(kv);
    for (let i = 0; i < 3; i++) expect((await h(post("/community/note", note), e)).status).toBe(200);
    expect((await h(post("/community/note", note), e)).status).toBe(429);
    const stored = kv.store.get("pending") ?? "";
    expect(stored).not.toContain("203.0.113.7");
    expect([...kv.store.keys()].join(" ")).not.toContain("203.0.113.7");
  });

  it("counts each reaction once per visitor per day and summarizes by role and county", async () => {
    const h = handler();
    const e = env();
    const pulse = { story: "layoffs", reaction: "affects-job", role: "worker", county: "santa-clara-ca" };
    await h(post("/community/pulse", pulse), e);
    await h(post("/community/pulse", pulse), e);
    await h(post("/community/pulse", { ...pulse, role: "educator", county: "stanislaus-ca" }, "198.51.100.4"), e);
    const view = (await (await h(post("/community/read", { story: "layoffs" }), e)).json()) as { pulse: Record<string, number> };
    const job = summarizePulse(view.pulse, "santa-clara-ca").find((s) => s.reaction === "affects-job")!;
    expect(job.total).toBe(2);
    expect(job.inCounty).toBe(1);
    expect(job.byRole.map((r) => r.role).sort()).toEqual(["educator", "worker"]);
  });

  it("rejects unknown stories and reactions", async () => {
    const h = handler();
    expect((await h(post("/community/read", { story: "nope" }), env())).status).toBe(400);
    expect((await h(post("/community/pulse", { story: "layoffs", reaction: "like", role: "worker" }), env())).status).toBe(400);
  });
});
