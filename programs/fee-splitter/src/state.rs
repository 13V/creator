use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

/// The split, in basis points. Deliberately a constant rather than a field:
/// once this program is deployed and its upgrade authority revoked, no
/// authority anywhere can change what a creator is owed.
pub const BPS_CREATOR: u64 = 9_000;
pub const BPS_TOTAL: u64 = 10_000;

pub const CONFIG_SEED: &[u8] = b"config";
pub const VAULT_SEED: &[u8] = b"vault";

/// Written once at deploy time. Holds the two addresses that are operational
/// rather than structural — where the platform's cut goes, and who is allowed
/// to attest that a creator proved ownership of a handle.
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct Config {
    pub is_initialized: bool,
    pub bump: u8,
    /// May rotate the other two addresses. Nothing else.
    pub admin: Pubkey,
    /// Receives the platform's share of every distribution.
    pub platform_wallet: Pubkey,
    /// Signs `RegisterPayout` after the launchpad verifies a handle.
    pub verification_authority: Pubkey,
}

impl Config {
    pub const LEN: usize = 1 + 1 + 32 + 32 + 32;
}

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Platform {
    X,
    Instagram,
    TikTok,
}

impl Platform {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Platform::X),
            1 => Some(Platform::Instagram),
            2 => Some(Platform::TikTok),
            _ => None,
        }
    }

    pub fn as_u8(self) -> u8 {
        match self {
            Platform::X => 0,
            Platform::Instagram => 1,
            Platform::TikTok => 2,
        }
    }
}

/// One per creator. This is the address pump.fun is told is the coin's
/// `creator`, so every fee any of that creator's coins ever earn lands here.
#[derive(BorshSerialize, BorshDeserialize, Debug, Clone, PartialEq)]
pub struct Vault {
    pub is_initialized: bool,
    pub bump: u8,
    pub platform: u8,
    /// SHA-256 of the lowercased handle. Hashed rather than stored raw so the
    /// seed is a fixed 32 bytes whatever the handle's length.
    pub handle_hash: [u8; 32],
    /// Where the creator's share goes. Zero until they prove the handle.
    pub payout_wallet: Pubkey,
    /// The creator's share accrued while they had no registered wallet.
    ///
    /// Without this the platform would take its 10% of the same lamports over
    /// and over: an unregistered creator's 90% stays in the account, so the
    /// next distribution would see it as fresh income.
    pub creator_reserved: u64,
    pub lifetime_creator: u64,
    pub lifetime_platform: u64,
}

impl Vault {
    pub const LEN: usize = 1 + 1 + 1 + 32 + 32 + 8 + 8 + 8;

    pub fn is_registered(&self) -> bool {
        self.payout_wallet != Pubkey::default()
    }
}
