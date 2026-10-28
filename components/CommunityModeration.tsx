"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { describeAuthor, type StoredNote } from "@/lib/community";
import { loadPending, moderate } from "@/lib/site/community";
import { STORIES } from "@/lib/site/data";

const storyTitle = (id: string) => STORIES.find((s) => s.id === id)?.title ?? id;

// The moderator key is held in memory only and is never saved in the browser.
export function CommunityModeration() {
  const [token, setToken] = useState("");
  const [pending, setPending] = useState<StoredNote[] | null>(null);
  const [approved, setApproved] = useState<StoredNote[]>([]);
  const [status, setStatus] = useState("");

  async function load(e?: FormEvent) {
    e?.preventDefault();
    const r = await loadPending(token);
    if (!r.ok) {
      setStatus(r.message);
      return;
    }
    setPending(r.data.pending);
    setApproved(r.data.approved);
    setStatus(`${r.data.pending.length} note${r.data.pending.length === 1 ? "" : "s"} waiting.`);
  }

  async function decide(n: StoredNote, decision: "approve" | "reject" | "remove") {
    const r = await moderate(token, n.id, decision, n.story);
    setStatus(r.ok ? `Note ${decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "removed"}.` : r.message);
    if (r.ok) await load();
  }

  const row = (n: StoredNote, actions: ReactNode) => (
    <li key={n.id} className="card">
      <p className="small muted" style={{ margin: 0 }}>
        {storyTitle(n.story)} · {n.name ? `${n.name}, ` : ""}
        {describeAuthor(n)} · {n.createdAt.slice(0, 10)}
      </p>
      <p>{n.text}</p>
      <div className="button-row" style={{ margin: 0 }}>
        {actions}
      </div>
    </li>
  );

  return (
    <section aria-labelledby="mod-heading">
      <h2 id="mod-heading">Community notes</h2>
      <p>
        Reader notes wait here until a moderator approves them. Check that a note does not identify or target a private
        person. The moderator key is the Worker&apos;s <code>MODERATOR_TOKEN</code> secret.
      </p>
      <form onSubmit={load} className="button-row">
        <label htmlFor="mod-token" className="visually-hidden">
          Moderator key
        </label>
        <input type="password" id="mod-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Moderator key" autoComplete="off" style={{ maxWidth: "18rem" }} />
        <button type="submit" disabled={!token}>
          Load notes
        </button>
      </form>
      <div role="status" aria-live="polite" className="small">
        {status && <p>{status}</p>}
      </div>
      {pending && (
        <>
          <h3>Waiting for review</h3>
          {pending.length === 0 ? (
            <p className="muted">Nothing waiting.</p>
          ) : (
            <ul className="plain-list">
              {pending.map((n) =>
                row(
                  n,
                  <>
                    <button type="button" onClick={() => decide(n, "approve")}>
                      Approve
                    </button>
                    <button type="button" className="secondary" onClick={() => decide(n, "reject")}>
                      Reject
                    </button>
                  </>,
                ),
              )}
            </ul>
          )}
          <h3>Published</h3>
          {approved.length === 0 ? (
            <p className="muted">No published notes.</p>
          ) : (
            <ul className="plain-list">
              {approved.map((n) =>
                row(
                  n,
                  <button type="button" className="secondary" onClick={() => decide(n, "remove")}>
                    Remove
                  </button>,
                ),
              )}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
