"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ConnectButton } from "@/components/ConnectButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Modal } from "@/components/Modal";
import { LaunchForm } from "@/components/LaunchForm";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  type Platform,
  type SocialProfile,
} from "@/lib/social/types";
import { Avatar, PlatformMark, formatSol, formatUsd } from "@/components/ui";
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

        <RailLauncher />

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
 * The product, in the sidebar.
 *
 * Every previous version of this space was something to look at — a stat, a
 * list, a receipt — and all of them were the same mistake in different
 * clothes. This app's whole idea is that you can point at any person alive
 * and put a coin behind them, and that idea is a thing you *do*. So the rail
 * does it: type a handle and it goes and finds them, their real face appears,
 * and the launch button fills in with their ticker.
 *
 * It is the same lookup the launch page runs, at the same debounce, so
 * whatever it shows here is what that page will show — and pressing through
 * carries the handle so nobody types it twice.
 */
function RailLauncher() {
  const [input, setInput] = useState("");
  const [platform, setPlatform] = useState<Platform>("x");
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [state, setState] = useState<"idle" | "looking" | "found" | "missing">("idle");
  const [open, setOpen] = useState(false);

  const handle = input.trim().replace(/^@+/, "");
  /* A pasted link says which platform it is; a bare handle cannot, and the
     resolver rejects one outright rather than guessing. So the picker below
     supplies it — and is only consulted when the input is not a URL. */
  const isLink = /^(https?:\/\/|[a-z0-9-]+\.[a-z]{2,}\/)/i.test(handle);

  useEffect(() => {
    if (!handle) {
      setProfile(null);
      setState("idle");
      return;
    }
    setState("looking");

    /* 450ms, matching the launch form. The lookup hits live social APIs that
       rate limit, and this input sits on every page in the app. */
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(isLink ? { input: handle } : { input: handle, platform }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        setProfile(body.profile as SocialProfile);
        setState("found");
      } catch {
        setProfile(null);
        setState("missing");
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [handle, platform, isLink]);

  const ticker =
    profile?.handle.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) || "";

  return (
    <div className="launcher-block mt-5 hidden xl:block">
      <div className="mb-2 px-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[var(--color-faint)]">
        Back someone
      </div>

      <div className="launcher-field">
        <span className="text-[15px] font-bold text-[var(--color-faint)]">@</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="anyone"
          spellCheck={false}
          autoComplete="off"
          aria-label="Find a creator by handle"
          className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold tracking-tight outline-none placeholder:font-normal placeholder:text-[var(--color-faint)]"
        />
        {state === "looking" && <span className="launcher-spin" aria-hidden />}
      </div>

      {/* Switching platform re-runs the lookup against the same handle, which
          is the fastest way to find someone when you know the name but not
          where they are. Disabled while a link is in the field, since the
          link already decided. */}
      <div className="mt-1.5 flex gap-1" role="group" aria-label="Platform">
        {PLATFORMS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPlatform(key)}
            disabled={isLink}
            data-active={!isLink && platform === key}
            title={PLATFORM_LABELS[key]}
            aria-label={PLATFORM_LABELS[key]}
            className="launcher-tab"
          >
            <PlatformMark platform={key} />
          </button>
        ))}
      </div>

      {/*
        One slot, three states. Kept at a fixed height so the rail does not
        jump every time a character is typed — the block below it is the
        theme toggle and the wallet, and chrome that twitches while you type
        reads as broken.
      */}
      <div className="launcher-slot">
        {state === "found" && profile && (
          <>
            <div className="flex items-start gap-2">
              <Avatar src={profile.avatarUrl} alt={profile.handle} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold leading-tight tracking-tight">
                  {profile.displayName ?? profile.handle}
                </div>
                <div className="tnum truncate text-[10px] text-[var(--color-faint)]">
                  <PlatformMark platform={profile.platform} /> @{profile.handle}
                  {profile.followers !== null && (
                    <> · {compactCount(profile.followers)} followers</>
                  )}
                </div>
              </div>
            </div>

            {/*
              Only rendered when the upstream lookup actually returned one.
              Without a working X credential the resolver falls back to a
              handle and an avatar guess, and an empty two-line gap under every
              creator would read as something failing to load.
            */}
            {profile.bio && (
              <p className="mt-1.5 line-clamp-2 text-[10.5px] leading-snug text-[var(--color-muted)]">
                {profile.bio}
              </p>
            )}

            {/* Opens in place rather than routing: whoever just found this
                person is looking at them, and sending them to another page to
                start over loses that. /launch is still a real route for a
                shared link — see LaunchPage. */}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn-primary mt-2.5 flex w-full items-center justify-center gap-1.5 !rounded-xl px-2 py-2.5 text-[13px]"
            >
              Launch ${ticker}
            </button>
          </>
        )}

        {state === "missing" && (
          <p className="pt-1 text-[10.5px] leading-snug text-[var(--color-faint)]">
            No profile found. Try a full link, or a handle from X, TikTok,
            Instagram or Reddit.
          </p>
        )}

        {state === "idle" && (
          <p className="pt-1 text-[10.5px] leading-snug text-[var(--color-faint)]">
            Any handle, on any platform. They keep 90% of every fee — even if
            they have never heard of us.
          </p>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={profile ? `Launch a coin for @${profile.handle}` : "Launch a coin"}
      >
        <LaunchForm
          initialHandle={profile?.handle}
          initialPlatform={profile?.platform}
          embedded
        />
      </Modal>
    </div>
  );
}

/** 12300 -> "12.3K". Follower counts are the one figure here with no upper
    bound, and the rail is 234px wide. */
function compactCount(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
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
