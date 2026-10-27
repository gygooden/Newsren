import { claimLabels, looksLikeInvestmentAdvice } from "./labels";
import type {
  Disagreement,
  QuoteRef,
  SourceRecord,
  Submission,
  UnverifiedClaim,
  VerifiedClaim,
  VerifiedItem,
} from "./types";
import { normalizeText, outletOf, splitSentences } from "./util";

// Deterministic verification gate. Runs after submit_briefing and before
// anything is shown. Nothing here calls a model.

export const MIN_SIMILARITY = 0.85;
const MIN_QUOTE_WORDS = 4;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Best normalized similarity between the quote and any same-length window of the text. */
export function quoteSimilarity(quote: string, text: string): number {
  const q = normalizeText(quote);
  const t = normalizeText(text);
  const qWords = q.split(" ").filter(Boolean);
  // Very short quotes match almost anything, so they never count as support.
  if (qWords.length < MIN_QUOTE_WORDS) return 0;
  if (t.includes(q)) return 1;
  const tWords = t.split(" ");
  let best = 0;
  for (const size of [qWords.length - 1, qWords.length, qWords.length + 1]) {
    if (size < 1 || size > tWords.length) continue;
    for (let i = 0; i + size <= tWords.length; i++) {
      const window = tWords.slice(i, i + size).join(" ");
      // Cheap length filter before the edit distance.
      if (Math.abs(window.length - q.length) / Math.max(window.length, q.length) > 1 - MIN_SIMILARITY) continue;
      const sim = 1 - levenshtein(q, window) / Math.max(q.length, window.length);
      if (sim > best) best = sim;
      if (best === 1) return 1;
    }
  }
  return best;
}

export function quoteIsSupported(ref: QuoteRef, retrieved: Map<string, SourceRecord>): { ok: boolean; similarity: number; reason?: string } {
  const source = retrieved.get(ref.sourceId);
  if (!source) return { ok: false, similarity: 0, reason: "Cited source was never retrieved in this run." };
  const fullText = `${source.title}\n${source.text}`;
  const similarity = quoteSimilarity(ref.quote, fullText);
  if (similarity < MIN_SIMILARITY) {
    return { ok: false, similarity, reason: "The quoted text was not found in the retrieved source." };
  }
  return { ok: true, similarity };
}

/** Remove explanation sentences that introduce numbers not present in the source text, or read as investment advice. */
function checkExplanation(text: string, source: SourceRecord, unverified: UnverifiedClaim[]): string {
  const haystack = normalizeText(`${source.title} ${source.text}`);
  const kept: string[] = [];
  for (const sentence of splitSentences(text)) {
    if (looksLikeInvestmentAdvice(sentence)) {
      unverified.push({ text: sentence, sourceId: source.id, reason: "Removed: investment advice is out of scope." });
      continue;
    }
    const numbers = sentence.match(/\d[\d,.]*/g) ?? [];
    const missing = numbers.filter((n) => !haystack.includes(normalizeText(n.replace(/[.,]$/, ""))));
    if (missing.length) {
      unverified.push({ text: sentence, sourceId: source.id, reason: "Explanation contained a figure not found in the source." });
      continue;
    }
    kept.push(sentence);
  }
  return kept.join(" ");
}

export interface VerificationResult {
  items: VerifiedItem[];
  unverified: UnverifiedClaim[];
  disagreements: Disagreement[];
  stats: { submittedClaims: number; displayedClaims: number; removedClaims: number };
}

export function verifySubmission(submission: Submission, retrieved: Map<string, SourceRecord>): VerificationResult {
  const unverified: UnverifiedClaim[] = [];
  const disagreements: Disagreement[] = [];
  const items: VerifiedItem[] = [];
  let submittedClaims = 0;

  for (const item of submission.items ?? []) {
    submittedClaims += item.claims?.length ?? 0;
    const source = retrieved.get(item.sourceId);
    if (!source) {
      for (const c of item.claims ?? []) {
        unverified.push({ text: c.text, sourceId: item.sourceId, reason: "Item cites a source that was never retrieved in this run." });
      }
      continue;
    }

    const claims: VerifiedClaim[] = [];
    for (const c of item.claims ?? []) {
      if (looksLikeInvestmentAdvice(c.text)) {
        unverified.push({ text: c.text, sourceId: c.sourceId, reason: "Removed: investment advice is out of scope." });
        continue;
      }
      const check = quoteIsSupported({ sourceId: c.sourceId, quote: c.quote }, retrieved);
      if (!check.ok) {
        unverified.push({ text: c.text, sourceId: c.sourceId, reason: check.reason ?? "Unsupported." });
        continue;
      }
      const citing = retrieved.get(c.sourceId)!;
      const outlets = new Set([outletOf(citing)]);
      const supportingSourceIds = [c.sourceId];
      for (const extra of c.corroboration ?? []) {
        const extraCheck = quoteIsSupported(extra, retrieved);
        const extraSource = retrieved.get(extra.sourceId);
        if (extraCheck.ok && extraSource && !outlets.has(outletOf(extraSource))) {
          outlets.add(outletOf(extraSource));
          supportingSourceIds.push(extra.sourceId);
        }
      }
      claims.push({
        text: c.text,
        quote: c.quote,
        sourceId: c.sourceId,
        similarity: Math.round(check.similarity * 100) / 100,
        independentSources: outlets.size,
        supportingSourceIds,
        labels: claimLabels(c.text, citing, outlets.size),
      });
    }

    for (const d of item.disagreements ?? []) {
      const positions = d.positions
        .filter((p) => quoteIsSupported(p, retrieved).ok)
        .map((p) => ({ sourceId: p.sourceId, outlet: outletOf(retrieved.get(p.sourceId)!), quote: p.quote }));
      const distinctOutlets = new Set(positions.map((p) => p.outlet));
      // Record disagreements only; never pick a side and never label a source.
      if (distinctOutlets.size >= 2) disagreements.push({ about: d.about, positions });
    }

    items.push({
      sourceId: item.sourceId,
      claims,
      whyItMatters: checkExplanation(item.whyItMatters ?? "", source, unverified),
      labels: (item.labels ?? []).slice(0, 6),
      nextQuestions: (item.nextQuestions ?? []).filter((q) => retrieved.has(q.sourceId)),
    });
  }

  for (const missing of submission.couldNotFind ?? []) {
    unverified.push({ text: missing, sourceId: "", reason: "The agent reported it could not find support for this." });
  }

  const displayedClaims = items.reduce((n, i) => n + i.claims.length, 0);
  return {
    items,
    unverified,
    disagreements,
    stats: { submittedClaims, displayedClaims, removedClaims: submittedClaims - displayedClaims },
  };
}
