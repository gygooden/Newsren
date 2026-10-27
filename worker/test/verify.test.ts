import { describe, expect, it } from "vitest";
import sample from "../../data/sample/local-news.json";
import type { SourceRecord } from "../../lib/agent/types";
import { quoteSimilarity, verifySubmission } from "../../lib/agent/verify";

const records = sample as unknown as SourceRecord[];
const byId = new Map(records.map((r) => [r.id, r]));
const retrieved = new Map(["sc-warn-orchard", "sc-art-orchard-ledger", "sc-art-orchard-courier"].map((id) => [id, byId.get(id)!]));

describe("verify.ts", () => {
  it("keeps a claim whose quote appears in retrieved text", () => {
    const out = verifySubmission(
      { items: [{ sourceId: "sc-warn-orchard", whyItMatters: "", claims: [{ text: "214 employees", quote: "reporting a layoff affecting 214 employees", sourceId: "sc-warn-orchard" }] }] },
      retrieved,
    );
    expect(out.items[0].claims).toHaveLength(1);
    expect(out.unverified).toHaveLength(0);
  });

  it("accepts small differences above the 0.85 threshold", () => {
    expect(quoteSimilarity("reporting a lay-off affecting 214 employes", byId.get("sc-warn-orchard")!.text)).toBeGreaterThanOrEqual(0.85);
  });

  it("removes a claim whose quote is not in the retrieved text", () => {
    const out = verifySubmission(
      { items: [{ sourceId: "sc-warn-orchard", whyItMatters: "", claims: [{ text: "Plant closes", quote: "the company will close the San Jose plant entirely", sourceId: "sc-warn-orchard" }] }] },
      retrieved,
    );
    expect(out.items[0].claims).toHaveLength(0);
    expect(out.unverified[0].reason).toMatch(/not found/);
  });

  it("removes a claim citing a source that was never retrieved", () => {
    const out = verifySubmission(
      {
        items: [
          { sourceId: "sc-warn-orchard", whyItMatters: "", claims: [{ text: "x", quote: "Item 7.2: Approve a one-semester pilot", sourceId: "sc-board-tutor" }] },
          { sourceId: "never-retrieved", whyItMatters: "", claims: [{ text: "y", quote: "anything at all goes here", sourceId: "never-retrieved" }] },
        ],
      },
      retrieved,
    );
    expect(out.items.flatMap((i) => i.claims)).toHaveLength(0);
    expect(out.items.map((i) => i.sourceId)).not.toContain("never-retrieved");
    expect(out.unverified.every((u) => /never retrieved/.test(u.reason))).toBe(true);
  });

  it("records a disagreement without picking a side", () => {
    const out = verifySubmission(
      {
        items: [
          {
            sourceId: "sc-art-orchard-ledger",
            whyItMatters: "",
            claims: [],
            disagreements: [
              {
                about: "Job count",
                positions: [
                  { sourceId: "sc-art-orchard-ledger", quote: "will cut about 240 jobs in San Jose" },
                  { sourceId: "sc-art-orchard-courier", quote: "affects 180 positions, according to a company memo" },
                ],
              },
            ],
          },
        ],
      },
      retrieved,
    );
    expect(out.disagreements).toHaveLength(1);
    expect(out.disagreements[0].positions).toHaveLength(2);
  });

  it("strips investment advice and unsupported figures from explanations", () => {
    const out = verifySubmission(
      { items: [{ sourceId: "sc-warn-orchard", claims: [], whyItMatters: "This matters for local workers. You should buy shares of the stock now. About 900 people will move." }] },
      retrieved,
    );
    expect(out.items[0].whyItMatters).toBe("This matters for local workers.");
    expect(out.unverified).toHaveLength(2);
  });
});
