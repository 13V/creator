#!/usr/bin/env node
/**
 * Creates the address lookup table that keeps launch transactions under
 * Solana's 1232-byte packet limit.
 *
 * A create-plus-buy references ~26 accounts and lands a few bytes over the
 * limit without one, so launches with an opening buy fail. Run this once per
 * deployment and put the printed address in PUMP_LOOKUP_TABLE.
 *
 *   node scripts/create-lookup-table.mjs [path/to/keypair.json]
 *
 * The keypair pays rent (well under 0.01 SOL) and becomes the table authority.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import {
  AddressLookupTableProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  FEE_PROGRAM_GLOBAL_PDA,
  GLOBAL_PDA,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  OnlinePumpSdk,
  PUMP_EVENT_AUTHORITY_PDA,
  PUMP_FEE_CONFIG_PDA,
  PUMP_FEE_EVENT_AUTHORITY_PDA,
  PUMP_FEE_PROGRAM_ID,
  PUMP_PROGRAM_ID,
} from "@pump-fun/pump-sdk";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const KEYPAIR_PATH =
  process.argv[2] ??
  process.env.SOLANA_KEYPAIR ??
  resolve(homedir(), ".config/solana/id.json");

const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const COMPUTE_BUDGET = new PublicKey("ComputeBudget111111111111111111111111111111");
const RENT_SYSVAR = new PublicKey("SysvarRent111111111111111111111111111111111");

function loadKeypair(path) {
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
  } catch (error) {
    console.error(`Could not read a keypair from ${path}`);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const payer = loadKeypair(KEYPAIR_PATH);

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`payer   ${payer.publicKey.toBase58()} (${(balance / 1e9).toFixed(4)} SOL)`);
  if (balance < 20_000_000) {
    console.error("Payer needs at least ~0.02 SOL to create and extend the table.");
    process.exit(1);
  }

  // Fee recipients are read live: they rotate, and a stale entry would leave
  // the table missing exactly the account a launch needs.
  const global = await new OnlinePumpSdk(connection).fetchGlobal();

  const addresses = dedupe([
    PUMP_PROGRAM_ID,
    GLOBAL_PDA,
    PUMP_EVENT_AUTHORITY_PDA,
    PUMP_FEE_CONFIG_PDA,
    PUMP_FEE_PROGRAM_ID,
    FEE_PROGRAM_GLOBAL_PDA,
    PUMP_FEE_EVENT_AUTHORITY_PDA,
    GLOBAL_VOLUME_ACCUMULATOR_PDA,
    global.feeRecipient,
    ...global.feeRecipients,
    ...(global.reservedFeeRecipients ?? []),
    SystemProgram.programId,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    METADATA_PROGRAM,
    COMPUTE_BUDGET,
    RENT_SYSVAR,
    NATIVE_MINT,
  ]);

  const slot = await connection.getSlot("finalized");
  const [createIx, tableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot,
  });

  console.log(`table   ${tableAddress.toBase58()}`);
  console.log(`filling with ${addresses.length} addresses\n`);

  await send(connection, payer, [
    createIx,
    AddressLookupTableProgram.extendLookupTable({
      payer: payer.publicKey,
      authority: payer.publicKey,
      lookupTable: tableAddress,
      addresses: addresses.slice(0, 20),
    }),
  ]);

  // Extends are chunked: each address costs 32 bytes of transaction space.
  for (let i = 20; i < addresses.length; i += 20) {
    await send(connection, payer, [
      AddressLookupTableProgram.extendLookupTable({
        payer: payer.publicKey,
        authority: payer.publicKey,
        lookupTable: tableAddress,
        addresses: addresses.slice(i, i + 20),
      }),
    ]);
  }

  console.log("\nDone. Add this to your environment:\n");
  console.log(`  PUMP_LOOKUP_TABLE="${tableAddress.toBase58()}"\n`);
  console.log(
    "A new table needs one slot to warm up before transactions can use it.",
  );
}

function dedupe(keys) {
  const seen = new Set();
  return keys.filter((key) => {
    if (!key) return false;
    const id = key.toBase58();
    if (seen.has(id) || id === PublicKey.default.toBase58()) return false;
    seen.add(id);
    return true;
  });
}

async function send(connection, payer, instructions) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(),
  );
  tx.sign([payer]);

  const signature = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  console.log(`  sent ${signature}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
