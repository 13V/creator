#!/usr/bin/env node
/**
 * Starts a local validator with pump.fun cloned from mainnet.
 *
 * This is the only way to exercise a launch and a claim for real — signing,
 * broadcasting, confirming — without spending SOL. Public devnet faucets are
 * unreliable, and simulation alone cannot prove a transaction lands. Three
 * production bugs were caught this way that reading the code did not surface.
 *
 *   npm run local:validator            # leave running in one terminal
 *   SOLANA_RPC_URL=http://127.0.0.1:8899 npm run setup:lookup-table <keypair>
 *
 * Then point the app at http://127.0.0.1:8899 and airdrop freely.
 *
 * Requires the Solana CLI: https://solana.com/docs/intro/installation
 */
const { spawn } = require("node:child_process");
const { PublicKey } = require("@solana/web3.js");
const { Connection } = require("@solana/web3.js");
const S = require("@pump-fun/pump-sdk");

const MAINNET = process.env.CLONE_FROM ?? "https://api.mainnet-beta.solana.com";
const LEDGER = process.env.LEDGER_DIR ?? ".local-ledger";

const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

async function main() {
  const connection = new Connection(MAINNET, "confirmed");
  const global = await new S.OnlinePumpSdk(connection).fetchGlobal();

  const programs = [
    S.PUMP_PROGRAM_ID,
    S.PUMP_FEE_PROGRAM_ID,
    S.PUMP_AMM_PROGRAM_ID,
    METADATA_PROGRAM,
  ];

  const candidates = [
    S.GLOBAL_PDA,
    S.PUMP_FEE_CONFIG_PDA,
    S.FEE_PROGRAM_GLOBAL_PDA,
    S.PUMP_EVENT_AUTHORITY_PDA,
    S.PUMP_FEE_EVENT_AUTHORITY_PDA,
    S.GLOBAL_VOLUME_ACCUMULATOR_PDA,
    S.AMM_GLOBAL_PDA,
    global.feeRecipient,
    ...global.feeRecipients,
    ...(global.reservedFeeRecipients ?? []),
  ].filter((key) => key && !key.equals(PublicKey.default));

  // Uninitialised PDAs abort the clone, so only ask for accounts that exist.
  const unique = [...new Map(candidates.map((k) => [k.toBase58(), k])).values()];
  const infos = await connection.getMultipleAccountsInfo(unique);
  const accounts = unique.filter((_, i) => infos[i] !== null);

  const args = ["--reset", "--quiet", "--ledger", LEDGER, "--url", MAINNET];
  for (const program of programs) args.push("--clone-upgradeable-program", program.toBase58());
  for (const account of accounts) args.push("--clone", account.toBase58());

  console.log(
    `cloning ${programs.length} programs and ${accounts.length} accounts from mainnet…`,
  );
  console.log("RPC will be http://127.0.0.1:8899\n");

  const child = spawn("solana-test-validator", args, { stdio: "inherit" });
  child.on("error", (error) => {
    if (error.code === "ENOENT") {
      console.error("solana-test-validator not found. Install the Solana CLI first.");
      process.exit(1);
    }
    throw error;
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
