"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ConnectButton } from "@/components/ConnectButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatSol, formatUsd } from "@/components/ui";
import {
  CompassIcon,
  HomeIcon,
  Mark,
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
 * desktop. Kept out of the scroll container so the feed can run long, and
 * inset from the window edge so it reads as a floating sheet rather than as a
 * ruled-off column of chrome.
 */
export function Sidebar() {
  const isActive = useActive();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[100px] shrink-0 self-start p-3 md:block xl:w-[256px]">
      <div className="rail flex h-full flex-col gap-[3px] px-[11px] py-3.5">
        <Link
          href="/"
          className="mb-3.5 flex items-center gap-2.5 px-[7px] py-1.5"
          style={{ perspective: "260px" }}
        >
          <Logo />
          <span className="hidden whitespace-nowrap text-[15px] font-semibold tracking-tight xl:block">
            Backd
          </span>
        </Link>

        {NAV.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            data-active={isActive(href)}
            className="rail-item"
          >
            <Icon filled={isActive(href)} />
            <span className="hidden whitespace-nowrap text-[15px] xl:block">{label}</span>
          </Link>
        ))}

        <Link
          href="/launch"
          title="Launch a coin"
          className="btn-primary mt-3 flex items-center justify-center gap-2 !rounded-2xl px-2.5 py-3"
        >
          <PlusIcon />
          <span className="hidden whitespace-nowrap text-[15px] xl:block">Launch</span>
        </Link>

        <WaitingBlock />
        <RailStat />
        <RailStickers />

        {/*
          Between 768px and 1280px the rail is icon-only and the mobile bar is
          already hidden, so without this the wallet control disappears
          entirely at tablet widths. Passing children overrides the adapter's
          own label, which is the only way to get a button narrow enough to fit
          the compact rail.
        */}
        <div data-rail="compact" className="mt-auto grid gap-2 xl:hidden">
          <ThemeToggle compact />
          <div className="grid place-items-center">
            <ConnectButton>
              <WalletIcon className="h-[18px] w-[18px]" />
            </ConnectButton>
          </div>
        </div>
        <div data-rail="wide" className="mt-auto hidden gap-2.5 xl:grid">
          <MainnetFlag />
          <ThemeToggle />
          <ConnectButton />
        </div>
      </div>
    </aside>
  );
}

/**
 * The mark, unenclosed. It sat in a glossy blue rounded-square before — the
 * app-icon treatment every generated site gives its logo — which made the
 * shape inside unreadable at 28px and looked like a sticker on the page.
 */
function Logo({ size = 30 }: { size?: number }) {
  return <Mark size={size} className="mark-flip shrink-0" />;
}

/**
 * Site footer.
 *
 * Exists mostly so the legal pages are reachable from every page rather than
 * only by typing the URL: the platforms reviewing an OAuth application check
 * that a privacy policy is linked from the product, not merely that the link
 * resolves. It also carries the one disclaimer worth repeating everywhere,
 * because somebody about to spend money is unlikely to have read the Risks
 * page first.
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-14 w-full max-w-[1040px] border-t border-[var(--color-rule)] px-1 pb-4 pt-7">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="flex items-center gap-2.5">
          <Logo size={22} />
          <span className="text-[14px] font-semibold tracking-tight">Backd</span>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          {[
            { href: "/terms", label: "Terms" },
            { href: "/privacy", label: "Privacy" },
            { href: "/risks", label: "Risks" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="text-[var(--color-muted)] hover:text-[var(--color-fg)]">
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mt-4 max-w-[46rem] text-[12px] leading-[1.6] text-[var(--color-faint)] [text-wrap:pretty]">
        Backd is an interface to pump.fun, not an exchange or a broker. Coins can
        be launched by anyone for any creator, and a coin existing says nothing
        about that creator endorsing it or being involved. Nothing here is
        financial advice, and you can lose everything you spend.
      </p>
    </footer>
  );
}

/**
 * How much is sitting unclaimed across the whole board.
 *
 * Fetched client-side rather than passed down from the layout: the layout
 * renders on every route, and reading every escrow on chain to decorate the
 * nav would put that cost on pages that never show a coin. It renders nothing
 * until the number arrives, and nothing at all if the request fails — an
 * ornament that reported zero during an RPC outage would be a lie about the
 * one figure this product is judged on.
 */
function WaitingBlock() {
  const [total, setTotal] = useState<{
    lamports: number;
    coins: number;
    solUsd: number | null;
  } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/waiting")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (live && body && typeof body.lamports === "number") setTotal(body);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!total || total.lamports === 0) return null;

  return (
    <>
      <div className="sunk mt-3.5 hidden rounded-2xl px-3.5 py-3 xl:block">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-faint)]">
          Waiting to claim
        </div>
        <div className="tnum mt-1.5 text-[19px] font-bold tracking-tight text-[var(--color-money)]">
          {formatUsd(total.lamports, total.solUsd) ?? (
            <>
              {formatSol(total.lamports)}{" "}
              <span className="text-[11px] font-semibold text-[var(--color-muted)]">SOL</span>
            </>
          )}
        </div>
        <div className="mt-1.5 text-[10px] text-[var(--color-faint)]">
          unclaimed across {total.coins} coin{total.coins === 1 ? "" : "s"}
        </div>
      </div>

      <div className="sunk mt-3.5 rounded-xl px-1 py-2 text-center xl:hidden">
        <div className="tnum text-[12.5px] font-bold tracking-tight text-[var(--color-money)]">
          {formatUsd(total.lamports, total.solUsd) ?? formatSol(total.lamports)}
        </div>
        <div className="mt-px text-[8.5px] font-semibold tracking-[0.1em] text-[var(--color-faint)]">
          {total.solUsd ? "waiting" : "SOL"}
        </div>
      </div>
    </>
  );
}



/**
 * The claim, set as type rather than packaged as a card.
 *
 * This replaces three stacked panels — a split bar, a numbered "how it works"
 * and a question-with-an-arrow. Between them they were the most
 * template-looking thing on the site: a numbered three-step with emoji bullets
 * is the house style of every generated landing page, and three rounded boxes
 * of identical weight in a column is what filling space looks like when
 * nobody decided what mattered.
 *
 * One number instead, big enough to work as a graphic, with the
 * qualifications set small beneath it. Rules rather than a border — the figure
 * does not need a box drawn around it to be found.
 */
function RailStat() {
  return (
    <div className="mt-5 hidden border-y-[1.5px] border-[var(--color-fg)] py-3.5 xl:block">
      <div className="flex items-end gap-1">
        <span className="tnum text-[52px] font-bold leading-[0.78] tracking-[-0.055em] text-[var(--color-money)]">
          90
        </span>
        <span className="tnum pb-1 text-[18px] font-bold leading-none tracking-tight text-[var(--color-money)]">
          %
        </span>
      </div>

      <div className="mt-2 text-[12.5px] font-semibold leading-tight tracking-tight">
        of every creator fee
      </div>
      <div className="mt-1 text-[10.5px] leading-snug text-[var(--color-faint)]">
        goes to the person the coin names. Written on chain at mint, not
        promised.
      </div>
    </div>
  );
}

/*
 * Stuck on, not laid out.
 *
 * The angles and the overlap are the point: three neat pills in a column would
 * be the card stack again wearing a different shape. Each carries its own
 * rotation and they bite into one another, the way stickers on a laptop do.
 */
/*
 * Both colours are pinned rather than tokenised, the way the `sticker` utility
 * already pins its own. A real sticker does not change colour with the room,
 * and the theme tokens would fight it here: the `-line` text colours pair with
 * the *soft* fills, so using one on a saturated yellow put cream on yellow in
 * dark mode.
 */
const STICKERS = [
  { text: "no permission needed", bg: "#ffcf24", fg: "#12100e", turn: "-4.5deg", shift: "ml-0" },
  { text: "no wallet required", bg: "#2bea86", fg: "#12100e", turn: "3.5deg", shift: "ml-7 -mt-1.5" },
  { text: "not even an account", bg: "#6c4cf5", fg: "#ffffff", turn: "-2deg", shift: "ml-2 -mt-1" },
] as const;

function RailStickers() {
  return (
    <div className="mt-5 hidden xl:block" aria-hidden>
      {STICKERS.map((s) => (
        <div
          key={s.text}
          className={`inline-flex rounded-full border-[1.5px] border-[var(--color-fg)] px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.05em] shadow-[var(--drop-press)] ${s.shift}`}
          style={{ background: s.bg, color: s.fg, transform: `rotate(${s.turn})` }}
        >
          {s.text}
        </div>
      ))}
    </div>
  );
}

/**
 * Small proof of life above the theme toggle.
 *
 * This is a real-money app on mainnet, not a testnet demo, and nothing else
 * in the chrome says so. The dot is the cheapest way to say it — and unlike
 * the figures above it, it is true before the first coin exists.
 */
function MainnetFlag() {
  return (
    <div className="flex items-center justify-center gap-1.5 pb-0.5">
      <span className="live-dot" />
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--color-faint)]">
        live on solana
      </span>
    </div>
  );
}


/** Slim bar carrying the wallet on small screens, where the rail is hidden. */
export function MobileTopBar() {
  return (
    <div className="floating-bar sticky top-3 z-30 mx-3 mt-3 flex h-[54px] items-center justify-between !rounded-[22px] py-0 pl-3.5 pr-2 md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <Logo size={28} />
        <span className="font-semibold tracking-tight">Backd</span>
      </Link>
      <div className="flex items-center gap-1">
        {/* The rail carries this on desktop; small screens have no rail. */}
        <div className="w-9">
          <ThemeToggle compact />
        </div>
        <ConnectButton />
      </div>
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
    <nav className="floating-bar fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-around gap-0.5 p-1.5 md:hidden">
      {[feed, explore].map(({ href, label, Icon }) => (
        <Tab key={href} href={href} label={label} Icon={Icon} active={isActive(href)} />
      ))}

      <Link
        href="/launch"
        aria-label="Launch a coin"
        className="btn-primary grid h-[46px] w-[58px] shrink-0 place-items-center !rounded-[18px]"
      >
        <PlusIcon />
      </Link>

      {[earning, claim].map(({ href, label, Icon }) => (
        <Tab key={href} href={href} label={label} Icon={Icon} active={isActive(href)} />
      ))}
    </nav>
  );
}

function Tab({ href, label, Icon, active }: Item & { active: boolean }) {
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
