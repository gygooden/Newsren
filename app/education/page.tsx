import type { Metadata } from "next";
import { PolicyCard } from "@/components/PolicyCard";
import { SourceReport } from "@/components/SourceReport";
import { PRODUCTS, PRODUCT_SOURCES } from "@/lib/site/data";

export const metadata: Metadata = { title: "Schools" };

export default function EducationPage() {
  const ev = PRODUCTS.evidence;
  const study = ev ? PRODUCT_SOURCES[ev.sourceId] : undefined;
  return (
    <div className="wrap">
      <div className="page-intro">
        <p className="eyebrow">Schools</p>
        <h1>AI and schools</h1>
        <p className="lede">New federal education rules in plain terms, and a reality check on whether AI tutoring helps students learn.</p>
      </div>
      <h2>Policy Impact Explorer</h2>
      <p>
        Recent Department of Education documents from the Federal Register: who is affected, what changes and when. Quoted
        fields come from the document summary; read the full document for scope and obligations.
      </p>
      {PRODUCTS.policy.map((p) => (PRODUCT_SOURCES[p.sourceId] ? <PolicyCard key={p.sourceId} p={p} record={PRODUCT_SOURCES[p.sourceId]} /> : null))}

      <h2>Education Evidence Checker</h2>
      {ev && study ? (
        <>
          <p>
            One sample study, checked for who was studied, what was measured and what it was compared with. It separates
            faster completion from transfer to new problems, because they are different outcomes.
          </p>
          <SourceReport record={study} heading="h3" />
          <dl className="facts">
            <dt>Population studied</dt>
            <dd>{ev.study.population}</dd>
            <dt>Outcome measured</dt>
            <dd>{ev.study.outcome}</dd>
            <dt>Comparison group</dt>
            <dd>{ev.study.comparison}</dd>
            <dt>Limitations</dt>
            <dd>{ev.study.limitations}</dd>
            <dt>Faster completion</dt>
            <dd>
              <q>{ev.study.fasterCompletion}</q>
            </dd>
            <dt>Transfer to new problems</dt>
            <dd>
              <q>{ev.study.transfer}</q>
            </dd>
          </dl>
          <p className="notice">
            Finishing work faster is not the same as learning that transfers. In this sample study, students finished
            faster but did not do better on unfamiliar problems.
          </p>
        </>
      ) : (
        <p>No study available.</p>
      )}
    </div>
  );
}
