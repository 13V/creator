//! Splits pump.fun creator fees 90/10 without either side trusting the other.
//!
//! See README.md for why this program has to exist at all. The short version:
//! pump.fun's `create` accepts exactly one `creator` pubkey, that choice is
//! permanent, and `collectCreatorFee` pays the whole vault to it. A launchpad
//! that wants a cut therefore either holds creator money itself, or points
//! pump.fun at an address that cannot do anything except split correctly.

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

pub mod instruction;
pub mod state;

use instruction::SplitterInstruction;

/// Associated Token Program. Hardcoded rather than pulled in as a crate: the
/// only thing needed from it is this address and the seed order below, and the
/// crate drags the whole Token-2022 confidential-transfer stack in with it.
const ASSOCIATED_TOKEN_PROGRAM_ID: Pubkey =
    solana_program::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

fn associated_token_address(wallet: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[wallet.as_ref(), spl_token::id().as_ref(), mint.as_ref()],
        &ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    .0
}
use state::{Config, Platform, Vault, BPS_CREATOR, BPS_TOTAL, CONFIG_SEED, VAULT_SEED};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    match SplitterInstruction::try_from_slice(data)
        .map_err(|_| ProgramError::InvalidInstructionData)?
    {
        SplitterInstruction::InitializeConfig {
            admin,
            platform_wallet,
            verification_authority,
        } => initialize_config(
            program_id,
            accounts,
            admin,
            platform_wallet,
            verification_authority,
        ),
        SplitterInstruction::UpdateConfig {
            admin,
            platform_wallet,
            verification_authority,
        } => update_config(
            program_id,
            accounts,
            admin,
            platform_wallet,
            verification_authority,
        ),
        SplitterInstruction::InitializeVault {
            platform,
            handle_hash,
        } => initialize_vault(program_id, accounts, platform, handle_hash),
        SplitterInstruction::RegisterPayout { payout_wallet } => {
            register_payout(program_id, accounts, payout_wallet)
        }
        SplitterInstruction::Distribute => distribute(program_id, accounts),
    }
}

/// Confirms an account really is the PDA for the given seeds, and returns the
/// bump so the caller can sign with it. Skipping this is the classic way a
/// program ends up reading state an attacker supplied.
fn assert_pda(account: &AccountInfo, seeds: &[&[u8]], program_id: &Pubkey) -> Result<u8, ProgramError> {
    let (expected, bump) = Pubkey::find_program_address(seeds, program_id);
    if *account.key != expected {
        msg!("account {} is not the expected PDA {}", account.key, expected);
        return Err(ProgramError::InvalidSeeds);
    }
    Ok(bump)
}

fn load_config(account: &AccountInfo, program_id: &Pubkey) -> Result<Config, ProgramError> {
    if account.owner != program_id {
        return Err(ProgramError::IllegalOwner);
    }
    assert_pda(account, &[CONFIG_SEED], program_id)?;
    let config = Config::try_from_slice(&account.data.borrow())
        .map_err(|_| ProgramError::InvalidAccountData)?;
    if !config.is_initialized {
        return Err(ProgramError::UninitializedAccount);
    }
    Ok(config)
}

/// Creates a program-owned account at a PDA and funds it to rent exemption.
fn create_pda_account<'a>(
    payer: &AccountInfo<'a>,
    target: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    seeds: &[&[u8]],
    bump: u8,
    len: usize,
    program_id: &Pubkey,
) -> ProgramResult {
    if !target.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }
    let lamports = Rent::get()?.minimum_balance(len);
    let bump_seed = [bump];
    let mut signer: Vec<&[u8]> = seeds.to_vec();
    signer.push(&bump_seed);

    invoke_signed(
        &system_instruction::create_account(
            payer.key,
            target.key,
            lamports,
            len as u64,
            program_id,
        ),
        &[payer.clone(), target.clone(), system_program.clone()],
        &[&signer],
    )
}

fn initialize_config(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    admin: Pubkey,
    platform_wallet: Pubkey,
    verification_authority: Pubkey,
) -> ProgramResult {
    let iter = &mut accounts.iter();
    let payer = next_account_info(iter)?;
    let config_account = next_account_info(iter)?;
    let system_program = next_account_info(iter)?;

    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    let bump = assert_pda(config_account, &[CONFIG_SEED], program_id)?;

    create_pda_account(
        payer,
        config_account,
        system_program,
        &[CONFIG_SEED],
        bump,
        Config::LEN,
        program_id,
    )?;

    let config = Config {
        is_initialized: true,
        bump,
        admin,
        platform_wallet,
        verification_authority,
    };
    config.serialize(&mut &mut config_account.data.borrow_mut()[..])?;
    Ok(())
}

fn update_config(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    admin: Pubkey,
    platform_wallet: Pubkey,
    verification_authority: Pubkey,
) -> ProgramResult {
    let iter = &mut accounts.iter();
    let signer = next_account_info(iter)?;
    let config_account = next_account_info(iter)?;

    let mut config = load_config(config_account, program_id)?;
    if !signer.is_signer || *signer.key != config.admin {
        return Err(ProgramError::MissingRequiredSignature);
    }

    config.admin = admin;
    config.platform_wallet = platform_wallet;
    config.verification_authority = verification_authority;
    config.serialize(&mut &mut config_account.data.borrow_mut()[..])?;
    Ok(())
}

fn initialize_vault(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    platform: u8,
    handle_hash: [u8; 32],
) -> ProgramResult {
    let iter = &mut accounts.iter();
    let payer = next_account_info(iter)?;
    let vault_account = next_account_info(iter)?;
    let system_program = next_account_info(iter)?;

    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if Platform::from_u8(platform).is_none() {
        return Err(ProgramError::InvalidInstructionData);
    }

    let platform_seed = [platform];
    let seeds: &[&[u8]] = &[VAULT_SEED, &platform_seed, &handle_hash];
    let bump = assert_pda(vault_account, seeds, program_id)?;

    create_pda_account(
        payer,
        vault_account,
        system_program,
        seeds,
        bump,
        Vault::LEN,
        program_id,
    )?;

    let vault = Vault {
        is_initialized: true,
        bump,
        platform,
        handle_hash,
        payout_wallet: Pubkey::default(),
        creator_reserved: 0,
        lifetime_creator: 0,
        lifetime_platform: 0,
    };
    vault.serialize(&mut &mut vault_account.data.borrow_mut()[..])?;
    Ok(())
}

fn load_vault(account: &AccountInfo, program_id: &Pubkey) -> Result<Vault, ProgramError> {
    if account.owner != program_id {
        return Err(ProgramError::IllegalOwner);
    }
    let vault =
        Vault::try_from_slice(&account.data.borrow()).map_err(|_| ProgramError::InvalidAccountData)?;
    if !vault.is_initialized {
        return Err(ProgramError::UninitializedAccount);
    }
    let platform_seed = [vault.platform];
    assert_pda(
        account,
        &[VAULT_SEED, &platform_seed, &vault.handle_hash],
        program_id,
    )?;
    Ok(vault)
}

fn register_payout(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    payout_wallet: Pubkey,
) -> ProgramResult {
    let iter = &mut accounts.iter();
    let authority = next_account_info(iter)?;
    let config_account = next_account_info(iter)?;
    let vault_account = next_account_info(iter)?;

    let config = load_config(config_account, program_id)?;
    if !authority.is_signer || *authority.key != config.verification_authority {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if payout_wallet == Pubkey::default() {
        return Err(ProgramError::InvalidArgument);
    }

    let mut vault = load_vault(vault_account, program_id)?;
    vault.payout_wallet = payout_wallet;
    vault.serialize(&mut &mut vault_account.data.borrow_mut()[..])?;
    Ok(())
}

/// Moves lamports out of a program-owned account by direct arithmetic.
///
/// A System Program transfer will not do here: the source is owned by this
/// program, not by the System Program, so only we may debit it.
fn pay(from: &AccountInfo, to: &AccountInfo, amount: u64) -> ProgramResult {
    if amount == 0 {
        return Ok(());
    }
    let mut from_lamports = from.try_borrow_mut_lamports()?;
    let mut to_lamports = to.try_borrow_mut_lamports()?;
    **from_lamports = from_lamports
        .checked_sub(amount)
        .ok_or(ProgramError::InsufficientFunds)?;
    **to_lamports = to_lamports
        .checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    Ok(())
}

fn distribute(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let vault_account = next_account_info(iter)?;
    let config_account = next_account_info(iter)?;
    let platform_wallet = next_account_info(iter)?;
    let creator_wallet = next_account_info(iter)?;

    let config = load_config(config_account, program_id)?;
    let mut vault = load_vault(vault_account, program_id)?;

    if *platform_wallet.key != config.platform_wallet {
        return Err(ProgramError::InvalidArgument);
    }

    // The AMM pays creator fees as *wrapped* SOL into a token account owned by
    // the vault, and the bonding curve pays native lamports. Unwrap first, or
    // the larger of the two shares is invisible to the split below.
    if let Ok(wsol_account) = next_account_info(iter) {
        let token_program = next_account_info(iter)?;
        unwrap_wsol(&vault, vault_account, wsol_account, token_program)?;
    }

    // A data account that drops below rent exemption is purged, taking the
    // creator's registration — and their reserved share — with it.
    let rent_floor = Rent::get()?.minimum_balance(Vault::LEN);
    let balance = vault_account.lamports();

    let unreserved = balance
        .saturating_sub(rent_floor)
        .saturating_sub(vault.creator_reserved);
    if unreserved == 0 && vault.creator_reserved == 0 {
        msg!("nothing to distribute");
        return Ok(());
    }

    // Split the new income. The platform takes the remainder rather than its
    // own percentage, so rounding dust always lands on our side of the line
    // rather than being lost.
    let creator_cut = (unreserved as u128)
        .checked_mul(BPS_CREATOR as u128)
        .ok_or(ProgramError::ArithmeticOverflow)?
        .checked_div(BPS_TOTAL as u128)
        .ok_or(ProgramError::ArithmeticOverflow)? as u64;
    let platform_cut = unreserved
        .checked_sub(creator_cut)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    pay(vault_account, platform_wallet, platform_cut)?;
    vault.lifetime_platform = vault
        .lifetime_platform
        .checked_add(platform_cut)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    let owed = vault
        .creator_reserved
        .checked_add(creator_cut)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    if vault.is_registered() {
        if *creator_wallet.key != vault.payout_wallet {
            return Err(ProgramError::InvalidArgument);
        }
        pay(vault_account, creator_wallet, owed)?;
        vault.creator_reserved = 0;
        vault.lifetime_creator = vault
            .lifetime_creator
            .checked_add(owed)
            .ok_or(ProgramError::ArithmeticOverflow)?;
    } else {
        // Hold it in place. Recording it is what stops the next distribution
        // from charging the platform's 10% against the same lamports again.
        vault.creator_reserved = owed;
    }

    vault.serialize(&mut &mut vault_account.data.borrow_mut()[..])?;
    Ok(())
}

/// Closes the vault's wrapped-SOL account, turning the AMM's share into native
/// lamports on the vault itself.
fn unwrap_wsol<'a>(
    vault: &Vault,
    vault_account: &AccountInfo<'a>,
    wsol_account: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
) -> ProgramResult {
    if *token_program.key != spl_token::id() {
        return Err(ProgramError::IncorrectProgramId);
    }
    if wsol_account.data_is_empty() || wsol_account.owner != &spl_token::id() {
        // Nothing wrapped yet. Not an error: most vaults will be in this state
        // until their coin graduates to the AMM.
        return Ok(());
    }

    let expected =
        associated_token_address(vault_account.key, &spl_token::native_mint::id());
    if *wsol_account.key != expected {
        return Err(ProgramError::InvalidArgument);
    }

    let platform_seed = [vault.platform];
    let bump_seed = [vault.bump];
    let signer: &[&[u8]] = &[VAULT_SEED, &platform_seed, &vault.handle_hash, &bump_seed];

    invoke_signed(
        &spl_token::instruction::close_account(
            &spl_token::id(),
            wsol_account.key,
            vault_account.key,
            vault_account.key,
            &[],
        )?,
        &[
            wsol_account.clone(),
            vault_account.clone(),
            vault_account.clone(),
            token_program.clone(),
        ],
        &[signer],
    )?;

    Ok(())
}
