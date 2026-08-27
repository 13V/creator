import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";

/**
 * The fee split, running.
 *
 * The rail states the ratio. This shows it happening: coins leave the trade on
 * a fixed cadence and, at the fork, nine of every ten carry on to the creator
 * while the tenth peels off to us. The proportion is not a label on a bar —
 * it is something you can sit and count.
 *
 * It never stops because the claim never stops. Every trade, forever, with
 * nobody doing anything. A loop says that; a bar that fills once does not.
 *
 * All CSS: ten spans on one shared period, each offset by a tenth of it. No
 * timers, no client component, nothing to fall out of step on a slow tab.
 */

/* Which coin peels off. Sixth rather than first or last so the odd one out
   lands mid-stream, where it reads as one of a run instead of as a bookend. */
const PLATFORM_INDEX = 5;
const COINS = 10;
const PERIOD_MS = 5000;

export function FeeFlow() {
  const creatorShare = formatShare(creatorShareBps());
  const platformShare = formatShare(10_000 - creatorShareBps());

  return (
    <div className="flow-band" aria-hidden>
      {/* The lines the coins travel along, drawn under them. */}
      <div className="flow-rail" style={{ left: "11%", right: "53%", top: "50%" }} />
      <div className="flow-rail" style={{ left: "47%", right: "12%", top: "30%" }} />
      <div className="flow-rail" style={{ left: "47%", right: "12%", top: "74%" }} />

      {Array.from({ length: COINS }, (_, i) => (
        <span
          key={i}
          className="flow-coin"
          data-to={i === PLATFORM_INDEX ? "platform" : "creator"}
          /* Negative, so the stream is already full on the first frame rather
             than filling up over the first five seconds. */
          style={{ animationDelay: `${-(i * PERIOD_MS) / COINS}ms` }}
        />
      ))}

      <span
        className="absolute left-[2.5%] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border-[1.5px] border-[var(--color-fg)] bg-[var(--color-caution)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-caution-line)]"
      >
        every trade
      </span>

      <span className="absolute right-[2.5%] top-[30%] -translate-y-1/2 whitespace-nowrap text-[11.5px] font-bold tracking-tight">
        <span className="tnum text-[var(--color-money)]">{creatorShare}</span>{" "}
        <span className="text-[var(--color-muted)]">the creator</span>
      </span>

      <span className="absolute right-[2.5%] top-[74%] -translate-y-1/2 whitespace-nowrap text-[11.5px] font-bold tracking-tight">
        <span className="tnum">{platformShare}</span>{" "}
        <span className="text-[var(--color-faint)]">us</span>
      </span>
    </div>
  );
}
