import { itemFromRecord } from "./deterministic";
import { financeStatus } from "./labels";
import type { EvidenceStudy, SourceRecord, VerifiedClaim } from "./types";
import { splitSentences } from "./util";
import { verifySubmission } from "./verify";

// Section products. Every filled field is a sentence quoted from the record;
// anything not stated is shown as "Not stated".

export const NOT_STATED_ABSTRACT = "Not stated in the abstract";
export const NOT_STATED_SUMMARY = "Not stated in the document summary";

const PAPER_CUES = {
  hypothesis: /\b(we hypothesi[sz]e|hypothesis|we ask whether|we investigate whether|research question)\b/i,
  method: /\b(we propose|we introduce|we present|we develop|we train|we use|we conduct|we evaluate|we build|our method|our approach|framework|using a)\b/i,
  findings: /\b(we find|results show|our results|we show|outperform|improves?|achieves?|demonstrate|reveal)\b/i,
  limitations: /\b(limitation|however|does not|do not|cannot|fails? to|only|future work)\b/i,
  applications: /\b(application|can be used|enables?|practitioners|policy implications|deploy)\b/i,
} as const;
export type PaperField = keyof typeof PAPER_CUES;

export interface DecodedPaper {
  sourceId: string;
  fields: Record<PaperField, string | null>;
}

export function decodePaper(r: SourceRecord): DecodedPaper {
  const sentences = splitSentences(r.text);
  const used = new Set<string>();
  const fields = {} as Record<PaperField, string | null>;
  for (const key of Object.keys(PAPER_CUES) as PaperField[]) {
    const hit = sentences.find((s) => !used.has(s) && PAPER_CUES[key].test(s));
    if (hit) used.add(hit);
    fields[key] = hit ?? null;
  }
  return { sourceId: r.id, fields };
}

export interface PolicyImpact {
  sourceId: string;
  whoIsAffected: string | null;
  whatChanges: string | null;
  dates: { label: string; value: string }[];
  commentDeadline: string | null;
  openQuestions: string[];
}

const AFFECTED = /\b(institutions?|students?|schools?|colleges?|universit\w+|applicants?|grantees?|eligible|advisers?|banks?|brokers?|dealers?|funds?|issuers?|lenders?|consumers?|employers?|companies)\b/i;

export function policyImpact(r: SourceRecord): PolicyImpact {
  const sentences = splitSentences(r.text);
  const dates = [{ label: "Published", value: r.provenance.publishedAt }];
  if (r.effectiveDate) dates.push({ label: "Effective", value: r.effectiveDate });
  if (r.commentDeadline) dates.push({ label: "Comments close", value: r.commentDeadline });
  const openQuestions = [
    "Which local institutions fall within the scope described in the full document?",
    r.commentDeadline ? "What specific questions does the agency ask commenters to answer?" : "Does the full document set a comment period or compliance date?",
    "Has any news outlet explained the local effect of this document?",
  ];
  return {
    sourceId: r.id,
    whoIsAffected: sentences.find((s) => AFFECTED.test(s)) ?? null,
    whatChanges: sentences[0] ?? null,
    dates,
    commentDeadline: r.commentDeadline ?? null,
    openQuestions,
  };
}

function verifiedClaimsFor(records: SourceRecord[], all: SourceRecord[]): VerifiedClaim[] {
  const byId = new Map(all.map((r) => [r.id, r]));
  const retrieved = new Map(records.map((r) => [r.id, r]));
  for (const r of records) for (const k of r.keyClaims ?? []) for (const c of k.corroboration ?? []) {
    const other = byId.get(c.sourceId);
    if (other) retrieved.set(other.id, other);
  }
  return verifySubmission({ items: records.map((r) => itemFromRecord(r, "professional")) }, retrieved).items.flatMap((i) => i.claims);
}

export interface SectionProducts {
  decoder: DecodedPaper[];
  policy: PolicyImpact[];
  evidence: { sourceId: string; study: EvidenceStudy } | null;
  industry: { supported: VerifiedClaim[]; speculative: VerifiedClaim[] };
  finance: { regulations: PolicyImpact[]; realityCheck: (VerifiedClaim & { status: string })[] };
}

export function buildProducts(real: SourceRecord[], sample: SourceRecord[]): SectionProducts {
  const all = [...real, ...sample];
  const papers = real.filter((r) => r.kind === "arxiv").slice(0, 8);
  const eduDocs = real.filter((r) => r.kind === "federal-register" && r.topics.includes("education")).slice(0, 6);
  const finDocs = real.filter((r) => r.kind === "federal-register" && r.section === "finance").slice(0, 8);
  const study = sample.find((r) => r.study);

  const industryRecords = sample.filter((r) => r.section === "industry" && r.recordType !== "opinion");
  const industryClaims = verifiedClaimsFor(industryRecords, all);

  const financeRecords = sample.filter((r) => r.section === "finance");
  const realityCheck = verifiedClaimsFor(financeRecords, all)
    .map((c) => ({ ...c, status: financeStatus(c.text) ?? "Unclassified" }))
    .filter((c) => c.status !== "Unclassified");

  return {
    decoder: papers.map(decodePaper),
    policy: eduDocs.map(policyImpact),
    evidence: study?.study ? { sourceId: study.id, study: study.study } : null,
    industry: {
      supported: industryClaims.filter((c) => c.labels.includes("Supported")),
      speculative: industryClaims.filter((c) => c.labels.includes("Speculative")),
    },
    finance: { regulations: finDocs.map(policyImpact), realityCheck },
  };
}
