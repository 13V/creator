#!/usr/bin/env node
/**
 * Proves the 90/10 split end to end against real pump.fun programs.
 *
 * Launches a coin, migrates it onto a fee-sharing config, trades against it to
 * generate real creator fees, then distributes and measures who actually got
 * paid. Types and simulation cannot show this; only the balances can.
 *
 * It caught the bug that shipped in the first version of this feature: passing
 * an empty `currentShareholders` fails with NotEnoughRemainingAccounts,
 * because that list becomes the instruction's remaining accounts.
 *
 *   npm run local:validator     # in one terminal
 *   npm run verify:fee-share    # in another
 */
const {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} = require("@solana/web3.js");
const BN = require("bn.js");
const S = require("@pump-fun/pump-sdk");

const RPC = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const PLATFORM_BPS = 1_000;

const connection = new Connection(RPC, "confirmed");
const online = new S.OnlinePumpSdk(connection);

function sol(lamports) {
  return (lamports / LAMPORTS_PER_SOL).toFixed(6);
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
  const creatorEscrow = Keypair.generate();
  const platformWallet = Keypair.generate();
  const trader = Keypair.generate();

  await fund(launcher.publicKey, 200 * LAMPORTS_PER_SOL);
  await fund(trader.publicKey, 200 * LAMPORTS_PER_SOL);
  // Rent-exempt so credits are plain, and matching what the launch pre-funds.
  await fund(creatorEscrow.publicKey, 0.05 * LAMPORTS_PER_SOL);
  await fund(platformWallet.publicKey, 0.01 * LAMPORTS_PER_SOL);

  console.log("launcher       ", launcher.publicKey.toBase58());
  console.log("creator escrow ", creatorEscrow.publicKey.toBase58());
  console.log("platform wallet", platformWallet.publicKey.toBase58());

  // ---- 1. Launch a coin whose creator is the escrow, as the app does.
  const global = await online.fetchGlobal();
  const mint = Keypair.generate();
  const core = {
    mint: mint.publicKey,
    name: "Split Test",
    symbol: "SPLIT",
    uri: "https://example.com/meta.json",
    creator: creatorEscrow.publicKey,
    user: launcher.publicKey,
  };
  const createIxs = [
    global.createV2Enabled
      ? await S.PUMP_SDK.createV2Instruction({ ...core, mayhemMode: false })
      : await S.PUMP_SDK.createInstruction(core),
  ];
  await send(
    [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...createIxs],
    launcher,
    [launcher, mint],
  );
  console.log("\nlaunched       ", mint.publicKey.toBase58());

  const curveBefore = await online.fetchBondingCurve(mint.publicKey);
  console.log("curve creator  ", curveBefore.creator.toBase58());
  console.log(
    "  == escrow?   ",
    curveBefore.creator.equals(creatorEscrow.publicKey),
  );

  // ---- 2. Migrate onto a fee-sharing config with the 90/10 split.
  const shareholders = [
    { address: creatorEscrow.publicKey, shareBps: 10_000 - PLATFORM_BPS },
    { address: platformWallet.publicKey, shareBps: PLATFORM_BPS },
  ];

  // Both in one transaction. `createFeeSharingConfig` initialises the config
  // with the creator holding 10000 bps, so the current shareholder list is
  // predictable and does not have to be read back first.
  await send(
    [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      await S.PUMP_SDK.createFeeSharingConfig({
        creator: creatorEscrow.publicKey,
        mint: mint.publicKey,
        pool: null,
      }),
      await S.PUMP_SDK.updateFeeShares({
        authority: creatorEscrow.publicKey,
        mint: mint.publicKey,
        currentShareholders: [creatorEscrow.publicKey],
        newShareholders: shareholders,
      }),
    ],
    creatorEscrow,
    [creatorEscrow],
  );

  const configAddress = S.feeSharingConfigPda(mint.publicKey);
  let configInfo = await connection.getAccountInfo(configAddress);
  let config = S.PUMP_SDK.decodeSharingConfig(configInfo);
  console.log("\nsharing config set");

  configInfo = await connection.getAccountInfo(configAddress);
  config = S.PUMP_SDK.decodeSharingConfig(configInfo);
  console.log("config address ", configAddress.toBase58());
  if (config) {
    for (const sh of config.shareholders) {
      console.log(
        `  shareholder   ${sh.address.toBase58()}  ${sh.shareBps} bps`,
      );
    }
  }

  const curveAfter = await online.fetchBondingCurve(mint.publicKey);
  console.log("curve creator  ", curveAfter.creator.toBase58());
  console.log(
    "  migrated?    ",
    S.hasCoinCreatorMigratedToSharingConfig({
      mint: mint.publicKey,
      creator: curveAfter.creator,
    }),
  );

  // ---- 3. Trade, to accrue real creator fees.
  const feeConfig = await online.fetchFeeConfig();
  // createV2 mints are Token-2022; assuming the classic program makes the
  // buy's ATA creation fail with IncorrectProgramId.
  const mintInfo = await connection.getAccountInfo(mint.publicKey);
  const tokenProgram = mintInfo.owner;
  console.log("token program  ", tokenProgram.toBase58());
  for (let i = 0; i < 3; i++) {
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
    const ix = await S.PUMP_SDK.buyInstructions({
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
      tokenProgram,
    });
    await send(
      [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...ix],
      trader,
      [trader],
    );
  }
  console.log("\ntraded 60 SOL through the curve");

  // ---- 4. Distribute, and see who was actually paid.
  const creatorBefore = await connection.getBalance(creatorEscrow.publicKey);
  const platformBefore = await connection.getBalance(platformWallet.publicKey);

  const freshConfigInfo = await connection.getAccountInfo(configAddress);
  const freshConfig = S.PUMP_SDK.decodeSharingConfig(freshConfigInfo);

  const distributeIx = await S.PUMP_SDK.distributeCreatorFees({
    mint: mint.publicKey,
    sharingConfig: freshConfig,
    sharingConfigAddress: configAddress,
  });
  await send(
    [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), distributeIx],
    launcher,
    [launcher],
  );

  const creatorAfter = await connection.getBalance(creatorEscrow.publicKey);
  const platformAfter = await connection.getBalance(platformWallet.publicKey);

  const creatorGot = creatorAfter - creatorBefore;
  const platformGot = platformAfter - platformBefore;
  const total = creatorGot + platformGot;

  console.log("\n--- distribution ---");
  console.log(`creator  +${sol(creatorGot)} SOL`);
  console.log(`platform +${sol(platformGot)} SOL`);
  console.log(`total     ${sol(total)} SOL`);

  if (total === 0) {
    console.log("\nFAIL: nothing was distributed");
    process.exit(1);
  }

  const creatorPct = (creatorGot / total) * 100;
  const platformPct = (platformGot / total) * 100;
  console.log(
    `\nsplit: ${creatorPct.toFixed(3)}% creator / ${platformPct.toFixed(3)}% platform`,
  );

  const ok = Math.abs(creatorPct - 90) < 0.01 && Math.abs(platformPct - 10) < 0.01;
  console.log(ok ? "\nPASS: 90/10 enforced on-chain" : "\nFAIL: split is wrong");
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error("\nERROR:", error.message);
  if (error.logs) console.error(error.logs.slice(-16).join("\n"));
  process.exit(1);
});
