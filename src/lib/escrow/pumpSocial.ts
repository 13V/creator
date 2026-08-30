import "server-only";

import { PublicKey } from "@solana/web3.js";
import { Platform as PumpPlatform, PUMP_SDK, socialFeePda } from "@pump-fun/pump-sdk";

import { getConnection } from "../pump/connection";
import type { SocialProfile } from "../social/types";
import { supportsPumpSocial } from "./route";
import type { EscrowResolution, EscrowStrategy } from "./types";

/**
 * Non-custodial escrow using pump.fun's native social fee vault.
 *
 * The vault is a PDA derived from the creator's *numeric* platform id, so the
 * launchpad never holds a key. Fees sit on-chain until the real creator links
 * that social account on pump.fun and claims — an action only pump.fun's
 * social claim authority can authorise, and one we cannot perform on their
 * behalf even if we wanted to.
 */
export const pumpSocialStrategy: EscrowStrategy = {
  kind: "pump-social",

  supports: supportsPumpSocial,

  async resolve(profile: SocialProfile, payer: PublicKey): Promise<EscrowResolution> {
    const userId = profile.platformUserId;
    if (!userId) {
      return {
        ok: false,
        reason:
          "No numeric X user id available. Set X_BEARER_TOKEN to enable the " +
          "non-custodial escrow.",
      };
    }

    const pda = socialFeePda(userId, PumpPlatform.X);

    // Initialise the vault on first use; re-creating an existing one fails.
    const existing = await getConnection().getAccountInfo(pda);
    const setupInstructions = existing
      ? []
      : [
          await PUMP_SDK.createSocialFeePda({
            payer,
            userId,
            platform: PumpPlatform.X,
          }),
        ];

    return {
      ok: true,
      escrow: {
        kind: "pump-social",
        pubkey: pda,
        setupInstructions,
        custodyNote:
          `Fees accrue to a pump.fun social vault derived from @${profile.handle}'s ` +
          "X account id. This launchpad holds no key and cannot withdraw.",
        claimRoute: "pump.fun",
      },
    };
  },
};
