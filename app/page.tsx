import Link from "next/link";
import type { ReactNode } from "react";
import { FrontStories } from "@/components/FrontStories";
import { JobsIcon, MoneyIcon, ResearchIcon, SchoolIcon } from "@/components/Icons";
import { STORIES } from "@/lib/site/data";

const SECTIONS: { href: string; name: string; blurb: string; icon: ReactNode }[] = [
  { href: "/industry/", name: "Jobs", blurb: "Layoffs, automation and hiring: what is confirmed and what is only a guess.", icon: <JobsIcon /> },
  { href: "/education/", name: "Schools", blurb: "New federal rules in plain terms, and whether AI tutoring studies show real learning.", icon: <SchoolIcon /> },
  { href: "/finance/", name: "Money", blurb: "Banking and lending rules, and AI claims sorted from announcement to live use.", icon: <MoneyIcon /> },
  { href: "/technology/", name: "Research", blurb: "New AI papers decoded: what they tested, found and left out.", icon: <ResearchIcon /> },
];

export default function Home() {
  return (
    <div className="wide">
      <section className="hero" aria-labelledby="hero-heading">
        <p className="eyebrow">AI news with receipts</p>
        <h1 id="hero-heading">
          What is AI changing <mark>where you live?</mark>
        </h1>
        <p className="lede">
          Follow how AI is reshaping jobs, schools and money, from Washington down to your county. Every line in your
          briefing comes with a receipt: the exact quote and a link to the reporter or agency who wrote it.
        </p>
        <div className="button-row">
          <Link href="/watch/" className="button">
            Start a watch
          </Link>
          <Link href="/briefing/" className="button secondary">
            See a sample briefing
          </Link>
        </div>
        <ol className="steps">
          <li>
            <strong>Pick what you care about</strong>
            Topics, a county, a question. Saved only in your browser.
          </li>
          <li>
            <strong>The agent digs</strong>
            It searches federal documents, research and local news.
          </li>
          <li>
            <strong>You get receipts</strong>
            Quoted sources, plus a list of what it could not verify.
          </li>
        </ol>
      </section>

      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading">Pick a beat</h2>
        <ul className="grid-4 plain-list">
          {SECTIONS.map((s) => (
            <li key={s.href} className="card">
              <Link href={s.href} className="topic-card">
                <span className="topic-icon">{s.icon}</span>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.blurb}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="approved-heading">
        <h2 id="approved-heading">Checked by an editor</h2>
        <FrontStories />
      </section>

      <section aria-labelledby="all-stories">
        <h2 id="all-stories">More stories</h2>
        <p className="muted">Grouped automatically by topic. Not yet checked by an editor.</p>
        <ul className="story-links">
          {STORIES.map((s) => (
            <li key={s.id}>
              <Link href={`/story/${s.id}/`}>{s.title}</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
