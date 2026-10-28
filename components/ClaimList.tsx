import type { SourceRecord, VerifiedClaim } from "@/lib/agent/types";
import { outletOf } from "@/lib/agent/util";
import { StatusLabel } from "./SourceReport";

/** Each claim is followed by its receipt: the exact quote it was checked against. */
export function ClaimList({ claims, sources }: { claims: VerifiedClaim[]; sources: Record<string, SourceRecord> }) {
  if (!claims.length) return <p className="muted">No claims passed verification for this item.</p>;
  return (
    <ul className="claim-list">
      {claims.map((c, i) => {
        const src = sources[c.sourceId];
        return (
          <li key={`${c.sourceId}-${i}`}>
            <span className="claim-text">{c.text}</span>
            <blockquote className="receipt">
              <span className="receipt-head">Receipt · {src ? outletOf(src) : c.sourceId}</span>
              &ldquo;{c.quote}&rdquo;
            </blockquote>
            <span className="small">
              {c.labels.map((l) => (
                <StatusLabel key={l} text={l} />
              ))}
              <span className="muted">
                {c.independentSources} independent source{c.independentSources === 1 ? "" : "s"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
