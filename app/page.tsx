import Link from "next/link";
import { FrontStories } from "@/components/FrontStories";
import { STORIES } from "@/lib/site/data";

const SECTIONS = [
  { href: "/technology/", name: "Technology", product: "Research Paper Decoder for arXiv preprints" },
  { href: "/education/", name: "Education", product: "Policy Impact Explorer and Education Evidence Checker" },
  { href: "/industry/", name: "Industry", product: "Industry Impact view: supported findings and labeled hypotheses" },
  { href: "/finance/", name: "Finance", product: "Regulation Watch and an AI-in-finance reality check" },
];

export default function Home() {
  return (
    <div className="wide">
      <h1>My Newsren</h1>
      <p style={{ maxWidth: "var(--measure)" }}>
        A personal research desk for the news. It finds reporting and primary documents on what you follow, quotes them,
        and shows what it could not verify. It does not write news stories.
      </p>
      <p>
        <Link href="/watch/" className="button">
          Follow a question
        </Link>
      </p>

      <section aria-labelledby="approved-heading">
        <h2 id="approved-heading">Recent stories approved in review</h2>
        <FrontStories />
      </section>

      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading">Sections</h2>
        <ul className="grid-2" style={{ listStyle: "none", padding: 0 }}>
          {SECTIONS.map((s) => (
            <li key={s.href} className="card">
              <h3 style={{ marginTop: 0 }}>
                <Link href={s.href}>{s.name}</Link>
              </h3>
              <p>{s.product}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="all-stories">
        <h2 id="all-stories">All stories in the current snapshot</h2>
        <p className="muted">Not editor-reviewed. Each story groups records that share a topic tag.</p>
        <ul>
          {STORIES.map((s) => (
            <li key={s.id}>
              <Link href={`/story/${s.id}/`}>{s.title}</Link> <span className="muted small">({s.timeline.length} records)</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
