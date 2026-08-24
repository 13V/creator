import "server-only";

import BN from "bn.js";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
  newBondingCurve,
  type Global,
} from "@pump-fun/pump-sdk";

import { env } from "../env";
import { LaunchError } from "./errors";
import { resolveEscrow } from "../escrow";
import type { EscrowKind, SocialProfile } from "../social/types";
import { getConnection, getOnlineSdk } from "./connection";
import { getLookupTables } from "./lookupTable";
import { uploadMetadata, type CoinImage } from "./metadata";

const COMPUTE_UNIT_LIMIT = 400_000;
const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 150_000;

/** Solana rejects any transaction whose wire form exceeds one packet. */
const MAX_TRANSACTION_BYTES = 1232;

export interface LaunchRequest {
  profile: SocialProfile;
  payer: PublicKey;
  name: string;
  symbol: string;
  description: string;
  /** An uploaded file, preferred over the creator's avatar when present. */
  image?: CoinImage | null;
  imageUrl?: string | null;
  links?: { twitter?: string; telegram?: string; website?: string };
  devBuyLamports: number;
  slippageBps: number;
}

export interface PreparedLaunch {
  transaction: string;
  mint: string;
  metadataUri: string;
  imageUri: string | null;
  escrowPubkey: string;
  escrowKind: EscrowKind;
  custodyNote: string;
  claimRoute: "pump.fun" | "launchpad";
  blockhash: string;
  lastValidBlockHeight: number;
  platformFeeLamports: number;
}

/**
 * Builds an unsigned launch transaction.
 *
 * The whole point of the launchpad lives in one argument: pump.fun's `create`
 * takes a `creator` that is independent of the signing `user`. The launcher
 * pays and signs, but every creator fee the coin ever earns routes to the
 * creator's escrow instead of to the person who pressed the button.
 *
 * The mint keypair signs here; the launcher's wallet adds the final signature
 * client-side, so no user key ever reaches the server.
 */
export async function prepareLaunch(req: LaunchRequest): Promise<PreparedLaunch> {
  const connection = getConnection();
  const online = getOnlineSdk();

  const escrowResult = await resolveEscrow(req.profile, req.payer);
  if (!escrowResult.ok) {
    throw new LaunchError(escrowResult.reason);
  }
  const escrow = escrowResult.escrow;

  const [global, metadata] = await Promise.all([
    online.fetchGlobal(),
    uploadMetadata({
      name: req.name,
      symbol: req.symbol,
      description: req.description,
      image: req.image,
      imageUrl: req.imageUrl,
      // Default the socials to the creator this coin is for, so a coin always
      // points back at the person earning from it.
      twitter: req.links?.twitter || req.profile.profileUrl,
      telegram: req.links?.telegram,
      website: req.links?.website,
    }),
  ]);

  const mint = Keypair.generate();

  const instructions: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
    }),
    ...escrow.setupInstructions,
    ...(await buildCreateInstructions({
      global,
      mint: mint.publicKey,
      creator: escrow.pubkey,
      user: req.payer,
      name: req.name,
      symbol: req.symbol,
      uri: metadata.metadataUri,
      devBuyLamports: req.devBuyLamports,
      slippageBps: req.slippageBps,
    })),
  ];

  const platformFeeLamports = env().PLATFORM_FEE_LAMPORTS;
  const feeWallet = env().PLATFORM_FEE_WALLET;
  if (feeWallet && platformFeeLamports > 0) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: req.payer,
        toPubkey: new PublicKey(feeWallet),
        lamports: platformFeeLamports,
      }),
    );
  }

  const [{ blockhash, lastValidBlockHeight }, lookupTables] = await Promise.all([
    connection.getLatestBlockhash("confirmed"),
    getLookupTables(),
  ]);

  const message = new TransactionMessage({
    payerKey: req.payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(lookupTables);

  const transaction = new VersionedTransaction(message);
  transaction.sign([mint]);

  assertFits(transaction, req.devBuyLamports > 0, lookupTables.length > 0);
  await assertSimulates(transaction);

  return {
    transaction: Buffer.from(transaction.serialize()).toString("base64"),
    mint: mint.publicKey.toBase58(),
    metadataUri: metadata.metadataUri,
    imageUri: metadata.imageUri,
    escrowPubkey: escrow.pubkey.toBase58(),
    escrowKind: escrow.kind,
    custodyNote: escrow.custodyNote,
    claimRoute: escrow.claimRoute,
    blockhash,
    lastValidBlockHeight,
    platformFeeLamports: feeWallet ? platformFeeLamports : 0,
  };
}

async function buildCreateInstructions(params: {
  global: Global;
  mint: PublicKey;
  creator: PublicKey;
  user: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  devBuyLamports: number;
  slippageBps: number;
}): Promise<TransactionInstruction[]> {
  const { global, devBuyLamports, slippageBps, ...core } = params;
  const useV2 = global.createV2Enabled;

  if (devBuyLamports <= 0) {
    return [
      useV2
        ? await PUMP_SDK.createV2Instruction({ ...core, mayhemMode: false })
        : await PUMP_SDK.createInstruction(core),
    ];
  }

  const solAmount = new BN(devBuyLamports);

  // Quote against a fresh curve: the coin does not exist yet, so there is no
  // on-chain bonding curve to read.
  const tokenAmount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig: null,
    mintSupply: null,
    bondingCurve: newBondingCurve(global),
    amount: solAmount,
    quoteMint: NATIVE_MINT,
  });

  const maxSolAmount = solAmount
    .mul(new BN(10_000 + slippageBps))
    .div(new BN(10_000));

  return useV2
    ? PUMP_SDK.createV2AndBuyInstructions({
        global,
        ...core,
        amount: tokenAmount,
        solAmount: maxSolAmount,
        mayhemMode: false,
      })
    : PUMP_SDK.createAndBuyInstructions({
        global,
        ...core,
        amount: tokenAmount,
        solAmount: maxSolAmount,
      });
}

/**
 * Rejects an oversized transaction here rather than letting the RPC do it.
 *
 * A create-and-buy references enough accounts to land within a few bytes of
 * the packet limit, and the margin shrinks further as the coin name grows, so
 * this is a real failure mode rather than a theoretical one.
 */
function assertFits(
  transaction: VersionedTransaction,
  hasDevBuy: boolean,
  usingLookupTable: boolean,
): void {
  const size = transaction.serialize().length;
  if (size <= MAX_TRANSACTION_BYTES) return;

  const remedy = usingLookupTable
    ? "Try a shorter coin name or ticker."
    : "Set PUMP_LOOKUP_TABLE (see `npm run setup:lookup-table`)" +
      (hasDevBuy ? ", or launch without an opening buy." : ".");

  throw new LaunchError(
    `This launch builds a ${size}-byte transaction, over Solana's ` +
      `${MAX_TRANSACTION_BYTES}-byte limit. ${remedy}`,
  );
}

/**
 * Simulates before handing the transaction back.
 *
 * Signing is the point of no return for the user, so a launch that would fail
 * on-chain should surface here — while it still costs nothing — rather than
 * after they approve it in their wallet.
 */
async function assertSimulates(transaction: VersionedTransaction): Promise<void> {
  const result = await getConnection().simulateTransaction(transaction, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
  });

  if (!result.value.err) return;

  throw new LaunchError(explainSimulationFailure(result.value.err, result.value.logs ?? []));
}

/**
 * Turns a simulation error into something a launcher can act on.
 *
 * The raw shapes ("AccountNotFound", `{InstructionError: [...]}`) say nothing
 * useful to someone who just wants to know why the button did not work, and
 * the overwhelmingly common cause is simply an underfunded wallet.
 */
function explainSimulationFailure(err: unknown, logs: string[]): string {
  const raw = JSON.stringify(err);
  const joined = logs.join("\n");

  if (raw.includes("AccountNotFound") || /insufficient lamports|InsufficientFunds/i.test(joined)) {
    return (
      "Your wallet does not have enough SOL for this launch. You need to cover " +
      "the opening buy plus roughly 0.02 SOL of rent and network fees."
    );
  }

  if (/slippage|TooMuchSolRequired/i.test(joined)) {
    return "The opening buy exceeded its slippage limit. Try again, or lower the amount.";
  }

  const programError = logs.find((line) => /Error|failed/i.test(line));
  return (
    `This launch would fail on-chain (${raw}).` +
    (programError ? ` ${programError.slice(0, 160)}` : "")
  );
}

export { LaunchError } from "./errors";
