import Link from "next/link";

import { InShort, LegalPage } from "@/components/Legal";
import { CONTACT_EMAIL } from "@/lib/legal";
import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";

export const metadata = {
  title: "Risks",
  description:
    "What can go wrong when you launch or buy a coin through Backd, stated plainly.",
};

export default function RisksPage() {
  const share = formatShare(creatorShareBps());

  return (
    <LegalPage
      title="What can go wrong"
      current="/risks"
      intro="Backd is a front end to a permissionless market. Nobody underwrites it, nobody can reverse it, and most coins launched on any platform of this kind end up worth nothing. Read this before you spend anything."
    >
      <InShort
        points={[
          "You can lose every cent you put in, and that is the ordinary outcome, not the unlucky one.",
          "Anyone can launch a coin naming any creator. A coin existing says nothing about that creator having heard of it, endorsed it, or being involved.",
          "The creator a coin names may never claim it. Their fees keep accruing regardless — possibly forever.",
          "For Instagram and TikTok, Backd holds the escrow key until the creator claims. That is custody, and custody is a risk.",
          "Nothing here is advice. There is no refund, no support desk, and no undo.",
        ]}
      />

      <h2>You can lose everything</h2>
      <p>
        Coins launched through Backd are created on{" "}
        <a href="https://pump.fun" rel="noreferrer noopener" target="_blank">
          pump.fun
        </a>{" "}
        and trade on a bonding curve. Their price is set entirely by what other
        people are willing to pay, minute to minute, with no floor. The
        overwhelming majority of coins launched on platforms of this kind go to
        zero, and they get there quickly.
      </p>
      <p className="warn">
        <strong>
          Do not spend money here that you need for anything else.
        </strong>{" "}
        There is no insurance, no deposit protection, no chargeback and no
        counterparty who will make you whole. A transaction you sign is final
        the moment it confirms.
      </p>

      <h2>A coin naming a creator means nothing about that creator</h2>
      <p>
        Backd is permissionless. Anyone can paste a public handle and launch a
        coin for it, and the launcher is whoever paid the transaction fee —
        typically a stranger. The creator named does not need an account here, a
        wallet, or any knowledge that the coin exists.
      </p>
      <p>
        So the presence of a coin is not a signal. It is not an endorsement, a
        partnership, a fundraise, or a statement that the named person is
        involved in any way. Treat every coin as launched by an anonymous third
        party until the creator has claimed it — the claimed badge on a coin is
        the only thing that says otherwise, and it means only that somebody
        proved control of that social account and named a payout wallet.
      </p>

      <h2>The creator may never come</h2>
      <p>
        {share} of every creator fee is routed to that creator&rsquo;s escrow,
        enforced on chain. That happens whether or not they ever appear. If they
        never claim, the balance simply sits there. It is not redistributed to
        holders, it does not come back to the launcher, and it is not a pool
        anyone can vote to release.
      </p>
      <p>
        Buying a coin because fees are accruing for a creator is a bet on that
        creator showing up. They may not know it exists, may not want it, and
        may object publicly. That is a normal outcome and you should price it.
      </p>

      <h2>Custody risk on managed escrows</h2>
      <p>
        There are two kinds of escrow, and the difference matters:
      </p>
      <ul>
        <li>
          <strong>Native.</strong> For platforms pump.fun supports directly, the
          fees go to a vault the protocol itself binds to that social identity.
          Backd never holds a key to it. Nobody at Backd can move that money.
        </li>
        <li>
          <strong>Managed.</strong> For Instagram and TikTok, no such vault
          exists, so Backd derives a wallet for the creator and holds the key
          until they claim. We undertake to release it only to the creator it
          names, and the terms bind us to that — but the honest description is
          that we <em>can</em> move it and are asking you to trust that we
          won&rsquo;t.
        </li>
      </ul>
      <p>
        Managed escrows also carry an operational risk that has nothing to do
        with intent: the keys are derived from a single secret. If that secret
        were lost, the balances derived under it would be unreachable by anyone,
        permanently. We keep it backed up and verified, and it is still a single
        point of failure worth knowing about.
      </p>

      <h2>Technical and regulatory risk</h2>
      <ul>
        <li>
          <strong>Smart contracts can fail.</strong> Backd depends on pump.fun&rsquo;s
          programs and on Solana itself. A bug, exploit or outage in either can
          cost you money, and neither is under our control.
        </li>
        <li>
          <strong>Wallet mistakes are permanent.</strong> Approving a malicious
          transaction, sending to a wrong address or losing a seed phrase cannot
          be undone by us or by anyone.
        </li>
        <li>
          <strong>The law is unsettled and varies by country.</strong> How
          tokens of this kind are treated — as securities, as property, as
          nothing — differs between jurisdictions and is actively changing.
          Access may become restricted where you live, with little notice.
        </li>
        <li>
          <strong>Tax is your responsibility.</strong> Trading and claiming may
          be taxable events. We do not report on your behalf and cannot advise
          you.
        </li>
      </ul>

      <h2>Nothing here is advice</h2>
      <p>
        Nothing on Backd — the board, the leaderboard, the figures on a coin
        page — is financial, investment, legal or tax advice, or a
        recommendation to buy or sell anything. The rankings order coins by
        on-chain activity, which is a description of what has happened, not a
        prediction of what will.
      </p>

      <h2>If you are the creator</h2>
      <p>
        If a coin has been launched naming you and you would rather it were not
        listed here, write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We can remove
        it from Backd&rsquo;s own pages. Nobody — including us — can delete the
        coin from the blockchain or stop it trading elsewhere; that is a
        property of the chain, not a policy choice. Your fees remain claimable
        either way, and the{" "}
        <Link href="/terms">Terms</Link> set out how.
      </p>
    </LegalPage>
  );
}
