import type { Metadata } from "next";
import { ClaimList } from "@/components/ClaimList";
import { PRODUCTS, PRODUCT_SOURCES } from "@/lib/site/data";

export const metadata: Metadata = { title: "Industry" };

export default function IndustryPage() {
  return (
    <div className="wide">
      <h1>Industry</h1>
      <h2>Industry Impact view</h2>
      <p style={{ maxWidth: "var(--measure)" }}>
        Claims about automation and jobs from local records, sorted by evidence. Each claim names the source it quotes. Local records are sample data.
      </p>
      <div className="grid-2">
        <section aria-labelledby="supported-h">
          <h3 id="supported-h">Supported</h3>
          <p className="muted small">Stated in a primary document or reported without hedging, with the source quoted.</p>
          <ClaimList claims={PRODUCTS.industry.supported} sources={PRODUCT_SOURCES} />
        </section>
        <section aria-labelledby="speculative-h">
          <h3 id="speculative-h">Speculative</h3>
          <p className="muted small">Hypothesis: hedged statements such as &ldquo;could&rdquo; or &ldquo;may&rdquo;. Treat as unconfirmed.</p>
          <ClaimList claims={PRODUCTS.industry.speculative} sources={PRODUCT_SOURCES} />
        </section>
      </div>
    </div>
  );
}
