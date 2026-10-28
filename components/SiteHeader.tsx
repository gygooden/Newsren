"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MarkIcon } from "./Icons";

const NAV = [
  { href: "/briefing/", label: "My briefing" },
  { href: "/technology/", label: "Research" },
  { href: "/education/", label: "Schools" },
  { href: "/industry/", label: "Jobs" },
  { href: "/finance/", label: "Money" },
  { href: "/about/", label: "How it works" },
];

export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const isCurrent = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));
  return (
    <header className="site-header">
      <div className="wide">
        <div className="masthead">
          <Link href="/" className="brand" aria-current={pathname === "/" ? "page" : undefined}>
            <MarkIcon />
            <span>My Newsren</span>
            <span className="brand-tag">AI news with receipts</span>
          </Link>
          <Link href="/watch/" className="button">
            Start a watch
          </Link>
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
