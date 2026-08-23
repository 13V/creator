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
import { resolveEscrow } from "../escrow";
import type { EscrowKind, SocialProfile } from "../social/types";
import { getConnection, getOnlineSdk } from "./connection";
import { uploadMetadata } from "./metadata";

const COMPUTE_UNIT_LIMIT = 400_000;
const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 150_000;

export interface LaunchRequest {
  profile: SocialProfile;
  payer: PublicKey;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
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
      imageUrl: req.imageUrl,
      twitter: req.profile.profileUrl,
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

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const message = new TransactionMessage({
    payerKey: req.payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(message);
  transaction.sign([mint]);

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

export class LaunchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LaunchError";
  }
}
