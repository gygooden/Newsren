import type { PolicyImpact } from "@/lib/agent/products";
import { NOT_STATED_SUMMARY } from "@/lib/agent/products";
import type { SourceRecord } from "@/lib/agent/types";
import { SourceReport } from "./SourceReport";

export function PolicyCard({ p, record }: { p: PolicyImpact; record: SourceRecord }) {
  return (
    <article className="card">
      <SourceReport record={record} heading="h3" />
      <dl className="facts">
        <dt>Who is affected</dt>
        <dd>{p.whoIsAffected ? <q>{p.whoIsAffected}</q> : <span className="muted">{NOT_STATED_SUMMARY}</span>}</dd>
        <dt>What changes</dt>
        <dd>{p.whatChanges ? <q>{p.whatChanges}</q> : <span className="muted">{NOT_STATED_SUMMARY}</span>}</dd>
        <dt>Key dates</dt>
        <dd>{p.dates.map((d) => `${d.label}: ${d.value}`).join("; ")}</dd>
        <dt>Comment deadline</dt>
        <dd>{p.commentDeadline ?? <span className="muted">None listed in the Federal Register metadata</span>}</dd>
        <dt>Open questions</dt>
        <dd>
          <ul style={{ margin: 0 }}>
            {p.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </dd>
      </dl>
    </article>
  );
}
