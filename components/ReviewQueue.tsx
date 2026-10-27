"use client";

import { useEffect, useState } from "react";
import { KEYS, loadDecisions, loadQueue, writeJson, type Decision, type QueueEntry } from "@/lib/site/storage";
import { TraceTable } from "./TraceTable";

function titleOf(e: QueueEntry): string {
  const first = e.briefing.items[0];
  const lead = first ? e.briefing.sources[first.sourceId]?.title : undefined;
  return `${e.briefing.mode === "live" ? "Live" : "Saved"} briefing, ${e.briefing.createdAt.slice(0, 10)}${lead ? `: ${lead}` : ""}`;
}

export function ReviewQueue() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setQueue(loadQueue());
    setDecisions(loadDecisions());
  }, []);

  function decide(entry: QueueEntry, decision: Decision["decision"]) {
    const d: Decision = { id: entry.briefing.id, decision, decidedAt: new Date().toISOString(), title: titleOf(entry) };
    const nextDecisions = [d, ...decisions.filter((x) => x.id !== d.id)];
    const nextQueue = queue.filter((q) => q.briefing.id !== entry.briefing.id);
    const ok = writeJson(KEYS.decisions, nextDecisions) && writeJson(KEYS.queue, nextQueue);
    setDecisions(nextDecisions);
    setQueue(nextQueue);
    setStatus(ok ? `${decision === "approved" ? "Approved" : "Rejected"}: ${d.title}` : "Local storage is unavailable; the decision was not saved.");
  }

  return (
    <>
      <div aria-live="polite" className="ui">
        {status && <p>{status}</p>}
      </div>
      <h2>Pending</h2>
      {queue.length === 0 && <p>No briefings are waiting for review on this device.</p>}
      {queue.map((e) => {
        const claims = e.briefing.items.reduce((n, i) => n + i.claims.length, 0);
        return (
          <article key={e.briefing.id} className="card" aria-labelledby={`r-${e.briefing.id}`}>
            <h3 id={`r-${e.briefing.id}`}>{titleOf(e)}</h3>
            <p className="ui small">
              {e.briefing.items.length} items, {claims} verified claims, {e.briefing.unverified.length} removed or unverified,{" "}
              {e.briefing.gaps.length} coverage gaps. Submitted {e.submittedAt.slice(0, 16).replace("T", " ")}.
            </p>
            <ul>
              {e.briefing.items.flatMap((i) => i.claims).slice(0, 8).map((c, idx) => (
                <li key={idx}>
                  {c.text} <span className="muted small">(&ldquo;{c.quote}&rdquo;)</span>
                </li>
              ))}
            </ul>
            <details>
              <summary>Agent trace</summary>
              <TraceTable trace={e.run?.trace ?? []} />
            </details>
            <div className="button-row">
              <button type="button" onClick={() => decide(e, "approved")}>
                Approve: {titleOf(e)}
              </button>
              <button type="button" className="secondary" onClick={() => decide(e, "rejected")}>
                Reject: {titleOf(e)}
              </button>
            </div>
          </article>
        );
      })}
      <h2>Decisions on this device</h2>
      {decisions.length === 0 ? (
        <p>No decisions yet.</p>
      ) : (
        <ul>
          {decisions.map((d) => (
            <li key={d.id}>
              {d.decision === "approved" ? "Approved" : "Rejected"}: {d.title} ({d.decidedAt.slice(0, 10)})
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
