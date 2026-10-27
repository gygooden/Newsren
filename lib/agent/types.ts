// Shared types for the site build, the scripts and the Worker.

export const TOPICS = [
  "ai-policy",
  "education",
  "labor",
  "finance-regulation",
  "research",
  "local-government",
] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  "ai-policy": "AI policy and regulation",
  education: "Education",
  labor: "Jobs and labor",
  "finance-regulation": "Financial regulation",
  research: "AI research",
  "local-government": "Local government",
};

export const COUNTIES = {
  "santa-clara-ca": { name: "Santa Clara County, California", region: "Northern California" },
  "stanislaus-ca": { name: "Stanislaus County, California", region: "Northern California" },
} as const;
export type CountyId = keyof typeof COUNTIES;
export const COUNTY_IDS = Object.keys(COUNTIES) as CountyId[];

export const DEPTHS = ["student", "educator", "professional"] as const;
export type Depth = (typeof DEPTHS)[number];

export type Section = "technology" | "education" | "industry" | "finance";

export type SourceKind = "federal-register" | "arxiv" | "sample";

export type License =
  | "Public domain (U.S. government work)"
  | "CC0 (arXiv metadata)"
  | "Sample";

export interface Provenance {
  sourceUrl: string;
  outlet: string;
  author: string;
  publishedAt: string;
  retrievedAt: string;
  contentHash: string;
  isSample: boolean;
  license: License;
}

export interface KeyClaim {
  text: string;
  quote: string;
  corroboration?: QuoteRef[];
}

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  /** article = human-reported news; document = primary document; paper = research; study = sample evaluation study; opinion = opinion piece */
  recordType: "article" | "document" | "paper" | "study" | "opinion";
  docType: string;
  title: string;
  excerpt: string;
  text: string;
  section: Section;
  topics: Topic[];
  entities: string[];
  county?: CountyId;
  /** Sample-only: the event a record is about. Coverage matching uses it when present. */
  subject?: string;
  agency?: string;
  authors?: string[];
  commentDeadline?: string;
  effectiveDate?: string;
  peerReviewed?: boolean;
  /** Sample-only helpers for the deterministic pipeline. */
  keyClaims?: KeyClaim[];
  disagreesWith?: { sourceId: string; about: string; quote: string; ownQuote: string };
  nextQuestions?: string[];
  study?: EvidenceStudy;
  provenance: Provenance;
}

export interface EvidenceStudy {
  population: string;
  outcome: string;
  comparison: string;
  limitations: string;
  fasterCompletion: string;
  transfer: string;
}

export interface Watch {
  topics: Topic[];
  organizations: string;
  questions: string;
  depth: Depth;
  county?: CountyId;
}

// ---- What the model submits ----

export interface QuoteRef {
  sourceId: string;
  quote: string;
}

export interface SubmittedClaim {
  text: string;
  quote: string;
  sourceId: string;
  corroboration?: QuoteRef[];
}

export interface SubmittedItem {
  sourceId: string;
  claims: SubmittedClaim[];
  whyItMatters: string;
  labels?: string[];
  nextQuestions?: { question: string; sourceId: string }[];
  disagreements?: { about: string; positions: QuoteRef[] }[];
}

export interface Submission {
  items: SubmittedItem[];
  couldNotFind?: string[];
}

// ---- What verification produces ----

export interface VerifiedClaim {
  text: string;
  quote: string;
  sourceId: string;
  similarity: number;
  independentSources: number;
  supportingSourceIds: string[];
  labels: string[];
}

export interface UnverifiedClaim {
  text: string;
  sourceId: string;
  reason: string;
}

export interface Disagreement {
  about: string;
  positions: { sourceId: string; outlet: string; quote: string }[];
}

export interface VerifiedItem {
  sourceId: string;
  claims: VerifiedClaim[];
  whyItMatters: string;
  labels: string[];
  nextQuestions: { question: string; sourceId: string }[];
}

export interface Gap {
  sourceId: string;
  label: "Not yet reported by a journalist";
  tip: string;
}

export interface BeyondItem {
  sourceId: string;
  score: number;
  components: { localImpact: number; independentSources: number; documentType: number };
  reason: string;
}

export interface Coverage {
  sourcesChecked: { name: string; count: number }[];
  independentOutlets: string[];
  thinCoverage: string[];
}

export interface TraceStep {
  step: number;
  kind: "model" | "tool";
  tool?: string;
  args?: Record<string, unknown>;
  resultCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  note?: string;
}

export interface Usage {
  steps: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  stopReason: string;
  elapsedMs: number;
}

export type BriefingMode = "saved" | "live";

export interface Briefing {
  id: string;
  createdAt: string;
  mode: BriefingMode;
  watch: Watch;
  question?: string;
  items: VerifiedItem[];
  stories: string[];
  gaps: Gap[];
  beyond: BeyondItem[];
  unverified: UnverifiedClaim[];
  disagreements: Disagreement[];
  coverage: Coverage;
  zoom: { county: string[]; region: string[]; nation: string[] };
  /** Every record the briefing references, keyed by id, so the UI can render source reports. */
  sources: Record<string, SourceRecord>;
  usage?: Usage;
}

export interface RunRecord {
  id: string;
  createdAt: string;
  model: string;
  watch: Watch;
  question?: string;
  submission: Submission | null;
  retrieved: SourceRecord[];
  trace: TraceStep[];
  usage: Usage;
  synthetic?: boolean;
  note?: string;
}
