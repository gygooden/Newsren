import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wide">
        <p>
          <strong>My Newsren</strong> follows how AI is changing jobs, schools and money, from federal rules to your
          county. It never writes the news; it shows you who did.
        </p>
        <p>
          Sources: Federal Register documents (public domain) and arXiv metadata (CC0). Thank you to arXiv for use of its
          open access interoperability. Local news, outlets and reporters marked &quot;(sample)&quot; are fictional sample
          data for this proof of concept.
        </p>
        <ul className="footer-links">
          <li>
            <Link href="/about/">How it works</Link>
          </li>
          <li>
            <Link href="/review/">Editor review queue</Link>
          </li>
          <li>
            <Link href="/privacy/">Privacy</Link>
          </li>
          <li>
            <a href="https://github.com/gygooden/Newsren">Source code</a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
