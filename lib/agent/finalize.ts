import { selectBeyond } from "./beyond";
import { entityLabel, specificEntities } from "./entities";
import { findGaps } from "./gaps";
import { buildStories, storiesForRecords } from "./stories";
import type { Briefing, BriefingMode, Coverage, SourceRecord, Submission, Usage, Watch } from "./types";
import { isNewsArticle, outletOf, sourceLabel } from "./util";
import { verifySubmission, type VerificationResult } from "./verify";

// Turns a submission plus the retrieved records into a displayable briefing.
// Shared by the live agent (Worker) and the saved-briefing build (no model).

export function buildCoverage(retrieved: SourceRecord[], watch: Watch, corpus: SourceRecord[]): Coverage {
  const byLabel = new Map<string, number>();
  for (const r of retrieved) byLabel.set(sourceLabel(r), (byLabel.get(sourceLabel(r)) ?? 0) + 1);
  const independentOutlets = [...new Set(retrieved.map(outletOf))].sort();

  // Thin coverage: specific entities in what was retrieved with at most one news article in the county or nation.
  const entities = new Set(retrieved.flatMap((r) => specificEntities(r.entities)));
  const thinCoverage: string[] = [];
  for (const e of entities) {
    const articles = corpus.filter(
      (r) => isNewsArticle(r) && r.entities.includes(e) && (!watch.county || r.county === watch.county),
    );
    if (articles.length <= 1) {
      thinCoverage.push(`${entityLabel(e)}: ${articles.length === 0 ? "no news articles" : "one news article"} in the sources checked`);
    }
  }
  return {
    sourcesChecked: [...byLabel.entries()].map(([name, count]) => ({ name, count })),
    independentOutlets,
    thinCoverage,
  };
}

export function zoomLevels(records: SourceRecord[], watch: Watch): Briefing["zoom"] {
  const county: string[] = [];
  const region: string[] = [];
  const nation: string[] = [];
  for (const r of records) {
    if (r.county && watch.county && r.county === watch.county) county.push(r.id);
    else if (r.county) region.push(r.id);
    else nation.push(r.id);
  }
  return { county, region, nation };
}

export interface AssembleInput {
  id: string;
  watch: Watch;
  question?: string;
  submission: Submission;
  retrieved: Map<string, SourceRecord>;
  corpus: SourceRecord[];
  mode: BriefingMode;
  createdAt: string;
  usage?: Usage;
}

export function assembleBriefing(input: AssembleInput): { briefing: Briefing; verification: VerificationResult } {
  const verification = verifySubmission(input.submission, input.retrieved);
  const retrievedList = [...input.retrieved.values()];
  const itemIds = new Set(verification.items.map((i) => i.sourceId));
  const allRecords = dedupe([...input.corpus, ...retrievedList]);

  // Ground Level: when a county is set, its bundled local documents are always checked for coverage gaps.
  const localDocs = input.watch.county ? input.corpus.filter((r) => r.kind === "sample" && r.county === input.watch.county) : [];
  const gaps = findGaps([...retrievedList, ...localDocs], allRecords);
  const beyond = selectBeyond(input.watch, allRecords, allRecords, new Set([...itemIds, ...gaps.map((g) => g.sourceId)]));
  const stories = storiesForRecords(buildStories(allRecords), [...itemIds]);

  const referenced = new Set<string>([
    ...itemIds,
    ...gaps.map((g) => g.sourceId),
    ...beyond.map((b) => b.sourceId),
    ...verification.items.flatMap((i) => i.claims.flatMap((c) => c.supportingSourceIds)),
    ...verification.disagreements.flatMap((d) => d.positions.map((p) => p.sourceId)),
    ...retrievedList.map((r) => r.id),
  ]);
  const byId = new Map(allRecords.map((r) => [r.id, r]));
  const sources: Record<string, SourceRecord> = {};
  for (const id of referenced) {
    const r = byId.get(id);
    if (r) sources[id] = r;
  }

  const briefing: Briefing = {
    id: input.id,
    createdAt: input.createdAt,
    mode: input.mode,
    watch: input.watch,
    question: input.question,
    items: verification.items,
    stories,
    gaps,
    beyond,
    unverified: verification.unverified,
    disagreements: verification.disagreements,
    coverage: buildCoverage(retrievedList, input.watch, allRecords),
    zoom: zoomLevels(retrievedList, input.watch),
    sources,
    usage: input.usage,
  };
  return { briefing, verification };
}

function dedupe(records: SourceRecord[]): SourceRecord[] {
  return [...new Map(records.map((r) => [r.id, r])).values()];
}
