"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { APPROVED_STORY_IDS, STORIES } from "@/lib/site/data";
import { loadDecisions, type Decision } from "@/lib/site/storage";

export function FrontStories() {
  const [local, setLocal] = useState<Decision[]>([]);
  useEffect(() => setLocal(loadDecisions().filter((d) => d.decision === "approved")), []);
  const approved = APPROVED_STORY_IDS.map((a) => ({ a, s: STORIES.find((s) => s.id === a.id) })).filter((x) => x.s);
  return (
    <>
      <ul className="grid-2 plain-list">
        {approved.map(({ a, s }) => (
          <li key={s!.id} className="card">
            <p className="small" style={{ margin: "0 0 0.5rem" }}>
              <span className="label label-reported">Editor-reviewed</span>
              <span className="muted">approved {a.approvedAt}</span>
            </p>
            <h3 style={{ marginTop: 0 }}>
              <Link href={`/story/${s!.id}/`}>{s!.title}</Link>
            </h3>
            <p>{s!.learn.whatIsNew}</p>
            <p className="small muted">{s!.timeline.length} sources</p>
          </li>
        ))}
      </ul>
      {local.length > 0 && (
        <>
          <h3>Approved on this device</h3>
          <p className="muted small">These approvals are stored only in this browser. A shared review queue is future work.</p>
          <ul>
            {local.map((d) => (
              <li key={d.id}>
                {d.title} <span className="muted small">(approved {d.decidedAt.slice(0, 10)})</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
