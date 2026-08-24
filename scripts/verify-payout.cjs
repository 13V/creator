#!/usr/bin/env node
/**
 * Proves the claim path works against real on-chain state, without spending.
 *
 * Picks a live pump.fun creator whose vaults already hold fees, builds the
 * exact payout this launchpad would build, and simulates it — reporting the
 * destination's balance before and after. Simulation runs with signature
 * verification off, which is what makes it possible to exercise an escrow we
 * do not hold the key for.
 *
 * CommonJS on purpose: the compiled sources under .test-build are CJS, and
 * pump's SDK pulls in ESM-only packages that cannot be required from an ESM
 * entrypoint reaching back into CJS.
 *
 *   npm run verify:payout
 */
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { OnlinePumpSdk } = require("@pump-fun/pump-sdk");

const {
  buildPayoutTransaction,
  readFees,
} = require("../.test-build/src/lib/pump/payoutTx.js");

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const MIN_FEES_LAMPORTS = 5_000_000;

const sol = (lamports) => (lamports / 1e9).toFixed(6);

async function findFundedAccount(connection, coins) {
  for (const coin of coins) {
    try {
      const candidate = new PublicKey(coin.creator);
      if ((await connection.getBalance(candidate)) > 100_000_000) return candidate;
    } catch {
      // Skip malformed entries from the upstream listing.
    }
  }
  return null;
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const online = new OnlinePumpSdk(connection);

  const res = await fetch(
    "https://frontend-api-v3.pump.fun/coins?limit=25&sort=last_trade_timestamp&order=DESC",
    { headers: { "user-agent": "Mozilla/5.0" } },
  );
  if (!res.ok) {
    console.error(`Could not list coins from pump.fun (${res.status}).`);
    process.exit(1);
  }
  const body = await res.json();
  const coins = Array.isArray(body) ? body : (body.coins ?? []);

  // In production the claiming creator's own wallet pays the fee, so the
  // simulation needs a funded account standing in for it -- an escrow with an
  // empty wallet cannot pay for its own payout.
  const feePayer = await findFundedAccount(connection, coins);
  if (!feePayer) {
    console.log("No funded account available to stand in as fee payer.");
    return;
  }

  for (const coin of coins) {
    const escrow = new PublicKey(coin.creator);
    const fees = await readFees(connection, online, escrow);
    if (fees.claimableLamports < MIN_FEES_LAMPORTS) continue;

    console.log(`escrow stand-in   $${coin.symbol} ${escrow.toBase58()}`);
    console.log(`  bonding curve   ${sol(fees.bondingCurveLamports)} SOL (native)`);
    console.log(`  amm             ${sol(fees.ammLamports)} SOL (wrapped)`);
    console.log(`  escrow wallet   ${sol(fees.walletLamports)} SOL`);
    console.log(`  total owed      ${sol(fees.totalLamports)} SOL\n`);

    const destination = Keypair.generate().publicKey;
    const plan = await buildPayoutTransaction({
      connection,
      online,
      escrow,
      destination,
      feePayer,
    });

    const simulation = await connection.simulateTransaction(plan.transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      accounts: { encoding: "base64", addresses: [destination.toBase58()] },
    });

    const after = simulation.value.accounts?.[0]?.lamports ?? 0;
    console.log(
      `  simulation      ${simulation.value.err ? "FAILED " + JSON.stringify(simulation.value.err) : "ok"}`,
    );
    console.log(`  destination     0 SOL -> ${sol(after)} SOL`);

    if (simulation.value.err || after <= 0) {
      console.error("\nPayout does not work against live state.");
      process.exit(1);
    }
    console.log("\nPayout verified against live on-chain state.");
    return;
  }

  console.log("No creator with enough accrued fees to test against right now.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
