"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ConnectButton } from "@/components/ConnectButton";
import {
  CompassIcon,
  HomeIcon,
  PlusIcon,
  TrophyIcon,
  WalletIcon,
} from "@/components/icons";

type Item = {
  href: string;
  label: string;
  Icon: (props: { className?: string; filled?: boolean }) => ReactNode;
};

const NAV: Item[] = [
  { href: "/", label: "Board", Icon: HomeIcon },
  { href: "/explore", label: "Explore", Icon: CompassIcon },
  { href: "/leaderboard", label: "Earning", Icon: TrophyIcon },
  { href: "/claim", label: "Claim", Icon: WalletIcon },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

/**
 * Persistent left rail, the way every social app anchors navigation on
 * desktop. Kept out of the scroll container so the feed can run long.
 */
export function Sidebar() {
  const isActive = useActive();

  return (
    <aside className="rail sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col gap-1 px-3 py-5 md:flex xl:w-[232px] xl:px-4">
      <Link href="/" className="mb-4 flex items-center gap-2.5 px-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-accent)] text-base font-black text-[var(--color-accent-ink)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.7),0_6px_16px_-6px_rgb(27_111_184_/_0.7)]">
          ✦
        </span>
        <span className="hidden font-semibold tracking-tight xl:block">
          creator<span className="text-[var(--color-faint)]">.fun</span>
        </span>
      </Link>

      {NAV.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={`flex items-center gap-3.5 rounded-xl px-2.5 py-2.5 transition ${
              active
                ? "bg-[var(--wash)] text-[var(--color-fg)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.9),0_3px_8px_-4px_rgb(56_66_92_/_0.28)]"
                : "text-[var(--color-muted)] hover:bg-[var(--wash-soft)] hover:text-[var(--color-fg)]"
            }`}
          >
            <Icon filled={active} />
            <span className={`hidden text-[15px] xl:block ${active ? "font-semibold" : ""}`}>
              {label}
            </span>
          </Link>
        );
      })}

      <Link
        href="/launch"
        title="Launch a coin"
        className="btn-primary mt-3 flex items-center justify-center gap-2 rounded-xl px-2.5 py-3"
      >
        <PlusIcon />
        <span className="hidden text-[15px] xl:block">Launch</span>
      </Link>

      <div className="mt-auto hidden xl:block">
        <ConnectButton />
      </div>
    </aside>
  );
}

/** Slim bar carrying the wallet on small screens, where the rail is hidden. */
export function MobileTopBar() {
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--glass-edge)] bg-[rgb(255_255_255_/_0.62)] px-4 backdrop-blur-xl backdrop-saturate-[180%] md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-accent)] text-sm font-black text-[var(--color-accent-ink)]">
          ✦
        </span>
        <span className="font-semibold tracking-tight">
          creator<span className="text-[var(--color-faint)]">.fun</span>
        </span>
      </Link>
      <ConnectButton />
    </div>
  );
}

/**
 * Thumb-reachable tab bar with the compose action in the middle, which is
 * where Instagram and TikTok both put it.
 */
export function BottomTabs() {
  const isActive = useActive();
  const [feed, explore, earning, claim] = NAV;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[var(--glass-edge)] bg-[rgb(255_255_255_/_0.7)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-[180%] md:hidden">
      {[feed, explore].map(({ href, label, Icon }) => (
        <Tab key={href} href={href} label={label} Icon={Icon} active={isActive(href)} />
      ))}

      <Link
        href="/launch"
        aria-label="Launch a coin"
        className="btn-primary grid h-11 w-14 place-items-center rounded-xl"
      >
        <PlusIcon />
      </Link>

      {[earning, claim].map(({ href, label, Icon }) => (
        <Tab key={href} href={href} label={label} Icon={Icon} active={isActive(href)} />
      ))}
    </nav>
  );
}

function Tab({
  href,
  label,
  Icon,
  active,
}: Item & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] transition ${
        active ? "text-[var(--color-fg)]" : "text-[var(--color-faint)]"
      }`}
    >
      <Icon filled={active} />
      {label}
    </Link>
  );
}
