# fee-splitter

Splits pump.fun creator fees 90/10 between a creator and the platform, without
either side having to trust the other.

## Why this exists

pump.fun's `create` takes exactly one `creator` pubkey. The vault is derived
from it (`["creator-vault", creator]`) and `collectCreatorFee` pays that
vault's whole balance to that one address. There is no split parameter, and
`setCreator` requires pump.fun's own authority, so **whatever address is chosen
at launch is permanent**.

So a launchpad that wants a cut has two options: receive the fees into a wallet
it controls and promise to forward the creator's share, or point pump.fun at an
address that cannot do anything *except* split correctly. This program is the
second option.

## How it works

Each creator gets a `Vault` PDA at `["vault", platform, handle_hash]`. Launches
pass that PDA as pump.fun's `creator`, so every fee the coin ever earns lands
in it.

- `collect_creator_fee` needs no signature from the creator, so **anyone can
  crank collection** — a keeper, the creator, a curious bystander.
- `distribute` is likewise permissionless. It moves 90% to the wallet the
  creator registered and 10% to the platform wallet baked in at initialisation.
  The split is `BPS_CREATOR`/`BPS_PLATFORM` in this file's code, not
  configuration, so no authority can change it after deploy.
- `register_payout` is the only privileged instruction. The launchpad's
  verification authority signs it to record the wallet a creator proved they
  own. It cannot move funds, and it cannot be pointed anywhere the creator did
  not ask for.

Until a creator registers, their 90% simply accumulates. Nobody can withdraw
it, including the platform.

## Both currencies

Creator fees arrive two ways and a splitter that handles only one strands the
rest — on a live creator measured during development, the AMM share was 70% of
everything owed:

- the **bonding curve** pays native lamports straight to the vault;
- the **AMM** pays *wrapped* SOL into a token account owned by the vault.

`distribute` therefore closes the vault's wrapped-SOL account first, turning
that balance into native lamports, and only then splits. Treating the AMM share
as though it were already native overdraws the vault and reverts the whole
transaction.

## Rent

The vault is a data account, so it must keep its rent-exempt minimum. Only the
balance above that minimum is distributable, or the account would be purged and
the creator's registration lost with it.
