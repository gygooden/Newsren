// Fetches a small snapshot of Federal Register and arXiv items into data/real/.
// If a source cannot be reached, the last committed snapshot is kept.
// Set NEWSREN_OFFLINE=1 to simulate a network failure.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { searchArxiv, searchFederalRegister, type FetchLike } from "../lib/agent/sources";
import type { SourceRecord } from "../lib/agent/types";

const offline = process.env.NEWSREN_OFFLINE === "1";
const fetchImpl: FetchLike = offline
  ? async () => {
      throw new Error("offline (NEWSREN_OFFLINE=1)");
    }
  : (input, init) => fetch(input, init);

const since = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

const FR_QUERIES = [
  { query: "artificial intelligence", agencies: ["education-department"], since },
  { query: "artificial intelligence", agencies: ["securities-and-exchange-commission"], since },
  { query: "artificial intelligence", agencies: ["federal-trade-commission"], since },
  { query: "artificial intelligence", agencies: ["labor-department", "equal-employment-opportunity-commission"], since },
  {
    query: "model risk OR artificial intelligence",
    agencies: ["comptroller-of-the-currency", "federal-deposit-insurance-corporation", "federal-reserve-system", "consumer-financial-protection-bureau"],
    since,
  },
];

const ARXIV_QUERIES = [
  { query: "tutoring students learning", categories: ["cs.CY", "cs.AI"] },
  { query: "large language models labor market", categories: ["cs.CY", "econ.GN"] },
  { query: "machine learning credit finance", categories: ["q-fin.GN", "cs.AI"] },
];

function dedupe(records: SourceRecord[]): SourceRecord[] {
  return [...new Map(records.map((r) => [r.id, r])).values()];
}

async function collect<Q>(name: string, queries: Q[], run: (q: Q) => Promise<SourceRecord[]>): Promise<SourceRecord[] | null> {
  const out: SourceRecord[] = [];
  let failures = 0;
  for (const q of queries) {
    try {
      const got = await run(q);
      out.push(...got.slice(0, 10));
    } catch (err) {
      failures++;
      console.warn(`  ${name}: query failed (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  return failures === queries.length ? null : dedupe(out);
}

function save(path: string, label: string, records: SourceRecord[] | null) {
  if (records && records.length) {
    writeFileSync(path, JSON.stringify(records, null, 2) + "\n");
    console.log(`${label}: saved ${records.length} items to ${path}`);
    return;
  }
  if (existsSync(path)) {
    const kept = JSON.parse(readFileSync(path, "utf8")) as SourceRecord[];
    console.log(`${label}: fetch failed, keeping last snapshot (${kept.length} items)`);
  } else {
    writeFileSync(path, "[]\n");
    console.log(`${label}: fetch failed and no snapshot exists; wrote an empty list`);
  }
}

async function main() {
  console.log(offline ? "Ingest (simulated offline)" : "Ingest");
  const fr = await collect("Federal Register", FR_QUERIES, (q) => searchFederalRegister({ ...q, perPage: 6 }, fetchImpl));
  save("data/real/federal-register.json", "Federal Register", fr);
  const ax = await collect("arXiv", ARXIV_QUERIES, (q) => searchArxiv({ ...q, maxResults: 6 }, fetchImpl));
  save("data/real/arxiv.json", "arXiv", ax);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
