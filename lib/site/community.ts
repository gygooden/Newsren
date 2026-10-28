"use client";

import type { CommunityView, PublicNote, StoredNote } from "../community";
import type { CountyId } from "../agent/types";
import { AGENT_URL } from "./agent";

// Calls to the Worker's community endpoints. Reading happens when a story page
// opens; nothing is sent until the reader reacts or posts a note.

export type CommunityResult<T> = { ok: true; data: T } | { ok: false; message: string };

async function call<T>(path: string, body: Record<string, unknown>): Promise<CommunityResult<T>> {
  if (!AGENT_URL) return { ok: false, message: "Community features are not configured for this site." };
  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as T & { message?: string };
    if (!res.ok) return { ok: false, message: data.message ?? "The community service returned an error." };
    return { ok: true, data };
  } catch {
    return { ok: false, message: "Could not reach the community service." };
  }
}

export const readCommunity = (story: string, viewerCounty?: CountyId) =>
  call<CommunityView>("/community/read", { story, viewerCounty });

export const sendPulse = (body: { story: string; reaction: string; role: string; county?: string }) =>
  call<{ counted: boolean; pulse?: CommunityView["pulse"] }>("/community/pulse", body);

export const sendNote = (body: { story: string; text: string; role: string; county?: string; name?: string }) =>
  call<{ message: string }>("/community/note", body);

export const loadPending = (token: string) => call<{ pending: StoredNote[]; approved: StoredNote[] }>("/community/pending", { token });

export const moderate = (token: string, id: string, decision: "approve" | "reject" | "remove", story?: string) =>
  call<{ ok: true }>("/community/moderate", { token, id, decision, story });

export type { PublicNote };
