import "server-only";

import BN from "bn.js";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  PUMP_SDK,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
} from "@pump-fun/pump-sdk";

import { getConnection, getOnlineSdk } from "./connection";
import { LaunchError } from "./errors";
import { getLookupTables } from "./lookupTable";

const COMPUTE_UNIT_LIMIT = 300_000;
const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS = 150_000;
const MAX_TRANSACTION_BYTES = 1232;

export type Side = "buy" | "sell";

export interface TradeQuote {
  transaction: string;
  /** Tokens bought, or tokens sold, in base units. */
  tokenAmount: string;
  /** SOL spent on a buy, or received on a sell, before slippage. */
  quotedLamports: string;
  blockhash: string;
  lastValidBlockHeight: number;
}

/**
 * Builds a market buy or sell against the bonding curve.
 *
 * `create_v2` mints are Token-2022 while older ones are classic SPL, and using
 * the wrong program makes the associated-token instructions fail with an
 * unhelpful "incorrect program id". The mint's owner is read rather than
 * assumed.
 */
export async function buildTrade(params: {
  mint: PublicKey;
  user: PublicKey;
  side: Side;
  /** Lamports of SOL to spend on a buy. */
  solLamports?: number;
  /** Base units of the token to sell. */
  tokenAmount?: string;
  slippageBps: number;
}): Promise<TradeQuote> {
  const connection = getConnection();
  const online = getOnlineSdk();

  const mintInfo = await connection.getAccountInfo(params.mint);
  if (!mintInfo) throw new LaunchError("That coin does not exist on this cluster.");
  const tokenProgram = mintInfo.owner;

  const [global, lookupTables] = await Promise.all([
    online.fetchGlobal(),
    getLookupTables(),
  ]);

  const slippage = params.slippageBps / 100;
  let instructions;
  let tokenAmount: BN;
  let quoted: BN;

  if (params.side === "buy") {
    const solAmount = new BN(params.solLamports ?? 0);
    if (solAmount.lten(0)) throw new LaunchError("Enter an amount to spend.");

    const state = await online.fetchBuyState(params.mint, params.user, tokenProgram);
    if (state.bondingCurve.complete) {
      throw new LaunchError("This coin has graduated — trade it on the AMM instead.");
    }

    tokenAmount = getBuyTokenAmountFromSolAmount({
      global,
      feeConfig: null,
      mintSupply: null,
      bondingCurve: state.bondingCurve,
      amount: solAmount,
      quoteMint: NATIVE_MINT,
    });
    quoted = solAmount;

    instructions = await PUMP_SDK.buyInstructions({
      global,
      bondingCurveAccountInfo: state.bondingCurveAccountInfo,
      bondingCurve: state.bondingCurve,
      associatedUserAccountInfo: state.associatedUserAccountInfo,
      mint: params.mint,
      user: params.user,
      amount: tokenAmount,
      solAmount,
      slippage,
      tokenProgram,
    });
  } else {
    tokenAmount = new BN(params.tokenAmount ?? "0");
    if (tokenAmount.lten(0)) throw new LaunchError("Enter an amount to sell.");

    const state = await online.fetchSellState(params.mint, params.user, tokenProgram);
    if (state.bondingCurve.complete) {
      throw new LaunchError("This coin has graduated — trade it on the AMM instead.");
    }

    quoted = getSellSolAmountFromTokenAmount({
      global,
      feeConfig: null,
      mintSupply: state.bondingCurve.tokenTotalSupply,
      bondingCurve: state.bondingCurve,
      amount: tokenAmount,
    });

    instructions = await PUMP_SDK.sellInstructions({
      global,
      bondingCurveAccountInfo: state.bondingCurveAccountInfo,
      bondingCurve: state.bondingCurve,
      mint: params.mint,
      user: params.user,
      amount: tokenAmount,
      solAmount: quoted,
      slippage,
      tokenProgram,
      mayhemMode: false,
    });
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: params.user,
      recentBlockhash: blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
        }),
        ...instructions,
      ],
    }).compileToV0Message(lookupTables),
  );

  const size = transaction.serialize().length;
  if (size > MAX_TRANSACTION_BYTES) {
    throw new LaunchError(
      `This trade builds a ${size}-byte transaction, over Solana's ` +
        `${MAX_TRANSACTION_BYTES}-byte limit. Set PUMP_LOOKUP_TABLE.`,
    );
  }

  return {
    transaction: Buffer.from(transaction.serialize()).toString("base64"),
    tokenAmount: tokenAmount.toString(),
    quotedLamports: quoted.toString(),
    blockhash,
    lastValidBlockHeight,
  };
}
