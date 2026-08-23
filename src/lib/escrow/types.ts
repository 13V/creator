import type { PublicKey, TransactionInstruction } from "@solana/web3.js";

import type { EscrowKind, SocialProfile } from "../social/types";

export interface EscrowAccount {
  kind: EscrowKind;
  /** Passed to pump.fun as the coin's `creator`, so trade fees accrue here. */
  pubkey: PublicKey;
  /**
   * Instructions that must run before (or alongside) the coin create in order
   * for the vault to exist. Empty when nothing needs initialising.
   */
  setupInstructions: TransactionInstruction[];
  /** Plain-language description of who can withdraw, surfaced in the UI. */
  custodyNote: string;
  /** How the real creator gets paid once they prove ownership. */
  claimRoute: "pump.fun" | "launchpad";
}

export type EscrowResolution =
  | { ok: true; escrow: EscrowAccount }
  | { ok: false; reason: string };

export interface EscrowStrategy {
  kind: EscrowKind;
  supports(profile: SocialProfile): boolean;
  resolve(profile: SocialProfile, payer: PublicKey): Promise<EscrowResolution>;
}
