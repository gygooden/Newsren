"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarkIcon } from "./Icons";

const NAV = [
  { href: "/", label: "Front page" },
  { href: "/technology/", label: "Technology" },
  { href: "/education/", label: "Education" },
  { href: "/industry/", label: "Industry" },
  { href: "/finance/", label: "Finance" },
  { href: "/watch/", label: "Follow a question" },
  { href: "/briefing/", label: "My briefing" },
  { href: "/review/", label: "Review queue" },
  { href: "/about/", label: "Methodology" },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));
  return (
    <header className="site-header">
      <div className="wide">
        <div className="masthead">
          <Link href="/" className="brand">
            <MarkIcon />
            <span>My Newsren</span>
          </Link>
          <span className="muted small">Course proof of concept. Local news shown here is sample data.</span>
        </div>
        <nav aria-label="Main">
          <ul className="nav-list">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={isCurrent(n.href) ? "page" : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
