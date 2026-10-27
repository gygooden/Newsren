import { itemFromRecord } from "./deterministic";
import { findGaps } from "./gaps";
import type { Story } from "./stories";
import type { Depth, Disagreement, Gap, SourceRecord, VerifiedClaim } from "./types";
import { outletOf, sourceLabel, docTypePhrase } from "./util";
import { verifySubmission } from "./verify";

// Builds the four story tools from a story's records. Deterministic: every
// sentence either quotes a record or describes the record set itself.

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  transfer?: boolean;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface AlertMatch {
  sourceId: string;
  title: string;
  date: string;
}

export interface StoryView extends Story {
  claims: VerifiedClaim[];
  disagreements: Disagreement[];
  gaps: Gap[];
  nextQuestions: { question: string; sourceId: string }[];
  learn: {
    whatHappened: string[];
    whatIsNew: string;
    evidence: string[];
    watchNext: string[];
    explanation: Record<Depth, string>;
    glossary: GlossaryEntry[];
    quiz: QuizQuestion[];
    discussion: string[];
  };
  alerts: Record<AlertCriterion, AlertMatch[]>;
  sections: string[];
  counties: string[];
  sourceIds: string[];
}

export const ALERT_CRITERIA = {
  "new-rules": "New rules or proposed rules",
  votes: "Scheduled votes and agenda items",
  "warn-notices": "WARN notices",
  benchmarks: "Independent benchmarks and studies",
} as const;
export type AlertCriterion = keyof typeof ALERT_CRITERIA;

const GLOSSARY: Record<string, GlossaryEntry> = {
  "WARN notice": { term: "WARN notice", definition: "A notice employers file with the state before certain mass layoffs or closures, under the Worker Adjustment and Retraining Notification Act." },
  Rule: { term: "Final rule", definition: "A regulation an agency has adopted. The Federal Register entry states when it takes effect." },
  "Proposed Rule": { term: "Proposed rule", definition: "A draft regulation published for public comment before an agency decides whether to adopt it." },
  Notice: { term: "Notice", definition: "A Federal Register document announcing a meeting, request for information, guidance or similar action that is not itself a rule." },
  Preprint: { term: "Preprint", definition: "A research paper shared publicly before peer review. Its findings have not been checked by independent reviewers." },
  "School board agenda item": { term: "Agenda item", definition: "A matter scheduled for discussion or a vote at a public meeting. The agenda shows what will be considered, not what was decided." },
  "City council agenda item": { term: "Agenda item", definition: "A matter scheduled for discussion or a vote at a public meeting. The agenda shows what will be considered, not what was decided." },
  Study: { term: "Comparison group", definition: "The group a study compares against, used to tell whether an outcome is due to the program being studied." },
};

const INDEPENDENT: GlossaryEntry = {
  term: "Independent source",
  definition: "A separate outlet or agency that reports the same fact on its own. Two articles from one outlet count as one source.",
};

function alertMatches(records: SourceRecord[]): Record<AlertCriterion, AlertMatch[]> {
  const pick = (f: (r: SourceRecord) => boolean) =>
    records.filter(f).map((r) => ({ sourceId: r.id, title: r.title, date: r.provenance.publishedAt }));
  return {
    "new-rules": pick((r) => r.docType === "Rule" || r.docType === "Proposed Rule"),
    votes: pick((r) => /agenda item/i.test(r.docType)),
    "warn-notices": pick((r) => r.docType === "WARN notice"),
    benchmarks: pick((r) => r.recordType === "study" || (r.kind === "arxiv" && /benchmark|evaluat/i.test(r.text))),
  };
}

export function buildStoryView(story: Story, byId: Map<string, SourceRecord>, corpus: SourceRecord[]): StoryView {
  const records = story.timeline.map((id) => byId.get(id)).filter((r): r is SourceRecord => Boolean(r));
  const retrieved = new Map(records.map((r) => [r.id, r]));
  for (const r of records) {
    if (r.disagreesWith) {
      const other = byId.get(r.disagreesWith.sourceId);
      if (other) retrieved.set(other.id, other);
    }
    for (const k of r.keyClaims ?? []) for (const c of k.corroboration ?? []) {
      const other = byId.get(c.sourceId);
      if (other) retrieved.set(other.id, other);
    }
  }
  const verification = verifySubmission({ items: records.map((r) => itemFromRecord(r, "professional")) }, retrieved);
  const claims = verification.items.flatMap((i) => i.claims);
  const nextQuestions = verification.items.flatMap((i) => i.nextQuestions);
  const gaps = findGaps(records, corpus);

  const docs = records.filter((r) => r.recordType === "document");
  const articles = records.filter((r) => r.recordType === "article");
  const papers = records.filter((r) => r.recordType === "paper" || r.recordType === "study");
  const outlets = new Set(records.map(outletOf));
  const latest = records[records.length - 1];
  const label = story.title.toLowerCase();

  const glossary = [...new Map(records.map((r) => GLOSSARY[r.docType]).filter(Boolean).map((g) => [g.term, g])).values()];
  glossary.push(INDEPENDENT);

  const firstDoc = docs[0];
  const quiz: QuizQuestion[] = [
    {
      id: "q1",
      prompt: "Which of these is a primary document rather than news coverage?",
      options: firstDoc
        ? [firstDoc.title, ...articles.slice(0, 2).map((a) => a.title), "None of these"].slice(0, 4)
        : ["A news article", "An opinion column", "A Federal Register rule", "A social media post"],
      answer: firstDoc ? 0 : 2,
      explanation: firstDoc
        ? `"${firstDoc.title}" is a ${docTypePhrase(firstDoc.docType)}, the record itself. The others report on events.`
        : "A Federal Register rule is the official record; the others describe or react to events.",
    },
    {
      id: "q2",
      prompt: `How many independent outlets or agencies appear in the sources checked for this story?`,
      options: [...new Set([outlets.size, outlets.size + 1, Math.max(1, outlets.size - 1), outlets.size + 2])].map(String),
      answer: 0,
      explanation: `The story draws on ${outlets.size} distinct outlets or agencies. Two pieces from one outlet count once.`,
    },
    {
      id: "q3",
      transfer: true,
      prompt: "Transfer: a headline in another state says a new rule \"bans AI in hiring.\" What is the best first step?",
      options: [
        "Find the rule itself in the Federal Register or state register and read what it covers",
        "Share the headline, since it names a rule",
        "Look for the most-shared post about it",
        "Assume it applies in your county",
      ],
      answer: 0,
      explanation: "The primary document states scope, dates and who is covered. Headlines often compress or overstate it.",
    },
  ];

  return {
    ...story,
    claims,
    disagreements: verification.disagreements,
    gaps,
    nextQuestions,
    learn: {
      whatHappened: records.map((r) => `${r.provenance.publishedAt}: ${r.title} (${sourceLabel(r)}, ${outletOf(r)})`),
      whatIsNew: latest ? `The most recent record is "${latest.title}" from ${outletOf(latest)}, dated ${latest.provenance.publishedAt}.` : "No records yet.",
      evidence: [
        `${docs.length} primary document${docs.length === 1 ? "" : "s"}`,
        `${articles.length} news article${articles.length === 1 ? "" : "s"} (sample data)`,
        `${papers.length} research item${papers.length === 1 ? "" : "s"}`,
        `${verification.disagreements.length} recorded disagreement${verification.disagreements.length === 1 ? "" : "s"} between outlets`,
      ],
      watchNext: [
        ...docs.filter((d) => d.commentDeadline).map((d) => `Comment deadline for "${d.title}": ${d.commentDeadline}`),
        ...docs.filter((d) => d.effectiveDate).map((d) => `Effective date for "${d.title}": ${d.effectiveDate}`),
        ...gaps.map((g) => `Whether a journalist reports on "${byId.get(g.sourceId)?.title}"`),
      ].slice(0, 5),
      explanation: {
        student: `This story is about ${label}. Start with the primary documents, then compare how each news report describes them.`,
        educator: `This story about ${label} pairs primary documents with coverage, which suits a lesson on checking claims against the record.`,
        professional: `This story tracks ${label} across ${docs.length} primary document${docs.length === 1 ? "" : "s"} and ${articles.length} report${articles.length === 1 ? "" : "s"}. Check dates and scope in the originals.`,
      },
      glossary,
      quiz,
      discussion: [
        `Which part of the ${label} story is documented in a primary source, and which part relies only on reporting?`,
        "Where do the outlets disagree, and what document could settle it?",
        "Who is affected locally but not quoted in any report?",
      ],
    },
    alerts: alertMatches(records),
    sections: [...new Set(records.map((r) => r.section))],
    counties: [...new Set(records.map((r) => r.county).filter((c): c is NonNullable<typeof c> => Boolean(c)))],
    sourceIds: [...retrieved.keys()],
  };
}
