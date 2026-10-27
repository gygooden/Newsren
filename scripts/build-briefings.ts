// Precomputes saved briefings, story views and section products without
// calling a model. Output goes to data/generated/*.json and is the default
// view on the site and the fallback when live research is unavailable.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildSavedBriefing } from "../lib/agent/deterministic";
import { buildStoryView } from "../lib/agent/learn";
import { buildProducts } from "../lib/agent/products";
import { buildStories } from "../lib/agent/stories";
import type { SourceRecord, Watch } from "../lib/agent/types";
import { sha256Hex } from "../lib/agent/util";

const read = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;

async function main() {
  // Fill provenance hashes on the sample data so every record carries one.
  const samplePath = "data/sample/local-news.json";
  const sample = read<SourceRecord[]>(samplePath);
  let changed = false;
  for (const r of sample) {
    const hash = await sha256Hex(`${r.title}\n${r.text}`);
    if (r.provenance.contentHash !== hash) {
      r.provenance.contentHash = hash;
      r.provenance.retrievedAt = r.provenance.retrievedAt || `${r.provenance.publishedAt}T00:00:00Z`;
      changed = true;
    }
  }
  if (changed) writeFileSync(samplePath, JSON.stringify(sample, null, 2) + "\n");

  const real = [...read<SourceRecord[]>("data/real/federal-register.json"), ...read<SourceRecord[]>("data/real/arxiv.json")];
  const corpus = [...real, ...sample];
  const generatedAt = new Date().toISOString();

  const watches = read<{ id: string; name: string; watch: Watch }[]>("config/sample-watches.json");
  const briefings = watches.map((w) => ({
    sampleWatchId: w.id,
    name: w.name,
    briefing: buildSavedBriefing(`saved-${w.id}`, w.watch, corpus, generatedAt),
  }));

  const byId = new Map(corpus.map((r) => [r.id, r]));
  const stories = buildStories(corpus)
    .map((s) => buildStoryView(s, byId, corpus))
    // A story needs at least one sample or primary record to be useful here.
    .filter((s) => s.timeline.some((id) => byId.get(id)?.kind === "sample"));
  const storySources: Record<string, SourceRecord> = {};
  for (const s of stories) for (const id of s.sourceIds) storySources[id] = byId.get(id)!;

  const products = buildProducts(real, sample);
  const productSources: Record<string, SourceRecord> = {};
  const productIds = [
    ...products.decoder.map((d) => d.sourceId),
    ...products.policy.map((p) => p.sourceId),
    ...products.finance.regulations.map((p) => p.sourceId),
    ...(products.evidence ? [products.evidence.sourceId] : []),
    ...[...products.industry.supported, ...products.industry.speculative, ...products.finance.realityCheck].flatMap((c) => c.supportingSourceIds),
  ];
  for (const id of productIds) productSources[id] = byId.get(id)!;

  mkdirSync("data/generated", { recursive: true });
  writeFileSync("data/generated/briefings.json", JSON.stringify({ generatedAt, briefings }, null, 1) + "\n");
  writeFileSync("data/generated/stories.json", JSON.stringify({ generatedAt, stories, sources: storySources }, null, 1) + "\n");
  writeFileSync("data/generated/products.json", JSON.stringify({ generatedAt, products, sources: productSources }, null, 1) + "\n");

  console.log(`Saved briefings: ${briefings.length}`);
  for (const b of briefings) {
    const claims = b.briefing.items.reduce((n, i) => n + i.claims.length, 0);
    console.log(`  ${b.sampleWatchId}: ${b.briefing.items.length} items, ${claims} claims, ${b.briefing.gaps.length} gaps, ${b.briefing.beyond.length} beyond, ${b.briefing.disagreements.length} disagreements`);
  }
  console.log(`Stories: ${stories.map((s) => s.id).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
