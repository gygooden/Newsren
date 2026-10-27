import { tagEntities } from "./entities";
import type { CountyId, Section, SourceRecord, Topic } from "./types";
import { USER_AGENT, decodeXmlEntities, normalizeText, sha256Hex, truncate } from "./util";

// Fetchers for the two live sources, plus search over the bundled sample
// data. Used by the Worker tools and by scripts/ingest.ts.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const FEDERAL_REGISTER_URL = "https://www.federalregister.gov/api/v1/documents.json";
export const ARXIV_URL = "https://export.arxiv.org/api/query";

export const FR_AGENCIES: Record<string, { topics: Topic[]; section: Section }> = {
  "securities-and-exchange-commission": { topics: ["finance-regulation"], section: "finance" },
  "comptroller-of-the-currency": { topics: ["finance-regulation"], section: "finance" },
  "federal-deposit-insurance-corporation": { topics: ["finance-regulation"], section: "finance" },
  "federal-reserve-system": { topics: ["finance-regulation"], section: "finance" },
  "consumer-financial-protection-bureau": { topics: ["finance-regulation"], section: "finance" },
  "treasury-department": { topics: ["finance-regulation"], section: "finance" },
  "federal-trade-commission": { topics: ["ai-policy"], section: "technology" },
  "education-department": { topics: ["education"], section: "education" },
  "labor-department": { topics: ["labor"], section: "industry" },
  "equal-employment-opportunity-commission": { topics: ["labor"], section: "industry" },
};

export const ARXIV_CATEGORIES = ["cs.AI", "cs.CL", "cs.CY", "econ.GN", "q-fin.GN"] as const;

interface FrApiDoc {
  title: string;
  abstract: string | null;
  html_url: string;
  publication_date: string;
  type: string;
  document_number: string;
  agencies?: { name?: string; raw_name?: string; slug?: string }[];
  comments_close_on?: string | null;
  effective_on?: string | null;
}

export interface FrQuery {
  query: string;
  agencies?: string[];
  since?: string;
  perPage?: number;
}

export async function searchFederalRegister(q: FrQuery, fetchImpl: FetchLike, signal?: AbortSignal): Promise<SourceRecord[]> {
  const params = new URLSearchParams();
  params.set("conditions[term]", q.query.slice(0, 120));
  params.set("per_page", String(Math.min(q.perPage ?? 8, 10)));
  params.set("order", "newest");
  for (const a of (q.agencies ?? []).filter((a) => a in FR_AGENCIES)) params.append("conditions[agencies][]", a);
  if (q.since && /^\d{4}-\d{2}-\d{2}$/.test(q.since)) params.set("conditions[publication_date][gte]", q.since);
  for (const f of ["title", "abstract", "html_url", "publication_date", "type", "document_number", "agencies", "comments_close_on", "effective_on"]) {
    params.append("fields[]", f);
  }
  const res = await fetchImpl(`${FEDERAL_REGISTER_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`Federal Register returned ${res.status}`);
  const body = (await res.json()) as { results?: FrApiDoc[] };
  const retrievedAt = new Date().toISOString();
  return Promise.all((body.results ?? []).map((d) => frToRecord(d, retrievedAt)));
}

async function frToRecord(d: FrApiDoc, retrievedAt: string): Promise<SourceRecord> {
  const agency = d.agencies?.[0];
  const agencyName = agency?.name ?? agency?.raw_name ?? "Federal agency";
  const meta = (agency?.slug && FR_AGENCIES[agency.slug]) || { topics: ["ai-policy"] as Topic[], section: "technology" as Section };
  const text = d.abstract ?? "";
  const excerpt = truncate(text || d.title, 600);
  return {
    id: `fr-${d.document_number}`,
    kind: "federal-register",
    recordType: "document",
    docType: d.type,
    title: d.title,
    excerpt,
    text: text || d.title,
    section: meta.section,
    topics: meta.topics,
    entities: tagEntities(`${d.title} ${text}`),
    agency: agencyName,
    commentDeadline: d.comments_close_on ?? undefined,
    effectiveDate: d.effective_on ?? undefined,
    provenance: {
      sourceUrl: d.html_url,
      outlet: agencyName,
      author: agencyName,
      publishedAt: d.publication_date,
      retrievedAt,
      contentHash: await sha256Hex(`${d.title}\n${text}`),
      isSample: false,
      license: "Public domain (U.S. government work)",
    },
  };
}

// ---- arXiv ----

let lastArxivRequest = 0;
export const ARXIV_MIN_INTERVAL_MS = 3000;

/** arXiv asks for at least 3 seconds between requests. */
export async function waitForArxivSlot(now: () => number = Date.now): Promise<void> {
  const wait = lastArxivRequest + ARXIV_MIN_INTERVAL_MS - now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastArxivRequest = now();
}

export interface ArxivQuery {
  query: string;
  categories?: string[];
  maxResults?: number;
}

export async function searchArxiv(q: ArxivQuery, fetchImpl: FetchLike, signal?: AbortSignal, throttle = true): Promise<SourceRecord[]> {
  const cats = (q.categories ?? []).filter((c) => (ARXIV_CATEGORIES as readonly string[]).includes(c));
  const terms = q.query
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((t) => `all:${t}`)
    .join(" AND ");
  const catExpr = (cats.length ? cats : ["cs.AI", "cs.CL", "cs.CY"]).map((c) => `cat:${c}`).join(" OR ");
  const params = new URLSearchParams({
    search_query: `(${terms || "all:education"}) AND (${catExpr})`,
    max_results: String(Math.min(q.maxResults ?? 8, 10)),
    sortBy: "submittedDate",
    sortOrder: "descending",
  });
  if (throttle) await waitForArxivSlot();
  const res = await fetchImpl(`${ARXIV_URL}?${params}`, { headers: { "User-Agent": USER_AGENT }, signal });
  if (!res.ok) throw new Error(`arXiv returned ${res.status}`);
  return parseArxivFeed(await res.text());
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeXmlEntities(m[1]).replace(/\s+/g, " ").trim() : "";
}

export async function parseArxivFeed(xml: string): Promise<SourceRecord[]> {
  const entries = xml.split("<entry>").slice(1).map((e) => e.split("</entry>")[0]);
  const retrievedAt = new Date().toISOString();
  const out: SourceRecord[] = [];
  for (const e of entries) {
    const absUrl = tag(e, "id").replace(/^http:/, "https:");
    const arxivId = absUrl.split("/abs/")[1] ?? absUrl;
    const title = tag(e, "title");
    const abstract = tag(e, "summary");
    const authors = [...e.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => decodeXmlEntities(m[1]).trim());
    const cats = [...e.matchAll(/<category[^>]*term="([^"]+)"/g)].map((m) => m[1]);
    const isFinance = cats.some((c) => c.startsWith("q-fin") || c.startsWith("econ"));
    const lower = `${title} ${abstract}`.toLowerCase();
    const topics: Topic[] = ["research"];
    if (/educat|student|teach|school|learn(ing)? outcome/.test(lower)) topics.push("education");
    if (/labou?r|employ|job|workforce|wage/.test(lower)) topics.push("labor");
    if (isFinance || /financ|bank|credit|trading/.test(lower)) topics.push("finance-regulation");
    out.push({
      id: `arxiv-${arxivId.replace(/[^\w.-]/g, "_")}`,
      kind: "arxiv",
      recordType: "paper",
      docType: "Preprint",
      title,
      excerpt: truncate(abstract, 600),
      text: abstract,
      section: isFinance ? "finance" : "technology",
      topics,
      entities: tagEntities(`${title} ${abstract}`),
      authors,
      peerReviewed: false,
      provenance: {
        sourceUrl: absUrl,
        outlet: "arXiv",
        author: authors.slice(0, 3).join(", ") + (authors.length > 3 ? " et al." : ""),
        publishedAt: tag(e, "published").slice(0, 10),
        retrievedAt,
        contentHash: await sha256Hex(`${title}\n${abstract}`),
        isSample: false,
        license: "CC0 (arXiv metadata)",
      },
    });
  }
  return out;
}

// ---- Bundled sample data ----

export function searchLocal(records: SourceRecord[], county: CountyId, query: string, max = 8): SourceRecord[] {
  const terms = normalizeText(query).split(" ").filter((t) => t.length > 2);
  return records
    .filter((r) => r.county === county)
    .map((r) => {
      const hay = normalizeText(`${r.title} ${r.text} ${r.entities.join(" ")} ${r.topics.join(" ")}`);
      const score = terms.length ? terms.filter((t) => hay.includes(t)).length : 1;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.r.provenance.publishedAt.localeCompare(a.r.provenance.publishedAt))
    .slice(0, max)
    .map((x) => x.r);
}
