import type { Metadata } from "next";
import { DOCUMENT_TYPE_WEIGHTS } from "@/lib/agent/beyond";
import { LIMITS } from "@/lib/agent/limits";
import { GOAL } from "@/lib/agent/orchestrator";
import { MIN_SIMILARITY } from "@/lib/agent/verify";

export const metadata: Metadata = { title: "Methodology" };

export default function AboutPage() {
  return (
    <div className="wrap">
      <h1>Methodology</h1>

      <h2>Goal</h2>
      <p>The agent has one goal: &ldquo;{GOAL}&rdquo; It finds, links, verifies and explains reporting and documents. It never writes news stories.</p>

      <h2>Tools</h2>
      <p>The model can call exactly five tools. It decides which to call, in what order, until it submits or reaches a limit.</p>
      <dl className="facts">
        <dt>search_federal_register</dt>
        <dd>Searches rules, proposed rules and notices through the Federal Register API.</dd>
        <dt>search_arxiv</dt>
        <dd>Searches arXiv preprints, at most 10 results per request and at least 3 seconds between requests.</dd>
        <dt>search_local</dt>
        <dd>Searches the bundled sample local news and documents for one county.</dd>
        <dt>get_document</dt>
        <dd>Returns the full stored text of an item already retrieved in the same run.</dd>
        <dt>submit_briefing</dt>
        <dd>Submits items, each with claims, exact quotes, source IDs, an explanation, labels and next questions.</dd>
      </dl>

      <h2>Limits</h2>
      <ul>
        <li>{LIMITS.dailyPerVisitor} live runs per visitor per day, and {LIMITS.dailyGlobal} across all visitors.</li>
        <li>At most {LIMITS.maxSteps} model steps and {LIMITS.maxToolCalls} tool calls per run.</li>
        <li>At most {LIMITS.maxTokensPerCall.toLocaleString("en-US")} output tokens per model call, and {LIMITS.tokenBudgetPerRun.toLocaleString("en-US")} input plus output tokens per run.</li>
        <li>A {LIMITS.timeoutMs / 1000}-second time limit per run.</li>
        <li>Questions of at most {LIMITS.maxQuestionChars} characters, topics from a fixed list, counties from a fixed list.</li>
      </ul>
      <p>When a limit is reached, the site shows the most recent saved briefing instead.</p>

      <h2>Verification</h2>
      <p>
        After the model submits, deterministic code checks every claim. Its quote must appear in text retrieved during
        the same run, after normalizing case, punctuation and spacing, with a similarity of at least {MIN_SIMILARITY}.
        Quotes shorter than four words never count. Claims that fail, and anything citing a source that was never
        retrieved, are removed and listed under &ldquo;What we could not verify&rdquo;. Explanations that introduce a
        figure not found in the source, or that read as investment advice, are removed too.
      </p>
      <p>
        Independent sources are counted by outlet or agency: two articles from one outlet count once. When outlets
        disagree, both positions are shown with quotes. The system compares claims; it never labels a source as biased.
      </p>

      <h2>Labels</h2>
      <ul>
        <li>Source: Federal Register, arXiv preprint, or Sample data.</li>
        <li>Finance claims: Announcement, Pilot, Backtest, Live deployment, or Regulatory finding.</li>
        <li>Impact: Supported (from a primary document or a quoted report) or Speculative (hedged language such as &ldquo;could&rdquo; or &ldquo;may&rdquo;).</li>
        <li>Research: Preprint, not peer reviewed; or Peer reviewed.</li>
        <li>Forecasts: always labeled Projection.</li>
      </ul>

      <h2 id="significance">The significance score for &ldquo;Beyond your watch&rdquo;</h2>
      <p>Each candidate outside your topics gets a score that is the sum of three parts. Engagement data is never used.</p>
      <dl className="facts">
        <dt>Local impact</dt>
        <dd>3 if it concerns the county you chose, 1 if it is a federal document that applies nationally, otherwise 0.</dd>
        <dt>Independent sources</dt>
        <dd>The number of distinct outlets or agencies with records on the same topic tag, up to 3. Opinion pieces do not count.</dd>
        <dt>Document type</dt>
        <dd>
          {Object.entries(DOCUMENT_TYPE_WEIGHTS)
            .map(([k, v]) => `${k} ${v}`)
            .join("; ")}
          .
        </dd>
      </dl>
      <p>The one or two highest-scoring items are shown, each with its reason.</p>

      <h2>Coverage Gap Detector</h2>
      <p>
        A primary document (a Federal Register item or a sample local document) with no matching news item in the sources
        checked is labeled &ldquo;Not yet reported by a journalist&rdquo;. The system drafts a short tip for a partner
        newsroom. It does not write a story.
      </p>

      <h2>Editorial control</h2>
      <p>
        Live briefings go only to the reader who asked, labeled &ldquo;Personal briefing, not editor-reviewed&rdquo;. Nothing
        appears on the front page until a person approves it in the review queue.
      </p>

      <h2>Known limitations</h2>
      <ul>
        <li>Local news is fictional sample data. No free, key-free source of local reporting was available.</li>
        <li>Quote matching checks that words appear in a source, not that the claim sentence fairly represents them. Editors still need to read the original.</li>
        <li>Topic tags come from keyword matching and can miss or mislabel items.</li>
        <li>The rate-limit counters use Cloudflare KV, which is eventually consistent, so a burst of simultaneous requests could slightly exceed a limit. The Anthropic Console spend limit is the final safeguard.</li>
        <li>The review queue and alerts are stored per browser. A shared queue and real-time alerts are future work.</li>
      </ul>
    </div>
  );
}
