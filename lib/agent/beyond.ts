import { specificEntities } from "./entities";
import type { BeyondItem, SourceRecord, Watch } from "./types";
import { outletOf, docTypePhrase } from "./util";

// "Beyond your watch": one or two significant items outside the reader's
// topics. The score is transparent and documented on /about. It never uses
// engagement signals such as clicks, views or shares.

export const DOCUMENT_TYPE_WEIGHTS: Record<string, number> = {
  Rule: 3,
  "WARN notice": 3,
  "Proposed Rule": 2,
  "City council agenda item": 2,
  "School board agenda item": 2,
  Notice: 1,
  Study: 1,
  Article: 1,
  Preprint: 0.5,
  Opinion: 0,
};

export function localImpact(r: SourceRecord, watch: Watch): number {
  if (watch.county && r.county === watch.county) return 3;
  if (!r.county && r.kind === "federal-register") return 1;
  return 0;
}

export function independentSourceCount(r: SourceRecord, corpus: SourceRecord[]): number {
  const entities = new Set(specificEntities(r.entities));
  const outlets = new Set<string>();
  for (const other of corpus) {
    if (other.recordType === "opinion") continue;
    if (specificEntities(other.entities).some((e) => entities.has(e))) outlets.add(outletOf(other));
  }
  return Math.min(outlets.size, 3);
}

export function significance(r: SourceRecord, watch: Watch, corpus: SourceRecord[]): BeyondItem {
  const components = {
    localImpact: localImpact(r, watch),
    independentSources: independentSourceCount(r, corpus),
    documentType: DOCUMENT_TYPE_WEIGHTS[r.docType] ?? 1,
  };
  const score = components.localImpact + components.independentSources + components.documentType;
  const parts: string[] = [];
  if (components.localImpact === 3) parts.push("it concerns the county you chose");
  else if (components.localImpact === 1) parts.push("it is a federal document that applies nationally");
  if (components.independentSources >= 2) parts.push(`${components.independentSources} independent outlets or agencies have records on this topic`);
  if (components.documentType >= 2) parts.push(`it is a ${docTypePhrase(r.docType)}, a primary document with direct effects`);
  const reason = parts.length
    ? `Shown because ${parts.join("; ")}. It is outside the topics you follow.`
    : "Shown because it is outside the topics you follow and scored highest among the remaining items.";
  return { sourceId: r.id, score, components, reason };
}

export function selectBeyond(
  watch: Watch,
  candidates: SourceRecord[],
  corpus: SourceRecord[],
  exclude: Set<string>,
  max = 2,
): BeyondItem[] {
  const watched = new Set(watch.topics);
  return candidates
    .filter((r) => !exclude.has(r.id) && r.recordType !== "opinion")
    .filter((r) => !r.topics.some((t) => watched.has(t)))
    .filter((r) => !watch.county || !r.county || r.county === watch.county)
    .map((r) => significance(r, watch, corpus))
    .sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId))
    .slice(0, max);
}
