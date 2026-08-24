use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub enum SplitterInstruction {
    /// Create the singleton config. Callable once.
    ///
    /// Accounts:
    ///   0. `[signer, writable]` payer
    ///   1. `[writable]`         config PDA (["config"])
    ///   2. `[]`                 system program
    InitializeConfig {
        admin: Pubkey,
        platform_wallet: Pubkey,
        verification_authority: Pubkey,
    },

    /// Point the platform's cut somewhere else, or hand verification to a new
    /// key. Cannot touch the split itself.
    ///
    /// Accounts:
    ///   0. `[signer]`   current admin
    ///   1. `[writable]` config PDA
    UpdateConfig {
        admin: Pubkey,
        platform_wallet: Pubkey,
        verification_authority: Pubkey,
    },

    /// Create a creator's vault. Permissionless: the launch transaction makes
    /// this call, and the vault's address is fully determined by the handle,
    /// so there is nothing an early caller could claim by racing to it.
    ///
    /// Accounts:
    ///   0. `[signer, writable]` payer
    ///   1. `[writable]`         vault PDA (["vault", platform, handle_hash])
    ///   2. `[]`                 system program
    InitializeVault { platform: u8, handle_hash: [u8; 32] },

    /// Record the wallet a creator proved they control.
    ///
    /// Accounts:
    ///   0. `[signer]`   verification authority
    ///   1. `[]`         config PDA
    ///   2. `[writable]` vault PDA
    RegisterPayout { payout_wallet: Pubkey },

    /// Pay out everything the vault holds above rent: 90% to the creator, 10%
    /// to the platform. Permissionless, so a keeper, the creator or anyone
    /// else can trigger it.
    ///
    /// If the creator has not registered a wallet yet, their share is reserved
    /// in place and only the platform's 10% moves.
    ///
    /// Accounts:
    ///   0. `[writable]` vault PDA
    ///   1. `[]`         config PDA
    ///   2. `[writable]` platform wallet (must match config)
    ///   3. `[writable]` creator payout wallet (must match vault; may be the
    ///                   vault itself when unregistered)
    ///   4. `[writable]` optional: the vault's wrapped-SOL token account
    ///   5. `[]`         optional: SPL token program
    Distribute,
}
