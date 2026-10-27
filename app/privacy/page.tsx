import type { Metadata } from "next";
import { ClearDataButton } from "@/components/ClearDataButton";
import { LIMITS } from "@/lib/agent/limits";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="wrap">
      <h1>Privacy policy</h1>
      <p>This site has no accounts, no cookies, no analytics, no tracking scripts, no third-party fonts and does not ask for your location.</p>

      <h2>What is stored, and where</h2>
      <p>
        Your watch (topics, organizations, questions, depth and optional county), your review queue, your review decisions,
        your alert criteria and your last live briefing are stored in your browser&apos;s local storage on this device. They
        are not sent anywhere unless you run live research.
      </p>

      <h2>What is sent to the model provider, and why</h2>
      <p>
        When you press &ldquo;Run live research&rdquo; or ask a question, the site sends your watch fields and your question to
        our research service (a Cloudflare Worker). The Worker forwards only those fields, plus the text of the sources it
        retrieves, to Anthropic so the model can plan searches and quote sources. Nothing else about you is sent. Anthropic
        handles that data under its own policy: <a href="https://www.anthropic.com/legal/privacy">Anthropic privacy policy</a>.
      </p>

      <h2>The rate-limit hash</h2>
      <p>
        To limit each visitor to {LIMITS.dailyPerVisitor} live runs per day, the Worker computes a SHA-256 hash of your IP
        address combined with the date and a secret salt. Only that hash and a counter are stored, and they expire after 24
        hours. The raw IP address is not stored, and the Worker does not log request bodies.
      </p>

      <h2>Real data and sample data</h2>
      <p>
        Items labeled &ldquo;Federal Register&rdquo; are real U.S. government documents. Items labeled &ldquo;arXiv
        preprint&rdquo; are real research preprints that have not been peer reviewed. Items labeled &ldquo;Sample data&rdquo;,
        including every outlet and reporter marked &ldquo;(sample)&rdquo;, are fictional and exist only to demonstrate the
        local features.
      </p>

      <h2>Hosting providers</h2>
      <p>
        GitHub Pages serves this site and Cloudflare runs the research service. Both may log standard request data such as
        IP address and browser type. See the{" "}
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub privacy statement</a>{" "}
        and the <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare privacy policy</a>.
      </p>

      <h2>Location</h2>
      <p>Location is limited to a county you choose from a list. The site never uses your device&apos;s location.</p>

      <h2>Clear your data</h2>
      <p>This removes everything My Newsren stored in this browser.</p>
      <ClearDataButton />

      <h2>Contact</h2>
      <p>
        Questions or requests: <a href="https://github.com/gygooden/Newsren/issues">open an issue on the project repository</a>.
      </p>
    </div>
  );
}
