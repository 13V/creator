import Link from "next/link";

import { LAST_UPDATED } from "@/lib/legal";

const PAGES = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/risks", label: "Risks" },
];

/**
 * The shell every legal page shares.
 *
 * These are the only long-form prose on the site, so they get a measure and a
 * type scale of their own rather than borrowing the dense, figure-heavy
 * treatment the product pages use. Sibling links sit at the top because
 * someone who arrives on one of these has usually been sent to find a specific
 * one, and the three are meaningless apart.
 */
export function LegalPage({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[42rem]">
      <header>
        <div className="eyebrow">Updated {LAST_UPDATED}</div>
        <h1 className="display mt-2 text-[clamp(2rem,1.5rem+2vw,2.75rem)]">{title}</h1>
        <p className="mt-3.5 text-[15px] leading-[1.62] text-[var(--color-muted)] [text-wrap:pretty]">
          {intro}
        </p>

        <nav className="mt-5 flex flex-wrap gap-2">
          {PAGES.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              data-active={href === current}
              className="pill-link"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="prose mt-9">{children}</div>
    </div>
  );
}

/**
 * A plain-language summary above the clauses it summarises.
 *
 * Not a substitute for the terms — it says so — but a page nobody reads
 * protects nobody, and the things worth knowing here are unusual enough that
 * burying them in clause 7 would be a way of not saying them.
 */
export function InShort({ points }: { points: string[] }) {
  return (
    <aside className="section-shell not-prose mb-8">
      <div className="eyebrow">In short</div>
      <ul className="mt-2.5 grid gap-2">
        {points.map((point) => (
          <li
            key={point}
            className="flex gap-2.5 text-[15px] leading-[1.55] [text-wrap:pretty]"
          >
            <span aria-hidden className="mt-[0.6em] h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--color-accent)]" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3.5 text-[13px] text-[var(--color-faint)]">
        A summary, not the agreement. The sections below are what govern.
      </p>
    </aside>
  );
}
