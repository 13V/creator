import Link from "next/link";

import { InShort, LegalPage } from "@/components/Legal";
import { CONTACT_EMAIL, OPERATOR } from "@/lib/legal";

export const metadata = {
  title: "Privacy",
  description: "What Backd collects, why, and what it never keeps.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      current="/privacy"
      intro="What Backd collects, why it collects it, and what it deliberately does not keep. Short, because there genuinely is not much of it."
    >
      <InShort
        points={[
          "No cookies, no analytics, no advertising trackers, no third-party pixels.",
          "Signing in to claim reveals your account identity to us and nothing else — we never receive your password and do not keep the access token.",
          "We store the public profile information of creators coins are launched for: handle, display name, avatar, bio, follower count.",
          "Your IP is used to rate-limit the API and is deleted within a minute.",
          "Anything written to the blockchain is public and permanent. Nobody can delete it — including us.",
        ]}
      />

      <h2>Who we are</h2>
      <p>
        {OPERATOR} operates this site and is the controller of the personal
        information described here. Reach us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>What we collect</h2>

      <h3>Creator profiles</h3>
      <p>
        When someone launches a coin for a creator, we read that
        creator&rsquo;s <strong>public</strong> profile from the platform and
        store it so the coin&rsquo;s page can show whose coin it is: the handle,
        the platform&rsquo;s own identifier for the account, display name,
        avatar URL, bio and follower count.
      </p>
      <p className="warn">
        This happens whether or not the creator has asked for it, which is
        unusual enough to say directly. The information is already public on the
        platform it came from, we add nothing to it, and any creator can have
        their profile removed from our pages by writing to us — see{" "}
        <a href="#your-choices">Your choices</a>.
      </p>

      <h3>Claiming</h3>
      <p>
        Claiming an escrow means signing in to the platform account. That is
        handled by the platform itself: <strong>your password never reaches
        us</strong>. What comes back is a token letting us read which account
        signed in. We read the account identifier and handle from it, check they
        match the claim, and <strong>discard the token</strong> — it is never
        written to our database.
      </p>
      <p>
        We store the wallet address you nominate for payouts, and the fact and
        time of a successful claim.
      </p>

      <h3>Wallets and transactions</h3>
      <p>
        We store the public wallet address that launched each coin, and the
        signature of each launch and payout transaction. These are already
        public on the blockchain; we keep them so pages load without scanning
        the chain from scratch. We never see or store a private key or seed
        phrase.
      </p>

      <h3>Network information</h3>
      <p>
        Our API rate limits by IP address, so an IP is held in a counter for the
        length of the limit window — under a minute — and then deleted. We do
        not keep request logs tied to you, and we do not build a profile from
        them. Our hosting and database providers keep their own operational
        logs, as any host does.
      </p>

      <h2>What we do not collect</h2>
      <ul>
        <li>
          <strong>No cookies.</strong> The site sets none. The sign-in round trip
          carries a short-lived signed token in the URL that expires after ten
          minutes and is never stored.
        </li>
        <li>
          <strong>No analytics or advertising.</strong> No Google Analytics, no
          pixels, no fingerprinting, no session recording, no third-party
          trackers of any kind.
        </li>
        <li>
          <strong>No accounts.</strong> There is nothing to sign up for. No
          email address, no phone number, no name is asked for or stored.
        </li>
        <li>
          <strong>No selling or sharing.</strong> We do not sell personal
          information and do not share it for advertising.
        </li>
      </ul>

      <h2>Why we are allowed to</h2>
      <p>
        Where a data protection law such as the GDPR applies, we rely on
        legitimate interests to show public creator profiles and to keep the
        service secure and available, and on performance of a contract to
        process a claim you initiated. Where you sign in to claim, you are also
        giving consent, which you may withdraw by asking us to delete the claim
        record.
      </p>

      <h2>Who else sees it</h2>
      <ul>
        <li>
          <strong>Vercel</strong> — hosting, so it processes requests to the
          site.
        </li>
        <li>
          <strong>Supabase</strong> — the database the above is stored in.
        </li>
        <li>
          <strong>Our Solana RPC provider</strong> — reads and submits
          transactions on the blockchain.
        </li>
        <li>
          <strong>pump.fun</strong> — creates the coins and pins their metadata
          and images to IPFS, which is a public, distributed store.
        </li>
        <li>
          <strong>X, Reddit, Instagram and TikTok</strong> — for reading public
          profiles and for sign-in.
        </li>
      </ul>
      <p>
        We also disclose information where the law requires it. These providers
        operate in several countries, so data may be processed outside your own.
      </p>

      <h2>The blockchain part</h2>
      <p className="warn">
        Coins, transactions, wallet addresses and the metadata attached to a
        coin — its name, description and image — are written to a public
        blockchain and to IPFS.{" "}
        <strong>
          That is permanent and worldwide, and no one can delete or amend it,
          including us.
        </strong>{" "}
        If someone launches a coin naming you, we can remove it from Backd, and
        the token itself will still exist. Please read this before deciding what
        to publish.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Creator profiles and coin records are kept while the coin is listed.
        Claim records are kept while the escrow relationship exists, so payouts
        keep working. Rate-limit counters are deleted within a minute. Anything
        on chain is outside this and permanent.
      </p>

      <h2 id="your-choices">Your choices</h2>
      <p>
        Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we
        will, as far as the law and the blockchain allow:
      </p>
      <ul>
        <li>tell you what we hold about you;</li>
        <li>correct it if it is wrong;</li>
        <li>
          delete your profile and remove coins naming you from Backd&rsquo;s
          pages;
        </li>
        <li>send you a copy of your claim record;</li>
        <li>stop processing your information.</li>
      </ul>
      <p>
        Removing your profile does not forfeit fees already accrued to your
        escrow: you can still claim them. What we cannot do is alter the
        blockchain, and we will say so rather than pretend otherwise.
      </p>
      <p>
        If you are unhappy with how we have handled a request you may complain
        to your local data protection authority.
      </p>

      <h2>Children</h2>
      <p>
        Backd is not for anyone under 18 and we do not knowingly collect
        information from children. If you believe we have, tell us and we will
        delete it.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes move the date at the top of this page. See also the{" "}
        <Link href="/terms">Terms</Link> and{" "}
        <Link href="/risks">Risks</Link>.
      </p>
    </LegalPage>
  );
}
