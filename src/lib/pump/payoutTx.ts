import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { OnlinePumpSdk } from "@pump-fun/pump-sdk";

/**
 * Rent floor of the escrow itself: a system account with no data.
 *
 * Constant rather than fetched, because `planPayout` is pure and this figure
 * only moves if Solana changes its rent parameters — at which point every
 * account on the network is repriced and this is not the interesting problem.
 */
export const ESCROW_RENT_LAMPORTS = 890_880;

export interface FeeSnapshot {
  /** Unclaimed fees still sitting in pump.fun's creator vaults. */
  claimableLamports: number;
  /** Bonding-curve share, which collects as native lamports. */
  bondingCurveLamports: number;
  /** AMM share, which collects as *wrapped* SOL into a token account. */
  ammLamports: number;
  /** Already-collected SOL resting in the escrow wallet itself. */
  walletLamports: number;
  totalLamports: number;
}

/**
 * What a creator is actually owed, with the escrow's own rent excluded.
 *
 * The launch funds the escrow to its rent floor so it can create the coin's
 * fee-sharing config. That float is not earnings, and counting it would make
 * every freshly launched coin look like it had already paid its creator — and
 * would let someone "claim" a balance made entirely of the launcher's rent.
 */
export function claimableLamports(snapshot: FeeSnapshot): number {
  return (
    snapshot.claimableLamports +
    Math.max(0, snapshot.walletLamports - ESCROW_RENT_LAMPORTS)
  );
}

/**
 * Reads everything owed to an escrow across the bonding curve and AMM vaults.
 *
 * The two are tracked separately because they pay out in different currencies:
 * the bonding-curve vault sends native lamports to the creator, while the AMM
 * vault sends wrapped SOL into a token account. Treating the AMM share as
 * native lamports overdraws the escrow and reverts the whole claim.
 */
export async function readFees(
  connection: Connection,
  online: OnlinePumpSdk,
  escrow: PublicKey,
): Promise<FeeSnapshot> {
  const [both, curve, wallet] = await Promise.all([
    online.getCreatorVaultBalanceBothPrograms(escrow),
    online.getCreatorVaultBalance(escrow),
    connection.getBalance(escrow),
  ]);

  const claimableLamports = both.toNumber();
  const bondingCurveLamports = curve.toNumber();

  return {
    claimableLamports,
    bondingCurveLamports,
    ammLamports: Math.max(0, claimableLamports - bondingCurveLamports),
    walletLamports: wallet,
    totalLamports: claimableLamports + wallet,
  };
}

/** The escrow's wrapped-SOL account, where AMM creator fees land. */
export function escrowWsolAccount(escrow: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(NATIVE_MINT, escrow, true, TOKEN_PROGRAM_ID);
}

export interface PayoutSteps {
  /** Close the escrow's wrapped-SOL account, unwrapping the AMM share. */
  closeWsolAccount: boolean;
  /** Lamports that can actually move as a native transfer. */
  nativeLamports: number;
}

/**
 * Decides what a payout has to do, given what the escrow is owed.
 *
 * Split out and pure because getting this wrong is expensive and silent: the
 * AMM share is *wrapped* SOL, so counting it as native lamports overdraws the
 * escrow and reverts the entire claim, leaving creators unable to withdraw
 * anything at all.
 *
 * The wrapped-SOL account is always closed. The collect instructions create it
 * idempotently whether or not there are AMM fees to put in it, so skipping the
 * close leaves a dust account behind and quietly bills the creator its rent
 * (~0.002 SOL) on every single claim.
 */
export function planPayout(snapshot: FeeSnapshot): PayoutSteps {
  return {
    closeWsolAccount: true,
    // The escrow keeps its rent floor. Draining it destroys the account, so
    // the creator's next coin has to pay that rent over again — and it would
    // hand them the launcher's float on top of what they actually earned.
    nativeLamports:
      Math.max(0, snapshot.walletLamports - ESCROW_RENT_LAMPORTS) +
      snapshot.bondingCurveLamports,
  };
}

export interface PayoutPlan {
  transaction: VersionedTransaction;
  lamports: number;
  blockhash: string;
  lastValidBlockHeight: number;
}

/**
 * Builds and validates the transaction that moves an escrow's fees out.
 *
 * Kept free of key material and of `server-only` so the whole construction can
 * be exercised against real on-chain vaults in a test, rather than only in
 * production where it would be spending someone's money to find out.
 *
 * Only the escrow key can call `collect_creator_fee` for these vaults, so the
 * claimable balance cannot shrink between the read and execution — the
 * transfer amount is therefore a safe lower bound.
 */
export async function buildPayoutTransaction(params: {
  connection: Connection;
  online: OnlinePumpSdk;
  escrow: PublicKey;
  destination: PublicKey;
  feePayer: PublicKey;
  /** Skipped only by tests that simulate an escrow they cannot sign for. */
  simulate?: boolean;
}): Promise<PayoutPlan> {
  const { connection, online, escrow, destination, feePayer } = params;

  const snapshot = await readFees(connection, online, escrow);
  if (claimableLamports(snapshot) <= 0) {
    throw new PayoutError("There are no creator fees to claim yet.");
  }

  const instructions: TransactionInstruction[] = [
    ...(await online.collectCoinCreatorFeeInstructions(escrow, feePayer)),
  ];

  // The AMM share arrives as wrapped SOL. Closing the escrow's token account
  // unwraps it straight to the creator — and returns its rent along the way.
  // Without this the claim tries to move lamports the escrow never held and
  // the whole transaction reverts.
  const steps = planPayout(snapshot);

  if (steps.closeWsolAccount) {
    instructions.push(
      createCloseAccountInstruction(
        escrowWsolAccount(escrow),
        destination,
        escrow,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  // Only the native side can move as lamports: what the escrow already holds
  // plus what the bonding-curve vault just paid it.
  const { nativeLamports } = steps;
  if (nativeLamports > 0) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: escrow,
        toPubkey: destination,
        lamports: nativeLamports,
      }),
    );
  }

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new VersionedTransaction(
    new TransactionMessage({
      payerKey: feePayer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(),
  );

  if (params.simulate !== false) {
    // Catch an unpayable payout here rather than after the creator signs it.
    const simulation = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    if (simulation.value.err) {
      throw new PayoutError(
        `Payout simulation failed: ${JSON.stringify(simulation.value.err)}`,
      );
    }
  }

  return {
    transaction,
    lamports: snapshot.totalLamports,
    blockhash,
    lastValidBlockHeight,
  };
}

export class PayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayoutError";
  }
}
