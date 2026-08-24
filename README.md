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
```

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
