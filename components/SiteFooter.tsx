import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wide">
        <p>
          Data: Federal Register documents (public domain U.S. government works) and arXiv metadata (CC0). Local news,
          outlets and reporters marked &quot;(sample)&quot; are fictional sample data.
        </p>
        <p>Thank you to arXiv for use of its open access interoperability.</p>
        <p>
          <Link href="/privacy/">Privacy policy</Link> · <Link href="/about/">How the agent works and its limits</Link>
        </p>
      </div>
    </footer>
  );
}
