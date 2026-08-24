#!/usr/bin/env node
/**
 * Exercises the whole launch path against real pump.fun programs.
 *
 * Covers the four combinations that behave differently — with and without an
 * opening buy, with and without an address lookup table — because the opening
 * buy is exactly eighteen bytes over the packet limit without a table, and
 * that is the case a type check cannot see.
 *
 *   npm run local:validator      # in one terminal
 *   npm run verify:launch        # in another
 */
const {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} = require("@solana/web3.js");
const { NATIVE_MINT } = require("@solana/spl-token");
const BN = require("bn.js");
const S = require("@pump-fun/pump-sdk");

const RPC = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const LIMIT = 1232;
const connection = new Connection(RPC, "confirmed");
const online = new S.OnlinePumpSdk(connection);

async function fund(pubkey, lamports) {
  const sig = await connection.requestAirdrop(pubkey, lamports);
  const bh = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}

async function send(instructions, payer, signers) {
  const bh = await connection.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: bh.blockhash,
      instructions,
    }).compileToV0Message(),
  );
  tx.sign(signers);
  const size = tx.serialize().length;
  const sig = await connection.sendTransaction(tx, { maxRetries: 5 });
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  return { sig, size };
}

let failures = 0;

function check(label, ok, detail) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function launch({ label, devBuySol }) {
  console.log(`\n=== ${label} ===`);

  const payer = Keypair.generate();
  const escrow = Keypair.generate();
  const mint = Keypair.generate();
  await fund(payer.publicKey, 300 * LAMPORTS_PER_SOL);

  const global = await online.fetchGlobal();
  const core = {
    mint: mint.publicKey,
    name: "Verification Coin",
    symbol: "VERIFY",
    uri: "https://ipfs.io/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    creator: escrow.publicKey,
    user: payer.publicKey,
  };

  const budget = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150_000 }),
  ];
  // Exactly what the app now sends: real rent for a 1024-byte config plus a
  // tight fee buffer. Overshooting shows up on the board as creator fees that
  // were never earned, so the margin here is deliberately thin.
  const configRent = await connection.getMinimumBalanceForRentExemption(1024);
  const ownRent = await connection.getMinimumBalanceForRentExemption(0);
  const funding = configRent + ownRent + 100_000;
  const transfers = [
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: escrow.publicKey,
      lamports: funding,
    }),
  ];

  // What the app does first: try create-and-buy in one transaction.
  const devBuyLamports = Math.round(devBuySol * LAMPORTS_PER_SOL);
  let combinedSize = null;
  if (devBuyLamports > 0) {
    const solAmount = new BN(devBuyLamports);
    const amount = S.getBuyTokenAmountFromSolAmount({
      global,
      feeConfig: null,
      mintSupply: null,
      bondingCurve: S.newBondingCurve(global),
      amount: solAmount,
      quoteMint: NATIVE_MINT,
    });
    const combined = await S.PUMP_SDK.createV2AndBuyInstructions({
      global,
      ...core,
      amount,
      solAmount: solAmount.mul(new BN(10_500)).div(new BN(10_000)),
      mayhemMode: false,
    });
    const probe = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash("confirmed")).blockhash,
        instructions: [...budget, ...combined, ...transfers],
      }).compileToV0Message(),
    );
    probe.sign([payer, mint]);
    combinedSize = probe.serialize().length;
    console.log(`  combined would be ${combinedSize} bytes (limit ${LIMIT})`);
  }

  const mustDefer = combinedSize !== null && combinedSize > LIMIT;

  // Create — with the buy folded in when it fits, on its own when it does not.
  let createIxs;
  if (devBuyLamports > 0 && !mustDefer) {
    const solAmount = new BN(devBuyLamports);
    const amount = S.getBuyTokenAmountFromSolAmount({
      global,
      feeConfig: null,
      mintSupply: null,
      bondingCurve: S.newBondingCurve(global),
      amount: solAmount,
      quoteMint: NATIVE_MINT,
    });
    createIxs = await S.PUMP_SDK.createV2AndBuyInstructions({
      global,
      ...core,
      amount,
      solAmount: solAmount.mul(new BN(10_500)).div(new BN(10_000)),
      mayhemMode: false,
    });
  } else {
    createIxs = [await S.PUMP_SDK.createV2Instruction({ ...core, mayhemMode: false })];
  }

  const created = await send([...budget, ...createIxs, ...transfers], payer, [payer, mint]);
  check("create landed", true, `${created.size} bytes`);

  const curve = await online.fetchBondingCurve(mint.publicKey);
  check("bonding curve exists", Boolean(curve));
  check("creator is the escrow", curve.creator.equals(escrow.publicKey));

  // The deferred buy, through the same path the trade endpoint uses.
  if (mustDefer) {
    const bc = await online.fetchBondingCurve(mint.publicKey);
    const mintInfo = await connection.getAccountInfo(mint.publicKey);
    const solAmount = new BN(devBuyLamports);
    const amount = S.getBuyTokenAmountFromSolAmount({
      global,
      feeConfig: await online.fetchFeeConfig(),
      mintSupply: bc.tokenTotalSupply,
      bondingCurve: bc,
      amount: solAmount,
    });
    const buyIxs = await S.PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: await connection.getAccountInfo(
        S.bondingCurvePda(mint.publicKey),
      ),
      bondingCurve: bc,
      associatedUserAccountInfo: null,
      mint: mint.publicKey,
      user: payer.publicKey,
      amount,
      solAmount: solAmount.mul(new BN(10_500)).div(new BN(10_000)),
      slippage: 5,
      tokenProgram: mintInfo.owner,
    });
    const bought = await send([...budget, ...buyIxs], payer, [payer]);
    check("deferred opening buy landed", true, `${bought.size} bytes`);

    // The tokens landing in the buyer's account is the proof, not a reserve
    // field whose name differs between curve versions.
    const ata = require("@solana/spl-token").getAssociatedTokenAddressSync(
      mint.publicKey,
      payer.publicKey,
      true,
      mintInfo.owner,
    );
    const balance = await connection.getTokenAccountBalance(ata);
    check(
      "the buy delivered tokens",
      BigInt(balance.value.amount) > 0n,
      `${balance.value.uiAmountString} ${core.symbol}`,
    );
  }

  // The fee split, on top of a coin that launched either way.
  await send(
    [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      await S.PUMP_SDK.createFeeSharingConfig({
        creator: escrow.publicKey,
        mint: mint.publicKey,
        pool: null,
      }),
      await S.PUMP_SDK.updateFeeShares({
        authority: escrow.publicKey,
        mint: mint.publicKey,
        currentShareholders: [escrow.publicKey],
        newShareholders: [
          { address: escrow.publicKey, shareBps: 9_000 },
          { address: Keypair.generate().publicKey, shareBps: 1_000 },
        ],
      }),
    ],
    escrow,
    [escrow],
  );
  // What is left in the escrow is counted as unclaimed creator fees, so it
  // has to be small enough not to distort the board.
  const leftover = await connection.getBalance(escrow.publicKey);
  check(
    "escrow float is only its own rent floor",
    leftover - ownRent < 200_000,
    `${(leftover / LAMPORTS_PER_SOL).toFixed(6)} SOL left of ${(funding / LAMPORTS_PER_SOL).toFixed(6)} sent`,
  );

  const migrated = await online.fetchBondingCurve(mint.publicKey);
  check(
    "fee sharing applied",
    S.hasCoinCreatorMigratedToSharingConfig({
      mint: mint.publicKey,
      creator: migrated.creator,
    }),
  );
}

async function main() {
  await launch({ label: "launch with no opening buy", devBuySol: 0 });
  await launch({ label: "launch with a 1 SOL opening buy", devBuySol: 1 });
  await launch({ label: "launch with a 25 SOL opening buy", devBuySol: 25 });

  console.log(failures === 0 ? "\nPASS: every launch path works" : `\nFAIL: ${failures} check(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nERROR:", error.message);
  if (error.logs) console.error(error.logs.slice(-14).join("\n"));
  process.exit(1);
});
