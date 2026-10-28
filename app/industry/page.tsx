import type { Metadata } from "next";
import { ClaimList } from "@/components/ClaimList";
import { PRODUCTS, PRODUCT_SOURCES } from "@/lib/site/data";

export const metadata: Metadata = { title: "Jobs" };

export default function IndustryPage() {
  return (
    <div className="wide">
      <div className="page-intro">
        <p className="eyebrow">Jobs · Industry Impact</p>
        <h1>AI and jobs</h1>
        <p className="lede">
          Claims about automation, layoffs and hiring, split into what the sources confirm and what is still a guess. Local
          records are sample data.
        </p>
      </div>
      <div className="grid-2">
        <section aria-labelledby="supported-h">
          <h2 id="supported-h">Supported</h2>
          <p className="muted small">Stated in a primary document or reported without hedging, with the source quoted.</p>
          <ClaimList claims={PRODUCTS.industry.supported} sources={PRODUCT_SOURCES} />
        </section>
        <section aria-labelledby="speculative-h">
          <h2 id="speculative-h">Speculative</h2>
          <p className="muted small">Hypothesis: hedged statements such as &ldquo;could&rdquo; or &ldquo;may&rdquo;. Treat as unconfirmed.</p>
          <ClaimList claims={PRODUCTS.industry.speculative} sources={PRODUCT_SOURCES} />
        </section>
      </div>
    </div>
  );
}
