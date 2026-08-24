# Creator Launchpad

Paste any **X**, **Instagram**, or **TikTok** profile and launch that creator's
coin on [pump.fun](https://pump.fun). The person who launches it signs and pays
— but every creator fee the coin ever earns routes to an escrow only the
creator can open.

The creator does not need an account here, a wallet, or any idea this exists.
Fees accumulate on-chain until they show up and claim them.

---

## How it works

pump.fun's `create` instruction takes a **`creator` pubkey that is independent
of the signing `user`**. That one argument is the whole product:

```
launcher's wallet ──signs & pays──▶ create(creator = creator's escrow)
                                          │
                       every trade ───────┴──▶ creator_vault PDA
                                                (launcher gets nothing)
```

Fees land in a `["creator-vault", creator]` PDA. The launcher is never the
creator, so they can never collect them.

## Escrow strategies

Who holds the escrow depends on the platform. The app always prefers the route
where nobody has to be trusted, and it labels which one is in effect on every
coin and creator page.

| | **Non-custodial** | **Managed** |
|---|---|---|
| Platforms | X (with `X_BEARER_TOKEN`) | Instagram, TikTok, X without a token |
| Escrow | pump.fun's native social fee vault, a PDA derived from the creator's **numeric** account id | An ed25519 key this app derives via HKDF from `ESCROW_MASTER_SEED` |
| Who can withdraw | Only the creator, by linking that account on pump.fun. **This app holds no key and cannot withdraw** | This app, on the creator's behalf, after they verify the handle |
| Claim route | pump.fun | This app's `/claim` flow |

**Be honest about the managed route.** It is real custody. `ESCROW_MASTER_SEED`
*is* the escrow — anyone with it controls every unclaimed managed balance. Put
it in a KMS/HSM before taking real money, back it up offline, and never rotate
it while balances are outstanding.

Because the non-custodial route is keyed on a *numeric* account id rather than
a handle, X launches downgrade to a managed escrow when `X_BEARER_TOKEN` is
absent — a handle-keyed vault would send fees to whoever holds the name today,
which is not necessarily who held it at launch.

## Claiming (managed escrows)

Creator fees arrive in **two currencies**, which the payout has to handle
differently: the bonding-curve vault pays **native lamports** to the creator,
while the AMM vault pays **wrapped SOL** into a token account. A payout
therefore collects from both, closes the escrow's wrapped-SOL account to unwrap
that share straight to the creator (reclaiming its rent too), and transfers
only the native remainder. Counting the wrapped share as lamports overdraws the
escrow and reverts the entire claim — see `planPayout` and its tests.


1. Creator opens `/claim` and enters their handle.
2. They get a one-time code (`pcl-…`) to put in their bio, or their display
   name on TikTok, whose public API exposes no bio. Codes expire after an hour.
3. They connect a wallet. The app re-reads the live profile, finds the code,
   then builds a payout that **collects from both the bonding-curve and AMM
   vaults and sweeps the escrow to their wallet**.
4. The escrow co-signs; the creator's wallet is the fee payer and adds the last
   signature. The funds can only move to the wallet that passed verification,
   and the operator never needs a funded hot wallet.

## The app

| Page | What it does |
|---|---|
| `/` | Hero, launch box, recent launches, and the top creators by unclaimed fees |
| `/explore` | Every coin, with search by name/ticker/handle, platform filters, and sort by newest or most earned |
| `/leaderboard` | Creators ranked by fees waiting, read live from chain |
| `/coin/[mint]` | Coin detail: fees waiting, custody explanation, and every on-chain address |
| `/creator/[platform]/[handle]` | A creator's coins, unclaimed total, and their claim route |
| `/claim` | Handle verification and payout |

Coin and creator pages generate **share cards** (`opengraph-image`) that lead
with the SOL a creator has waiting — the link preview is the pitch when a fan
posts it at them. Avatars are re-encoded to PNG with sharp first, because
Satori only decodes PNG and JPEG while real avatars arrive as GIF, WebP, or
SVG; anything undecodable falls back to a monogram rather than failing the card.

Fee totals in lists come from a batched reader (`src/lib/pump/feesBatch.ts`).
The bonding-curve vault, the AMM vault's wrapped-SOL ATA, and the escrow wallet
are all derivable offline, so ranking every creator costs a couple of
`getMultipleAccounts` calls rather than three round trips each. It is
cross-checked against the SDK's own per-creator reader.

## Setup

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

`.env.local` at minimum:

```bash
SOLANA_RPC_URL="https://<your-provider>"   # a public RPC will rate-limit instantly
ESCROW_MASTER_SEED="$(openssl rand -hex 32)"
X_BEARER_TOKEN="..."                        # strongly recommended, see above
PUMP_LOOKUP_TABLE="..."                     # required for opening buys, see below
```

### Address lookup table

A create-plus-buy transaction references about 26 accounts, which puts it a few
bytes over Solana's 1232-byte packet limit — **every launch with an opening buy
fails without a lookup table**, and the margin shrinks further as the coin name
grows. Create one once:

```bash
npm run setup:lookup-table          # uses ~/.config/solana/id.json by default
```

It costs well under 0.01 SOL and prints the address to set as
`PUMP_LOOKUP_TABLE`. With one configured, a create-and-buy compiles to ~918
bytes instead of ~1240. Launches without an opening buy fit either way.

`prepareLaunch` refuses to return an oversized transaction and **simulates
every launch against mainnet before handing it back**, so a launch that would
fail on-chain surfaces as a readable error rather than after the user has
already approved it in their wallet.

Everything else is optional and documented in [`.env.example`](.env.example),
including an optional per-launch platform fee (`PLATFORM_FEE_WALLET`,
`PLATFORM_FEE_LAMPORTS`) added as a transfer inside the launch transaction.

### This runs on mainnet by default

Launching spends real SOL. Point `SOLANA_RPC_URL` and `SOLANA_CLUSTER` at
devnet first if you want to rehearse the flow.

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm start          # serve the build
npm run typecheck  # tsc --noEmit
npm test           # unit tests (parsing + escrow derivation)
```

## Layout

```
src/lib/social/     profile parsing + per-platform resolvers (X, IG, TikTok)
src/lib/escrow/     escrow strategies; derive.ts is pure and unit-tested
src/lib/pump/       pump.fun: metadata upload, launch tx, fee reads, payouts
src/lib/verify/     handle-ownership verification
src/app/api/        resolve, launch/{prepare,confirm}, claim/{start,verify,record}
src/components/     launch + claim flows, explore grid, shared UI
```

Launches are a two-step handshake. `prepare` builds a transaction signed by the
mint keypair only; the browser adds the wallet signature, so **no user key ever
reaches the server**. `confirm` then re-reads the bonding curve from chain and
**refuses to index a coin whose on-chain creator is not the escrow we would
have derived ourselves** — nothing in the request body is trusted.

## Profile resolution

| Platform | Source | Notes |
|---|---|---|
| X | official API v2 | Needs `X_BEARER_TOKEN`; the only source of the numeric id |
| TikTok | public oEmbed | No credentials; gives name + avatar, no bio or follower count |
| Instagram | web profile endpoint | No official API; heavily IP-rate-limited, often falls back |

Every resolver degrades to a handle plus an avatar proxy rather than throwing,
so a rate-limited upstream never blocks a launch. The UI marks a profile whose
live lookup failed as an **unverified lookup**.

## Storage

SQLite through Node's built-in `node:sqlite` — no native modules, no ORM, no
migration step. It is an **index of launches, not a source of truth**: coins,
fees, and escrow balances are all read back from chain. For a multi-instance
deployment, swap `src/lib/db.ts` for Postgres; nothing above it changes.

## Testing it for real

Public devnet faucets are unreliable and simulation alone cannot prove a
transaction lands, so the full flow is exercised against a **local validator
with pump.fun cloned from mainnet** — real signing, broadcasting, and
confirmation, at no cost. Three production bugs surfaced this way that reading
the code did not.

```bash
npm run local:validator                                    # terminal 1
SOLANA_RPC_URL=http://127.0.0.1:8899 \
  npm run setup:lookup-table ~/.config/solana/id.json      # terminal 2
```

Then point `SOLANA_RPC_URL` at `http://127.0.0.1:8899`, airdrop freely, and run
a launch through the app. Separately, `npm run verify:payout` proves the claim
path against real mainnet vaults that already hold fees.

## Launch readiness

Verified end to end on a local validator running the real pump.fun programs:

- A coin **launched, broadcast, and confirmed**, with the on-chain bonding
  curve's `creator` matching the derived escrow exactly.
- Trading accrued **real creator fees to the escrow**, not to the launcher.
- A claim **paid out for real** — escrow drained, SOL landed in the creator's
  wallet, fees remaining zero.
- Claim verification **refused to pay out** a handle whose ownership was not
  proven.
- A repeat claim cost the creator nothing beyond the network fee.

Verified against mainnet, without spending anything:

- The launch transaction **simulates clean** (`err: null`), with and without an
  opening buy, and decodes to `createV2` with `creator` set to the escrow.
- The **payout simulates clean against real creator vaults**, moving the full
  balance to a fresh wallet.
- Fee reads match the SDK's own reader exactly on live creators.
- Size guard, simulation guard, and rate limiting all fire correctly.

**Still not exercised:**

- **Nothing has run on mainnet.** The local validator runs the real pump.fun
  programs against cloned mainnet state, which is as close as it gets without
  spending, but it is not mainnet.
- The **non-custodial X path is untested end to end**. Without an
  `X_BEARER_TOKEN` no launch has used `createSocialFeePda`, and it has not been
  confirmed that a creator can actually withdraw from pump.fun's social vault.
- Handle verification has only been shown to **reject**. No claim has been
  approved by editing a real profile.

### One unavoidable cost

A creator's **first** claim is short by roughly **0.002 SOL**, the rent for a
wrapped-SOL account pump.fun's AMM program creates and only it can close.
Measured: first claim short 0.002039 SOL, every claim after short by zero. The
escrow's own wrapped-SOL account is closed on each payout, so its rent comes
straight back.


Before taking real money, also: move `ESCROW_MASTER_SEED` into a KMS, use a
paid RPC, replace SQLite and the in-memory rate limiter with shared stores if
running more than one instance, and get a lawyer's read on launching coins
named after real people without their consent.

## Known limits

- pump.fun's native social vault supports X only. Instagram and TikTok are
  custodial until it supports them.
- Instagram lookups fail often enough that display name and avatar frequently
  fall back to defaults.
- Verification reads the bio or display name. A creator whose account is
  private, or whose upstream lookup is rate-limited, cannot verify until it
  recovers.
- Anyone can launch a coin for anyone. There is no consent step, and no
  trademark or impersonation check — that is the same posture as the product
  this mirrors, and worth revisiting before running it at scale.
