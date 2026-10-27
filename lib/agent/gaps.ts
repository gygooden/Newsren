import { entityLabel, specificEntities } from "./entities";
import { COUNTIES, type Gap, type SourceRecord } from "./types";
import { isNewsArticle, isPrimaryDocument, sourceLabel, docTypePhrase } from "./util";

// Coverage Gap Detector. Flags primary documents with no matching news item
// in the sources checked, and drafts a tip for a partner newsroom.
// It never writes a story.

function isCovered(doc: SourceRecord, articles: SourceRecord[]): boolean {
  if (doc.subject) return articles.some((a) => a.subject === doc.subject);
  const docEntities = new Set(specificEntities(doc.entities));
  return articles.some((a) => {
    if (doc.county && a.county && a.county !== doc.county) return false;
    return specificEntities(a.entities).some((e) => docEntities.has(e));
  });
}

export function draftTip(doc: SourceRecord): string {
  const where = doc.county ? COUNTIES[doc.county].name : "readers nationally";
  const topic = specificEntities(doc.entities).map(entityLabel)[0] ?? "this topic";
  const deadline = doc.commentDeadline ? ` Public comments close on ${doc.commentDeadline}.` : "";
  return (
    `Tip for a partner newsroom: a ${docTypePhrase(doc.docType)} titled "${doc.title}" ` +
    `(${sourceLabel(doc)}, ${doc.provenance.publishedAt}) has no matching news coverage in the sources we checked. ` +
    `Topic: ${topic}. Possible reporting question: who in ${where} is affected, and how?${deadline}`
  );
}

export function findGaps(candidates: SourceRecord[], allRecords: SourceRecord[]): Gap[] {
  const articles = allRecords.filter(isNewsArticle);
  const seen = new Set<string>();
  const gaps: Gap[] = [];
  for (const doc of candidates) {
    if (!isPrimaryDocument(doc) || seen.has(doc.id)) continue;
    seen.add(doc.id);
    if (specificEntities(doc.entities).length === 0) continue;
    if (!isCovered(doc, articles)) {
      gaps.push({ sourceId: doc.id, label: "Not yet reported by a journalist", tip: draftTip(doc) });
    }
  }
  return gaps;
}
