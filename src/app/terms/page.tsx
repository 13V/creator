import Link from "next/link";

import { InShort, LegalPage } from "@/components/Legal";
import { CONTACT_EMAIL, JURISDICTION, OPERATOR } from "@/lib/legal";
import { creatorShareBps, formatShare } from "@/lib/pump/feeShare";

export const metadata = {
  title: "Terms",
  description: "The terms you accept by using Backd.",
};

export default function TermsPage() {
  const share = formatShare(creatorShareBps());
  const platformShare = formatShare(10_000 - creatorShareBps());

  return (
    <LegalPage
      title="Terms of use"
      current="/terms"
      intro={`These terms govern your use of Backd. By launching a coin, trading one, or claiming an escrow, you accept them. If you do not, do not use the site.`}
    >
      <InShort
        points={[
          "Backd is an interface to pump.fun. We do not hold your trading funds, run a market, or take the other side of anything.",
          `Every coin routes ${share} of its creator fees to the creator it names and ${platformShare} to us. That split is enforced on chain, not by us.`,
          "If you launch a coin for someone, you are responsible for what you publish about them — and you are not permitted to claim they are involved.",
          "A creator can claim their escrow by proving the account, and can ask us to delist a coin. Nobody can delete it from the blockchain.",
          "Everything is provided as-is. See the Risks page, which is part of these terms.",
        ]}
      />

      <h2>1. What Backd is</h2>
      <p>
        Backd is a web interface for creating and trading tokens on{" "}
        <a href="https://pump.fun" rel="noreferrer noopener" target="_blank">
          pump.fun
        </a>
        , a public protocol on the Solana blockchain, and for routing the
        creator fees those tokens earn to the creator each one names.
      </p>
      <p>
        We build and operate the interface. We do not operate an exchange,
        broker or money service; we do not custody the funds you trade with; we
        never hold your private keys; and we do not take the other side of your
        transactions. Every trade you make is a transaction you sign yourself,
        submitted to a public network, executed by programs neither party
        controls.
      </p>

      <h2>2. Eligibility</h2>
      <p>By using Backd you confirm that you:</p>
      <ul>
        <li>are at least 18 years old and legally able to enter this agreement;</li>
        <li>
          are not located in, or acting on behalf of anyone in, a country
          subject to comprehensive sanctions, and are not on any applicable
          sanctions list;
        </li>
        <li>
          are not prohibited by the law of your own jurisdiction from acquiring
          or dealing in tokens of this kind.
        </li>
      </ul>

      <h2>3. Launching a coin for someone else</h2>
      <p>
        Backd exists to let anyone launch a coin for any creator, including
        creators who have never heard of it. That is the point of the product,
        and it puts real obligations on the person who launches.
      </p>
      <p>When you launch, you represent and agree that:</p>
      <ul>
        <li>
          <strong>You are not impersonating anyone.</strong> You may name a
          creator and use their public handle to identify whose coin it is. You
          may not present yourself as them, as their representative, or as
          acting with their approval.
        </li>
        <li>
          <strong>You will not claim an association that does not exist.</strong>{" "}
          No stating or implying that the creator endorses, is partnered with,
          has invested in or is otherwise involved with the coin.
        </li>
        <li>
          <strong>You are responsible for what you submit.</strong> The name,
          ticker, description and image are yours. They must not infringe
          anyone&rsquo;s rights, and must not be defamatory, harassing, sexual,
          hateful or otherwise unlawful.
        </li>
        <li>
          <strong>You bear the cost.</strong> You pay the network fees and any
          opening buy. Nothing is refundable, including a launch you regret.
        </li>
      </ul>
      <p>
        We may refuse a launch, and may remove any coin from Backd&rsquo;s own
        pages at our discretion — in particular where a named creator objects.
        Removal from our pages does not remove the token from the blockchain,
        which is beyond anyone&rsquo;s power, including ours.
      </p>

      <h2>4. Fees and the split</h2>
      <p>
        pump.fun pays a creator fee on trades of each coin. Backd configures
        every coin it launches so that <strong>{share}</strong> of that fee goes
        to the escrow for the creator the coin names, and{" "}
        <strong>{platformShare}</strong> goes to us. This is set on chain at
        launch, using pump.fun&rsquo;s own fee-sharing program.
      </p>
      <p>
        That matters more than a promise would: the split is executed by the
        protocol, not by us forwarding money we received. We cannot quietly
        change the share on a coin that already exists, and neither can anyone
        else. Changing the configured split affects future launches only.
      </p>
      <p>
        Network fees, priority fees and rent are set by Solana and paid by
        whoever signs. Any additional platform fee charged at launch is shown
        before you sign.
      </p>

      <h2>5. Escrows and custody</h2>
      <p>
        Where pump.fun supports a creator&rsquo;s platform natively, fees
        accumulate in a vault the protocol binds to that social identity.{" "}
        <strong>We hold no key to it</strong> and cannot move those funds under
        any circumstances.
      </p>
      <p>
        Where no such vault exists — currently Reddit, Instagram and TikTok — we derive
        a wallet for the creator and hold the key until they claim.{" "}
        <strong>
          These balances are held in trust for the named creator.
        </strong>{" "}
        We will not spend, lend, stake or otherwise use them, and will release
        them to that creator on a valid claim. We are telling you plainly that
        we are technically able to move them, because a policy you cannot verify
        is worth stating honestly rather than dressing up.
      </p>

      <h2>6. Claiming</h2>
      <p>
        A creator claims by signing in to the platform account in question,
        which proves control of it, and nominating a wallet to be paid to. We do
        not receive or store a password, and we do not retain the access token
        beyond reading the account identity once.
      </p>
      <p>
        A claim binds the escrow to the wallet nominated. Choose it carefully:
        payouts to a wallet you do not control cannot be reversed by us. If an
        account changes hands, write to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> rather than
        assuming the earlier claim lapses.
      </p>
      <p>
        We may withhold a payout where we have reasonable grounds to believe a
        claim is fraudulent, or where the law requires it.
      </p>

      <h2>7. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use Backd for money laundering, sanctions evasion or fraud;</li>
        <li>
          manipulate a market through wash trading, or launch coins to harass,
          defame or extort a person;
        </li>
        <li>
          launch bulk or automated coins for the purpose of spamming the board;
        </li>
        <li>
          attack, overload or attempt to gain unauthorised access to the site or
          its infrastructure, or bypass its rate limits.
        </li>
      </ul>

      <h2>8. No advice, no warranty</h2>
      <p>
        Nothing on Backd is financial, investment, legal or tax advice, or a
        recommendation about any token. The site and everything on it is
        provided <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong>,
        without warranty of any kind, express or implied, including
        merchantability, fitness for a purpose and non-infringement.
      </p>
      <p>
        We do not warrant that the site will be uninterrupted, that data shown
        is accurate or current, or that transactions will succeed. Figures are
        read from public sources and can be stale, delayed or wrong.
      </p>
      <p>
        The <Link href="/risks">Risks</Link> page forms part of these terms and
        you should read it in full.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, {OPERATOR} is not liable for any
        indirect, incidental, special or consequential loss, or for lost
        profits, lost tokens or lost opportunity, arising from your use of the
        site — including losses caused by market movements, by faults in
        pump.fun or Solana, by a third-party service, or by your own
        transactions.
      </p>
      <p>
        Where liability cannot lawfully be excluded, our total aggregate
        liability is limited to the greater of the fees we actually received
        from your activity in the preceding twelve months, or one hundred
        Australian dollars.
      </p>
      <p>
        Nothing in these terms excludes liability for fraud, or any liability
        that cannot be excluded under the consumer law applying to you.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You will indemnify {OPERATOR} against claims, losses and reasonable
        legal costs arising from your breach of these terms, from content you
        submitted, or from a coin you launched — including a claim brought by a
        creator you named.
      </p>

      <h2>11. Changes and termination</h2>
      <p>
        We may change these terms. Material changes will move the date at the
        top of this page, and continuing to use Backd after that is acceptance.
        We may suspend or withdraw the site, or any part of it, at any time.
      </p>
      <p>
        Because the coins exist on a public blockchain, they continue to exist
        and trade whether Backd does or not. If we shut the site down, we will
        take reasonable steps to release managed escrow balances to the
        creators they name before doing so.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the law of {JURISDICTION}, and you submit to
        the non-exclusive jurisdiction of its courts. If a provision is found
        unenforceable, the rest continues to apply.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions, objections and legal notices:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
