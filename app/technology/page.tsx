import type { Metadata } from "next";
import { SourceReport } from "@/components/SourceReport";
import { NOT_STATED_ABSTRACT, type PaperField } from "@/lib/agent/products";
import { PRODUCTS, PRODUCT_SOURCES } from "@/lib/site/data";

export const metadata: Metadata = { title: "Research" };

const FIELDS: [PaperField, string][] = [
  ["hypothesis", "Hypothesis"],
  ["method", "Method"],
  ["findings", "Findings"],
  ["limitations", "Limitations"],
  ["applications", "Applications"],
];

export default function TechnologyPage() {
  return (
    <div className="wrap">
      <div className="page-intro">
        <p className="eyebrow">Research · Paper Decoder</p>
        <h1>New AI research, decoded</h1>
        <p className="lede">
          What each new paper tested, found and left out, quoted straight from its abstract. If the abstract does not say,
          we say &ldquo;{NOT_STATED_ABSTRACT}&rdquo;. These are preprints and have not been peer reviewed.
        </p>
      </div>
      {PRODUCTS.decoder.length === 0 && <p>No preprints in the current snapshot.</p>}
      {PRODUCTS.decoder.map((d) => {
        const r = PRODUCT_SOURCES[d.sourceId];
        if (!r) return null;
        return (
          <article key={d.sourceId} className="card">
            <SourceReport record={r} heading="h3" />
            <dl className="facts">
              {FIELDS.map(([key, label]) => (
                <div key={key} style={{ display: "contents" }}>
                  <dt>{label}</dt>
                  <dd>{d.fields[key] ? <q>{d.fields[key]}</q> : <span className="muted">{NOT_STATED_ABSTRACT}</span>}</dd>
                </div>
              ))}
            </dl>
          </article>
        );
      })}
    </div>
  );
}
