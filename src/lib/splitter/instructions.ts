import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

import type { Platform } from "../social/types";
import { PLATFORM_CODE, configPda, handleHash, vaultPda } from "./pda";

/**
 * Borsh encoding for the splitter's instructions, written by hand.
 *
 * The program has five instructions and three of them are a single pubkey, so
 * an IDL client would be more machinery than the thing it encodes. Enum
 * variants are a single leading byte in declaration order — this list must stay
 * in step with `SplitterInstruction`.
 */
const enum Tag {
  InitializeConfig = 0,
  UpdateConfig = 1,
  InitializeVault = 2,
  RegisterPayout = 3,
  Distribute = 4,
}

function encode(tag: Tag, ...parts: Buffer[]): Buffer {
  return Buffer.concat([Buffer.from([tag]), ...parts]);
}

export function initializeConfig(
  programId: PublicKey,
  payer: PublicKey,
  admin: PublicKey,
  platformWallet: PublicKey,
  verificationAuthority: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: configPda(programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encode(
      Tag.InitializeConfig,
      admin.toBuffer(),
      platformWallet.toBuffer(),
      verificationAuthority.toBuffer(),
    ),
  });
}

/**
 * Creates a creator's vault. Included in the launch transaction, and a no-op
 * to skip when the vault already exists — a creator's second coin reuses the
 * first one's vault, since the address depends only on the handle.
 */
export function initializeVault(
  programId: PublicKey,
  payer: PublicKey,
  platform: Platform,
  handle: string,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: vaultPda(programId, platform, handle).pubkey, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encode(
      Tag.InitializeVault,
      Buffer.from([PLATFORM_CODE[platform]]),
      handleHash(handle),
    ),
  });
}

export function registerPayout(
  programId: PublicKey,
  verificationAuthority: PublicKey,
  platform: Platform,
  handle: string,
  payoutWallet: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: verificationAuthority, isSigner: true, isWritable: false },
      { pubkey: configPda(programId), isSigner: false, isWritable: false },
      { pubkey: vaultPda(programId, platform, handle).pubkey, isSigner: false, isWritable: true },
    ],
    data: encode(Tag.RegisterPayout, payoutWallet.toBuffer()),
  });
}

/**
 * Pays out 90/10. Permissionless, so this can be cranked by a keeper, by the
 * creator, or by anyone who wants to move the money along.
 *
 * `creatorWallet` is the vault itself when the creator has not registered yet;
 * the program reserves their share in place rather than paying it out.
 */
export function distribute(
  programId: PublicKey,
  platform: Platform,
  handle: string,
  platformWallet: PublicKey,
  creatorWallet: PublicKey | null,
  wsolAccount?: { account: PublicKey; tokenProgram: PublicKey },
): TransactionInstruction {
  const vault = vaultPda(programId, platform, handle).pubkey;
  const keys = [
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: configPda(programId), isSigner: false, isWritable: false },
    { pubkey: platformWallet, isSigner: false, isWritable: true },
    { pubkey: creatorWallet ?? vault, isSigner: false, isWritable: true },
  ];

  // The AMM pays creator fees as wrapped SOL. Passing the token account lets
  // the program unwrap it first; without it, only the bonding-curve share is
  // visible to the split.
  if (wsolAccount) {
    keys.push({ pubkey: wsolAccount.account, isSigner: false, isWritable: true });
    keys.push({ pubkey: wsolAccount.tokenProgram, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({ programId, keys, data: encode(Tag.Distribute) });
}
