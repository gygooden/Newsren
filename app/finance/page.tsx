import type { Metadata } from "next";
import { ClaimList } from "@/components/ClaimList";
import { FinanceNotice } from "@/components/FinanceNotice";
import { PolicyCard } from "@/components/PolicyCard";
import { FINANCE_STATUSES } from "@/lib/agent/labels";
import { PRODUCTS, PRODUCT_SOURCES } from "@/lib/site/data";

export const metadata: Metadata = { title: "Finance" };

export default function FinancePage() {
  return (
    <div className="wrap">
      <h1>Finance</h1>
      <FinanceNotice />
      <h2>Regulation Watch</h2>
      <p>
        Recent Federal Register documents from the SEC, the banking agencies and the CFPB: who is affected, what changes and
        when.
      </p>
      {PRODUCTS.finance.regulations.map((p) => (PRODUCT_SOURCES[p.sourceId] ? <PolicyCard key={p.sourceId} p={p} record={PRODUCT_SOURCES[p.sourceId]} /> : null))}

      <h2>AI-in-finance reality check</h2>
      <p>
        Claims about AI in lending and banking, sorted by how far along they are: {FINANCE_STATUSES.join(", ")}. Local
        records are sample data about fictional institutions.
      </p>
      {FINANCE_STATUSES.map((s) => {
        const claims = PRODUCTS.finance.realityCheck.filter((c) => c.status === s);
        if (!claims.length) return null;
        return (
          <section key={s} aria-labelledby={`fs-${s.replace(/\s/g, "-")}`}>
            <h3 id={`fs-${s.replace(/\s/g, "-")}`}>{s}</h3>
            <ClaimList claims={claims} sources={PRODUCT_SOURCES} />
          </section>
        );
      })}
      <FinanceNotice />
    </div>
  );
}
