#!/usr/bin/env node
/**
 * Measures a launch transaction against Solana's 1232-byte limit.
 *
 * The limit is the reason launches with an opening buy need an address lookup
 * table at all, so it is worth knowing the real number rather than carrying an
 * old one: the SDK's instructions change, and so does the margin.
 *
 *   SOLANA_RPC_URL=... node scripts/measure-launch-size.cjs
 */
const {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} = require("@solana/web3.js");
const { NATIVE_MINT } = require("@solana/spl-token");
const BN = require("bn.js");
const S = require("@pump-fun/pump-sdk");

const LIMIT = 1232;
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const online = new S.OnlinePumpSdk(connection);
  const global = await online.fetchGlobal();

  const payer = Keypair.generate();
  const mint = Keypair.generate();
  const escrow = Keypair.generate();
  const treasury = Keypair.generate();
  const blockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;

  const core = {
    mint: mint.publicKey,
    name: "A Reasonably Long Coin Name",
    symbol: "TICKER",
    uri: "https://ipfs.io/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    creator: escrow.publicKey,
    user: payer.publicKey,
  };

  async function variant(label, { devBuy, extras }) {
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150_000 }),
    ];

    if (devBuy > 0) {
      const solAmount = new BN(devBuy);
      const tokenAmount = S.getBuyTokenAmountFromSolAmount({
        global,
        feeConfig: null,
        mintSupply: null,
        bondingCurve: S.newBondingCurve(global),
        amount: solAmount,
        quoteMint: NATIVE_MINT,
      });
      const maxSol = solAmount.mul(new BN(10_500)).div(new BN(10_000));
      const ixs = global.createV2Enabled
        ? await S.PUMP_SDK.createV2AndBuyInstructions({
            global,
            ...core,
            amount: tokenAmount,
            solAmount: maxSol,
            mayhemMode: false,
          })
        : await S.PUMP_SDK.createAndBuyInstructions({
            global,
            ...core,
            amount: tokenAmount,
            solAmount: maxSol,
          });
      instructions.push(...ixs);
    } else {
      instructions.push(
        global.createV2Enabled
          ? await S.PUMP_SDK.createV2Instruction({ ...core, mayhemMode: false })
          : await S.PUMP_SDK.createInstruction(core),
      );
    }

    for (const extra of extras) instructions.push(extra);

    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(),
    );
    tx.sign([payer, mint]);
    const size = tx.serialize().length;
    const margin = LIMIT - size;
    console.log(
      `${label.padEnd(46)} ${String(size).padStart(4)} bytes  ${
        margin >= 0 ? `${margin} to spare` : `OVER by ${-margin}`
      }`,
    );
    return size;
  }

  const platformFee = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: treasury.publicKey,
    lamports: 1_000_000,
  });
  const escrowRent = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: escrow.publicKey,
    lamports: 5_000_000,
  });

  console.log(`createV2Enabled: ${global.createV2Enabled}\nlimit: ${LIMIT} bytes\n`);

  await variant("create only", { devBuy: 0, extras: [] });
  await variant("create + escrow rent", { devBuy: 0, extras: [escrowRent] });
  await variant("create + rent + platform fee", {
    devBuy: 0,
    extras: [escrowRent, platformFee],
  });
  console.log();
  await variant("create + buy", { devBuy: LAMPORTS_PER_SOL, extras: [] });
  await variant("create + buy + escrow rent", {
    devBuy: LAMPORTS_PER_SOL,
    extras: [escrowRent],
  });
  await variant("create + buy + rent + platform fee", {
    devBuy: LAMPORTS_PER_SOL,
    extras: [escrowRent, platformFee],
  });
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
