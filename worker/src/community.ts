import storiesFile from "../../data/generated/stories.json";
import { sha256Hex } from "../../lib/agent/util";
import {
  CommunityInputError,
  MAX_APPROVED_PER_STORY,
  MAX_PENDING,
  NOTES_PER_VISITOR_PER_DAY,
  parseCounty,
  pulseKey,
  toPublic,
  validateNote,
  validatePulse,
  type PulseCounts,
  type StoredNote,
} from "../../lib/community";

// Community pulse and notes. Notes wait in a pending list until a moderator
// approves them. No IP address or IP hash is stored with a note; the hash is
// used only for daily limits and expires after 24 hours.

export interface CommunityEnv {
  LIMITS: KVNamespace;
  RATE_LIMIT_SALT?: string;
  MODERATOR_TOKEN?: string;
}

export const COMMUNITY_PATHS = ["/community/read", "/community/pulse", "/community/note", "/community/pending", "/community/moderate"];

const STORY_IDS = new Set((storiesFile as { stories: { id: string }[] }).stories.map((s) => s.id));
const DAY_SECONDS = 24 * 60 * 60;

type Reply = { status: number; body: unknown };

async function readJson<T>(kv: KVNamespace, key: string, fallback: T): Promise<T> {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function story(raw: unknown): string {
  if (typeof raw !== "string" || !STORY_IDS.has(raw)) throw new CommunityInputError("Unknown story.");
  return raw;
}

/** Constant-time comparison so the token cannot be guessed from response timing. */
function sameToken(given: unknown, expected: string | undefined): boolean {
  if (!expected || typeof given !== "string" || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function handleCommunity(
  path: string,
  body: Record<string, unknown>,
  env: CommunityEnv,
  request: Request,
  now: number,
): Promise<Reply> {
  const kv = env.LIMITS;
  const date = new Date(now).toISOString().slice(0, 10);
  const visitor = async () =>
    sha256Hex(`${request.headers.get("CF-Connecting-IP") ?? "unknown"}|${date}|${env.RATE_LIMIT_SALT ?? "newsren"}`);

  try {
    if (path === "/community/read") {
      const id = story(body.story);
      const [pulse, notes] = await Promise.all([
        readJson<PulseCounts>(kv, `pulse:${id}`, {}),
        readJson<StoredNote[]>(kv, `notes:${id}`, []),
      ]);
      return { status: 200, body: { pulse, notes: toPublic(notes, parseCounty(body.viewerCounty)) } };
    }

    if (path === "/community/pulse") {
      const id = story(body.story);
      const p = validatePulse(body);
      // One of each reaction per visitor per story per day.
      const seenKey = `pulsed:${await visitor()}:${id}:${p.reaction}`;
      if (await kv.get(seenKey)) return { status: 200, body: { ok: true, counted: false } };
      const pulse = await readJson<PulseCounts>(kv, `pulse:${id}`, {});
      const key = pulseKey(p.reaction, p.role, p.county);
      pulse[key] = (pulse[key] ?? 0) + 1;
      await Promise.all([kv.put(`pulse:${id}`, JSON.stringify(pulse)), kv.put(seenKey, "1", { expirationTtl: DAY_SECONDS })]);
      return { status: 200, body: { ok: true, counted: true, pulse } };
    }

    if (path === "/community/note") {
      const id = story(body.story);
      const n = validateNote(body);
      const countKey = `notes-day:${await visitor()}`;
      const used = Number((await kv.get(countKey)) ?? 0);
      if (used >= NOTES_PER_VISITOR_PER_DAY) {
        return { status: 429, body: { error: "limit", message: `You can post ${NOTES_PER_VISITOR_PER_DAY} notes a day. Try again tomorrow.` } };
      }
      const pending = await readJson<StoredNote[]>(kv, "pending", []);
      if (pending.length >= MAX_PENDING) {
        return { status: 503, body: { error: "full", message: "The moderation queue is full. Please try again later." } };
      }
      const createdAt = new Date(now).toISOString();
      const note: StoredNote = { id: (await sha256Hex(`${createdAt}|${Math.random()}`)).slice(0, 12), story: id, ...n, createdAt };
      await Promise.all([
        kv.put("pending", JSON.stringify([...pending, note])),
        kv.put(countKey, String(used + 1), { expirationTtl: DAY_SECONDS }),
      ]);
      return { status: 200, body: { ok: true, message: "Thanks. Your note will appear after a moderator reviews it." } };
    }

    // Moderator endpoints.
    if (!sameToken(body.token, env.MODERATOR_TOKEN)) return { status: 401, body: { error: "auth", message: "Moderator key not recognized." } };

    if (path === "/community/pending") {
      const pending = await readJson<StoredNote[]>(kv, "pending", []);
      const approved = (await Promise.all([...STORY_IDS].map((id) => readJson<StoredNote[]>(kv, `notes:${id}`, [])))).flat();
      return { status: 200, body: { pending, approved } };
    }

    if (path === "/community/moderate") {
      const decision = body.decision;
      if (decision !== "approve" && decision !== "reject" && decision !== "remove") throw new CommunityInputError("Unknown decision.");
      const noteId = typeof body.id === "string" ? body.id : "";
      if (decision === "remove") {
        const id = story(body.story);
        const notes = await readJson<StoredNote[]>(kv, `notes:${id}`, []);
        await kv.put(`notes:${id}`, JSON.stringify(notes.filter((n) => n.id !== noteId)));
        return { status: 200, body: { ok: true } };
      }
      const pending = await readJson<StoredNote[]>(kv, "pending", []);
      const note = pending.find((n) => n.id === noteId);
      if (!note) return { status: 404, body: { error: "not_found", message: "That note is no longer pending." } };
      await kv.put("pending", JSON.stringify(pending.filter((n) => n.id !== noteId)));
      if (decision === "approve") {
        const notes = await readJson<StoredNote[]>(kv, `notes:${note.story}`, []);
        await kv.put(`notes:${note.story}`, JSON.stringify([note, ...notes].slice(0, MAX_APPROVED_PER_STORY)));
      }
      return { status: 200, body: { ok: true } };
    }

    return { status: 404, body: { error: "not_found", message: "Unknown endpoint." } };
  } catch (err) {
    if (err instanceof CommunityInputError) return { status: 400, body: { error: "input", message: err.message } };
    throw err;
  }
}
