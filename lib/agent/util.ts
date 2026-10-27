import type { SourceRecord } from "./types";

export const USER_AGENT = "newsren-course-demo";

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Lowercase, unify quote marks, drop punctuation, collapse whitespace. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’“”"']/g, "")
    .replace(/[^a-z0-9$%]+/g, " ")
    .trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + "...";
}

export function splitSentences(s: string): string[] {
  return s
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function sourceLabel(r: SourceRecord): "Federal Register" | "arXiv preprint" | "Sample data" {
  if (r.kind === "federal-register") return "Federal Register";
  if (r.kind === "arxiv") return "arXiv preprint";
  return "Sample data";
}

/** Name of the publisher used to judge independence: outlet for news, agency for documents. */
export function outletOf(r: SourceRecord): string {
  return r.provenance.outlet || r.agency || r.id;
}

export function isPrimaryDocument(r: SourceRecord): boolean {
  return r.recordType === "document";
}

export function isNewsArticle(r: SourceRecord): boolean {
  return r.recordType === "article";
}

export function decodeXmlEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Document type in running text: "a WARN notice", "a proposed rule". */
export function docTypePhrase(docType: string): string {
  return docType.startsWith("WARN") ? docType : docType.toLowerCase();
}
