#!/usr/bin/env node
/**
 * Proves a creator can still get paid once their coin carries a fee split.
 *
 * Fee sharing changes where the money is. Before it, fees sit in the escrow's
 * own creator vaults and the claim collects them. After it, the coin's creator
 * is the sharing config PDA, those vaults stay empty, and the escrow is paid as
 * an ordinary wallet by `distributeCreatorFees`. The claim path was written and
 * verified before any of that existed, so this walks the whole route end to
 * end — launch, split, trade, distribute, claim — and checks the creator's
 * chosen wallet actually receives the money.
 *
 *   npm run local:validator          # in one terminal
 *   npm run verify:claim-after-split # in another
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
const BN = require("bn.js");
const S = require("@pump-fun/pump-sdk");

const {
  buildPayoutTransaction,
  readFees,
} = require("../.test-build/src/lib/pump/payoutTx.js");

const RPC = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const connection = new Connection(RPC, "confirmed");
const online = new S.OnlinePumpSdk(connection);

const sol = (lamports) => (lamports / LAMPORTS_PER_SOL).toFixed(6);

let failures = 0;
function check(label, ok, detail) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures += 1;
}

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
  const sig = await connection.sendTransaction(tx, { maxRetries: 5 });
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  return sig;
}

async function main() {
  const launcher = Keypair.generate();
  const escrow = Keypair.generate();
  const platform = Keypair.generate();
  const trader = Keypair.generate();
  // Where the creator asks for their money once they have proved the handle.
  const creatorWallet = Keypair.generate();
  const mint = Keypair.generate();

  await fund(launcher.publicKey, 300 * LAMPORTS_PER_SOL);
  await fund(trader.publicKey, 300 * LAMPORTS_PER_SOL);
  await fund(platform.publicKey, LAMPORTS_PER_SOL / 100);
  await fund(creatorWallet.publicKey, LAMPORTS_PER_SOL / 100);

  const configRent = await connection.getMinimumBalanceForRentExemption(1024);
  const ownRent = await connection.getMinimumBalanceForRentExemption(0);
  await fund(escrow.publicKey, configRent + ownRent + 100_000);

  // ---- Launch, exactly as the app does.
  const global = await online.fetchGlobal();
  await send(
    [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      await S.PUMP_SDK.createV2Instruction({
        mint: mint.publicKey,
        name: "Claim Test",
        symbol: "CLAIM",
        uri: "https://example.com/meta.json",
        creator: escrow.publicKey,
        user: launcher.publicKey,
        mayhemMode: false,
      }),
    ],
    launcher,
    [launcher, mint],
  );

  // ---- Apply the 90/10 split.
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
          { address: platform.publicKey, shareBps: 1_000 },
        ],
      }),
    ],
    escrow,
    [escrow],
  );

  const curve = await online.fetchBondingCurve(mint.publicKey);
  check(
    "coin migrated to a sharing config",
    S.hasCoinCreatorMigratedToSharingConfig({
      mint: mint.publicKey,
      creator: curve.creator,
    }),
  );

  // ---- Trade, so there are real fees.
  const feeConfig = await online.fetchFeeConfig();
  const mintInfo = await connection.getAccountInfo(mint.publicKey);
  for (let i = 0; i < 3; i += 1) {
    const g = await online.fetchGlobal();
    const bc = await online.fetchBondingCurve(mint.publicKey);
    const solIn = new BN(20 * LAMPORTS_PER_SOL);
    const amount = S.getBuyTokenAmountFromSolAmount({
      global: g,
      feeConfig,
      mintSupply: bc.tokenTotalSupply,
      bondingCurve: bc,
      amount: solIn,
    });
    await send(
      [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ...(await S.PUMP_SDK.buyInstructions({
          global: g,
          bondingCurveAccountInfo: await connection.getAccountInfo(
            S.bondingCurvePda(mint.publicKey),
          ),
          bondingCurve: bc,
          associatedUserAccountInfo: null,
          mint: mint.publicKey,
          user: trader.publicKey,
          amount,
          solAmount: solIn,
          slippage: 30,
          tokenProgram: mintInfo.owner,
        })),
      ],
      trader,
      [trader],
    );
  }

  // ---- Distribute, as the hourly keeper does.
  const configAddress = S.feeSharingConfigPda(mint.publicKey);
  const sharingConfig = S.PUMP_SDK.decodeSharingConfig(
    await connection.getAccountInfo(configAddress),
  );
  const escrowBefore = await connection.getBalance(escrow.publicKey);
  await send(
    [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      await S.PUMP_SDK.distributeCreatorFees({
        mint: mint.publicKey,
        sharingConfig,
        sharingConfigAddress: configAddress,
      }),
    ],
    launcher,
    [launcher],
  );
  const escrowAfter = await connection.getBalance(escrow.publicKey);
  const distributed = escrowAfter - escrowBefore;
  check("distribution reached the escrow", distributed > 0, `+${sol(distributed)} SOL`);

  // ---- The part that had never been exercised: claiming what arrived.
  const snapshot = await readFees(connection, online, escrow.publicKey);
  console.log(
    `\n  fee snapshot: curve=${sol(snapshot.bondingCurveLamports)} amm=${sol(
      snapshot.ammLamports,
    )} wallet=${sol(snapshot.walletLamports)} total=${sol(snapshot.totalLamports)}`,
  );
  check(
    "the claim sees the distributed fees",
    snapshot.walletLamports >= distributed,
    "they arrive as a plain wallet balance, not in a creator vault",
  );

  const before = await connection.getBalance(creatorWallet.publicKey);
  let plan;
  try {
    plan = await buildPayoutTransaction({
      connection,
      online,
      escrow: escrow.publicKey,
      destination: creatorWallet.publicKey,
      feePayer: creatorWallet.publicKey,
    });
  } catch (error) {
    check("payout builds", false, error.message);
    return finish();
  }
  check("payout builds and simulates", true, `${sol(plan.lamports)} SOL`);

  plan.transaction.sign([creatorWallet, escrow]);
  const sig = await connection.sendTransaction(plan.transaction, { maxRetries: 5 });
  await connection.confirmTransaction(
    { signature: sig, blockhash: plan.blockhash, lastValidBlockHeight: plan.lastValidBlockHeight },
    "confirmed",
  );

  const after = await connection.getBalance(creatorWallet.publicKey);
  const received = after - before;
  check("the creator was actually paid", received > 0, `+${sol(received)} SOL net of fees`);
  check(
    "the payout covered what was distributed",
    received > distributed * 0.9,
    `${sol(received)} received vs ${sol(distributed)} distributed`,
  );

  finish();
}

function finish() {
  console.log(
    failures === 0
      ? "\nPASS: a creator can claim from a coin that carries a fee split"
      : `\nFAIL: ${failures} check(s)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nERROR:", error.message);
  if (error.logs) console.error(error.logs.slice(-14).join("\n"));
  process.exit(1);
});
