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

        <RailReceipt />

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
 * The rail's lower half, as a receipt.
 *
 * A stat card, a numbered list, a row of pills — every version of this space
 * so far has been a widget, and widgets are interchangeable between products.
 * A receipt is not: this app's whole subject is money changing hands, and a
 * receipt is the object that says so. It also happens to be the right
 * container for what goes here — a split stated as line items, a running
 * total, and a stamp saying who guarantees it.
 *
 * Everything that makes it read as paper is doing real work. Monospace and
 * dot leaders because that is how a printed total aligns. A rule above the
 * total because that is where a rule goes. The torn edge because a receipt
 * comes off a roll, and because a rectangle with a border would have been the
 * card again.
 */
function RailReceipt() {
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

  const unclaimed =
    total && total.lamports > 0
      ? formatUsd(total.lamports, total.solUsd) ?? `${formatSol(total.lamports)} SOL`
      : null;

  return (
    /* The sticker is a sibling of the paper, not a child: the torn edge is cut
       with a mask, and a mask clips every descendant — inside here the sticker
       lost its right-hand end. */
    <div className="relative mt-5 hidden xl:block">
      <div className="receipt">
      <div className="receipt-body">
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.22em]">
          Backd
        </div>
        <div className="mt-0.5 text-center text-[8.5px] uppercase tracking-[0.16em] text-[var(--color-faint)]">
          creator fee split
        </div>

        <div className="receipt-rule my-2.5" />

        <ReceiptLine label="creator" value="90%" strong />
        <ReceiptLine label="backd" value="10%" />

        <div className="receipt-rule my-2.5" />

        {/*
          The one live figure on the receipt. It prints as a dash rather than
          as zero when there is nothing waiting or the lookup failed — a
          receipt showing $0.00 reads as a broken till, and this is the number
          the whole product is judged on.
        */}
        <ReceiptLine
          label="unclaimed"
          value={unclaimed ?? "—"}
          strong
          money={Boolean(unclaimed)}
        />
        <ReceiptLine
          label="coins"
          value={total ? String(total.coins) : "—"}
        />

        <div className="receipt-rule my-2.5" />

        <div className="text-center text-[9px] font-bold uppercase tracking-[0.1em]">
          ✱ set on chain at mint ✱
        </div>
        <div className="mt-1 text-center text-[8.5px] uppercase tracking-[0.08em] text-[var(--color-faint)]">
          no wallet · no account
        </div>

        <div className="receipt-barcode mt-3" />
      </div>
      </div>

      {/* Stuck to the paper, clear of the printing. */}
      <span className="sticker absolute -bottom-1 -right-2 z-10">no permission</span>
    </div>
  );
}

/** One printed line: label, dot leader, figure. */
function ReceiptLine({
  label,
  value,
  strong = false,
  money = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  money?: boolean;
}) {
  return (
    <div className={`flex items-baseline gap-1 ${strong ? "font-bold" : ""}`}>
      <span className="uppercase tracking-[0.06em]">{label}</span>
      {/* Nudged up so the dots sit on the line the type sits on, not under it. */}
      <span className="receipt-dots" />
      <span className={`tnum ${money ? "text-[var(--color-money)]" : ""}`}>{value}</span>
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
