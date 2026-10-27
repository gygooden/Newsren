import { entityLabel, specificEntities } from "./entities";
import { assembleBriefing } from "./finalize";
import type { Briefing, Depth, SourceRecord, Submission, SubmittedItem, Watch } from "./types";
import { normalizeText, sourceLabel, splitSentences } from "./util";

// Saved briefings are built without a model: claims come from quoted
// sentences in the records themselves, then pass through the same
// verification, stories, gaps and beyond steps as live runs.

export function selectForWatch(watch: Watch, corpus: SourceRecord[], max = 8): SourceRecord[] {
  const orgTerms = watch.organizations
    .split(/[,;\n]/)
    .map((s) => normalizeText(s.replace(/\(sample\)/i, "")))
    .filter((s) => s.length > 2);
  const topics = new Set(watch.topics);
  const scored = corpus
    .filter((r) => r.recordType !== "opinion")
    .filter((r) => (r.kind === "sample" ? Boolean(watch.county) && r.county === watch.county : true))
    .map((r) => {
      const hay = normalizeText(`${r.title} ${r.text}`);
      let score = r.topics.filter((t) => topics.has(t)).length * 2;
      if (orgTerms.some((o) => hay.includes(o))) score += 3;
      if (r.kind === "sample") score += 1; // Ground Level: prefer local records when a county is set.
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.r.provenance.publishedAt.localeCompare(a.r.provenance.publishedAt));
  // Keep a mix: local sample records for Ground Level, plus real federal and research records.
  const local = scored.filter((x) => x.r.kind === "sample").slice(0, 5);
  const real = scored.filter((x) => x.r.kind !== "sample").slice(0, max - local.length);
  return [...local, ...real].map((x) => x.r);
}

export function explainForDepth(r: SourceRecord, depth: Depth): string {
  const topic = specificEntities(r.entities).map(entityLabel)[0]?.toLowerCase() ?? "this topic";
  const kind = r.recordType === "document" ? "a primary document" : r.recordType === "paper" ? "a research preprint" : "a news report";
  switch (depth) {
    case "student":
      return `This is ${kind} about ${topic}. Read the original to see who wrote it and what evidence it gives.`;
    case "educator":
      return `This is ${kind} about ${topic}. It can anchor a class discussion on how a primary source differs from coverage of it.`;
    default:
      return `This is ${kind} about ${topic}. Check the original for scope, dates and who is directly affected before acting on it.`;
  }
}

function defaultQuestions(r: SourceRecord): string[] {
  if (r.nextQuestions?.length) return r.nextQuestions;
  if (r.kind === "arxiv") return ["Has this preprint been peer reviewed or independently replicated?"];
  if (r.commentDeadline) return [`What does the agency ask commenters to address before ${r.commentDeadline}?`];
  if (r.recordType === "document") return ["Which local institutions are directly affected, and when?"];
  return ["What primary document would confirm this report?"];
}

export function itemFromRecord(r: SourceRecord, depth: Depth): SubmittedItem {
  const claims = (r.keyClaims ?? []).map((k) => ({ text: k.text, quote: k.quote, sourceId: r.id, corroboration: k.corroboration }));
  if (!claims.length) {
    const first = splitSentences(r.text)[0];
    if (first && first.split(" ").length >= 4) {
      claims.push({ text: `The ${sourceLabel(r)} record states: "${first}"`, quote: first, sourceId: r.id, corroboration: undefined });
    }
  }
  const item: SubmittedItem = {
    sourceId: r.id,
    claims,
    whyItMatters: explainForDepth(r, depth),
    labels: [sourceLabel(r)],
    nextQuestions: defaultQuestions(r).map((question) => ({ question, sourceId: r.id })),
  };
  if (r.disagreesWith) {
    item.disagreements = [
      {
        about: r.disagreesWith.about,
        positions: [
          { sourceId: r.id, quote: r.disagreesWith.ownQuote },
          { sourceId: r.disagreesWith.sourceId, quote: r.disagreesWith.quote },
        ],
      },
    ];
  }
  return item;
}

export function buildSavedBriefing(id: string, watch: Watch, corpus: SourceRecord[], createdAt: string): Briefing {
  const selected = selectForWatch(watch, corpus);
  const byId = new Map(corpus.map((r) => [r.id, r]));
  const retrieved = new Map(selected.map((r) => [r.id, r]));
  const submission: Submission = { items: selected.map((r) => itemFromRecord(r, watch.depth)) };

  // Records cited by corroboration or disagreement count as retrieved too.
  for (const item of submission.items) {
    const refs = [
      ...item.claims.flatMap((c) => c.corroboration ?? []),
      ...(item.disagreements ?? []).flatMap((d) => d.positions),
    ];
    for (const ref of refs) {
      const r = byId.get(ref.sourceId);
      if (r) retrieved.set(r.id, r);
    }
  }
  if (watch.questions.trim()) {
    submission.couldNotFind = watch.questions
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean)
      .map((q) => `Saved briefings do not answer your own questions ("${q}"). Run live research to search for an answer.`);
  }
  return assembleBriefing({ id, watch, submission, retrieved, corpus, mode: "saved", createdAt }).briefing;
}
