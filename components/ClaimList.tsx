import type { SourceRecord, VerifiedClaim } from "@/lib/agent/types";
import { outletOf } from "@/lib/agent/util";
import { StatusLabel } from "./SourceReport";

export function ClaimList({ claims, sources }: { claims: VerifiedClaim[]; sources: Record<string, SourceRecord> }) {
  if (!claims.length) return <p className="muted">No claims passed verification for this item.</p>;
  return (
    <ul>
      {claims.map((c, i) => {
        const src = sources[c.sourceId];
        return (
          <li key={`${c.sourceId}-${i}`} style={{ marginBottom: "0.75rem" }}>
            <span>{c.text}</span>
            <blockquote style={{ marginBottom: "0.25rem" }}>
              &ldquo;{c.quote}&rdquo;
              <span className="ui small muted"> (quoted from {src ? outletOf(src) : c.sourceId})</span>
            </blockquote>
            <span className="ui small">
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
