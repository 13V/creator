use borsh::BorshDeserialize;
use fee_splitter::{
    instruction::SplitterInstruction,
    process_instruction,
    state::{Config, Vault, CONFIG_SEED, VAULT_SEED},
};
use solana_program_test::{processor, BanksClient, ProgramTest};
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction},
    native_token::LAMPORTS_PER_SOL,
    pubkey::Pubkey,
    rent::Rent,
    signature::{Keypair, Signer},
    system_program,
    transaction::Transaction,
};

const PROGRAM_ID: Pubkey = solana_sdk::pubkey!("FeeFKjiJfwLmnEN5QX9aBxV4bcW1vnx5wLQPSwE3qWZR");
const HANDLE: [u8; 32] = [7u8; 32];
const PLATFORM_X: u8 = 0;

fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED], &PROGRAM_ID).0
}

fn vault_pda(platform: u8, handle: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(&[VAULT_SEED, &[platform], handle], &PROGRAM_ID).0
}

fn ix(data: SplitterInstruction, accounts: Vec<AccountMeta>) -> Instruction {
    Instruction {
        program_id: PROGRAM_ID,
        accounts,
        data: borsh::to_vec(&data).unwrap(),
    }
}

struct Harness {
    banks: BanksClient,
    payer: Keypair,
    blockhash: solana_sdk::hash::Hash,
    authority: Keypair,
    platform_wallet: Pubkey,
    nonce: u64,
}

impl Harness {
    async fn send(&mut self, instructions: &[Instruction], signers: Vec<&Keypair>) -> Result<(), String> {
        // Cranking `distribute` repeatedly is the point of one of these tests,
        // and program-test holds one blockhash, so identical transactions would
        // dedupe rather than run. A varying self-transfer keeps each unique.
        self.nonce += 1;
        let mut all_ix = vec![solana_sdk::system_instruction::transfer(
            &self.payer.pubkey(),
            &self.payer.pubkey(),
            self.nonce,
        )];
        all_ix.extend_from_slice(instructions);

        let mut all = vec![&self.payer];
        all.extend(signers);
        let tx = Transaction::new_signed_with_payer(
            &all_ix,
            Some(&self.payer.pubkey()),
            &all,
            self.blockhash,
        );
        self.banks
            .process_transaction(tx)
            .await
            .map_err(|e| format!("{e:?}"))
    }

    async fn lamports(&mut self, key: Pubkey) -> u64 {
        self.banks
            .get_account(key)
            .await
            .unwrap()
            .map(|a| a.lamports)
            .unwrap_or(0)
    }

    async fn vault(&mut self, key: Pubkey) -> Vault {
        let account = self.banks.get_account(key).await.unwrap().unwrap();
        Vault::try_from_slice(&account.data).unwrap()
    }

    /// Simulates pump.fun's `collectCreatorFee`, which just moves lamports into
    /// whatever address was named as the coin's creator.
    async fn accrue_fees(&mut self, vault: Pubkey, amount: u64) {
        let ix = solana_sdk::system_instruction::transfer(&self.payer.pubkey(), &vault, amount);
        self.send(&[ix], vec![]).await.unwrap();
    }
}

async fn setup() -> (Harness, Pubkey) {
    let authority = Keypair::new();
    let platform_wallet = Pubkey::new_unique();

    let mut test = ProgramTest::new("fee_splitter", PROGRAM_ID, processor!(process_instruction));
    // Rent-exempt so a distribution to it is a plain credit, as in production.
    test.add_account(
        platform_wallet,
        Account {
            lamports: Rent::default().minimum_balance(0),
            ..Account::default()
        },
    );

    let (banks, payer, blockhash) = test.start().await;
    let mut h = Harness {
        banks,
        payer,
        blockhash,
        authority,
        platform_wallet,
        nonce: 0,
    };

    h.send(
        &[ix(
            SplitterInstruction::InitializeConfig {
                admin: h.payer.pubkey(),
                platform_wallet,
                verification_authority: h.authority.pubkey(),
            },
            vec![
                AccountMeta::new(h.payer.pubkey(), true),
                AccountMeta::new(config_pda(), false),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
        )],
        vec![],
    )
    .await
    .unwrap();

    let vault = vault_pda(PLATFORM_X, &HANDLE);
    h.send(
        &[ix(
            SplitterInstruction::InitializeVault {
                platform: PLATFORM_X,
                handle_hash: HANDLE,
            },
            vec![
                AccountMeta::new(h.payer.pubkey(), true),
                AccountMeta::new(vault, false),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
        )],
        vec![],
    )
    .await
    .unwrap();

    (h, vault)
}

fn distribute_ix(vault: Pubkey, platform_wallet: Pubkey, creator_wallet: Pubkey) -> Instruction {
    ix(
        SplitterInstruction::Distribute,
        vec![
            AccountMeta::new(vault, false),
            AccountMeta::new_readonly(config_pda(), false),
            AccountMeta::new(platform_wallet, false),
            AccountMeta::new(creator_wallet, false),
        ],
    )
}

#[tokio::test]
async fn config_and_vault_initialize() {
    let (mut h, vault_key) = setup().await;

    let config = Config::try_from_slice(
        &h.banks.get_account(config_pda()).await.unwrap().unwrap().data,
    )
    .unwrap();
    assert!(config.is_initialized);
    assert_eq!(config.platform_wallet, h.platform_wallet);

    let vault = h.vault(vault_key).await;
    assert!(vault.is_initialized);
    assert_eq!(vault.payout_wallet, Pubkey::default());
    assert_eq!(vault.creator_reserved, 0);
}

#[tokio::test]
async fn splits_ninety_ten_once_registered() {
    let (mut h, vault_key) = setup().await;
    let creator = Pubkey::new_unique();

    h.send(
        &[ix(
            SplitterInstruction::RegisterPayout {
                payout_wallet: creator,
            },
            vec![
                AccountMeta::new_readonly(h.authority.pubkey(), true),
                AccountMeta::new_readonly(config_pda(), false),
                AccountMeta::new(vault_key, false),
            ],
        )],
        vec![&h.authority.insecure_clone()],
    )
    .await
    .unwrap();

    let fees = 10 * LAMPORTS_PER_SOL;
    h.accrue_fees(vault_key, fees).await;

    let platform_before = h.lamports(h.platform_wallet).await;
    h.send(&[distribute_ix(vault_key, h.platform_wallet, creator)], vec![])
        .await
        .unwrap();

    assert_eq!(h.lamports(creator).await, fees / 10 * 9, "creator gets 90%");
    assert_eq!(
        h.lamports(h.platform_wallet).await - platform_before,
        fees / 10,
        "platform gets 10%"
    );

    // The vault keeps exactly its rent, never a lamport more or less.
    assert_eq!(
        h.lamports(vault_key).await,
        Rent::default().minimum_balance(Vault::LEN)
    );
}

/// The case that would quietly steal from creators.
///
/// An unregistered creator's 90% stays in the vault. If distribution treated
/// the whole balance as new income each time, the platform would take 10% of
/// that same money again on every crank — and a keeper running hourly would
/// drain most of a creator's fees before they ever claimed.
#[tokio::test]
async fn does_not_charge_the_platform_cut_twice_on_reserved_funds() {
    let (mut h, vault_key) = setup().await;

    let first = 10 * LAMPORTS_PER_SOL;
    h.accrue_fees(vault_key, first).await;

    let platform_start = h.lamports(h.platform_wallet).await;
    h.send(&[distribute_ix(vault_key, h.platform_wallet, vault_key)], vec![])
        .await
        .unwrap();

    assert_eq!(
        h.vault(vault_key).await.creator_reserved,
        first / 10 * 9,
        "the creator's share is held, not paid"
    );

    // Crank it four more times with no new fees at all.
    for _ in 0..4 {
        h.send(&[distribute_ix(vault_key, h.platform_wallet, vault_key)], vec![])
            .await
            .unwrap();
    }

    assert_eq!(
        h.lamports(h.platform_wallet).await - platform_start,
        first / 10,
        "platform took its 10% exactly once"
    );
    assert_eq!(
        h.vault(vault_key).await.creator_reserved,
        first / 10 * 9,
        "the creator's reserve is untouched"
    );

    // A second round of real fees is split on its own, not on the reserve.
    let second = 5 * LAMPORTS_PER_SOL;
    h.accrue_fees(vault_key, second).await;
    h.send(&[distribute_ix(vault_key, h.platform_wallet, vault_key)], vec![])
        .await
        .unwrap();

    assert_eq!(
        h.lamports(h.platform_wallet).await - platform_start,
        (first + second) / 10,
        "platform total is 10% of all income, once each"
    );
    assert_eq!(
        h.vault(vault_key).await.creator_reserved,
        (first + second) / 10 * 9
    );
}

#[tokio::test]
async fn registering_later_releases_everything_accrued() {
    let (mut h, vault_key) = setup().await;
    let creator = Pubkey::new_unique();

    h.accrue_fees(vault_key, 8 * LAMPORTS_PER_SOL).await;
    h.send(&[distribute_ix(vault_key, h.platform_wallet, vault_key)], vec![])
        .await
        .unwrap();

    let reserved = h.vault(vault_key).await.creator_reserved;
    assert!(reserved > 0);

    h.send(
        &[ix(
            SplitterInstruction::RegisterPayout {
                payout_wallet: creator,
            },
            vec![
                AccountMeta::new_readonly(h.authority.pubkey(), true),
                AccountMeta::new_readonly(config_pda(), false),
                AccountMeta::new(vault_key, false),
            ],
        )],
        vec![&h.authority.insecure_clone()],
    )
    .await
    .unwrap();

    h.send(&[distribute_ix(vault_key, h.platform_wallet, creator)], vec![])
        .await
        .unwrap();

    assert_eq!(h.lamports(creator).await, reserved);
    assert_eq!(h.vault(vault_key).await.creator_reserved, 0);
}

#[tokio::test]
async fn rejects_a_substituted_platform_wallet() {
    let (mut h, vault_key) = setup().await;
    h.accrue_fees(vault_key, LAMPORTS_PER_SOL).await;

    let attacker = Pubkey::new_unique();
    let err = h
        .send(&[distribute_ix(vault_key, attacker, vault_key)], vec![])
        .await
        .unwrap_err();
    assert!(err.contains("InvalidArgument"), "got: {err}");
}

#[tokio::test]
async fn rejects_a_substituted_creator_wallet() {
    let (mut h, vault_key) = setup().await;
    let creator = Pubkey::new_unique();

    h.send(
        &[ix(
            SplitterInstruction::RegisterPayout {
                payout_wallet: creator,
            },
            vec![
                AccountMeta::new_readonly(h.authority.pubkey(), true),
                AccountMeta::new_readonly(config_pda(), false),
                AccountMeta::new(vault_key, false),
            ],
        )],
        vec![&h.authority.insecure_clone()],
    )
    .await
    .unwrap();
    h.accrue_fees(vault_key, LAMPORTS_PER_SOL).await;

    let attacker = Pubkey::new_unique();
    let err = h
        .send(&[distribute_ix(vault_key, h.platform_wallet, attacker)], vec![])
        .await
        .unwrap_err();
    assert!(err.contains("InvalidArgument"), "got: {err}");
}

#[tokio::test]
async fn only_the_verification_authority_can_register_a_payout() {
    let (mut h, vault_key) = setup().await;
    let impostor = Keypair::new();

    let err = h
        .send(
            &[ix(
                SplitterInstruction::RegisterPayout {
                    payout_wallet: impostor.pubkey(),
                },
                vec![
                    AccountMeta::new_readonly(impostor.pubkey(), true),
                    AccountMeta::new_readonly(config_pda(), false),
                    AccountMeta::new(vault_key, false),
                ],
            )],
            vec![&impostor],
        )
        .await
        .unwrap_err();
    assert!(err.contains("MissingRequiredSignature"), "got: {err}");
}

/// Distribution must never take the vault below rent exemption: the account
/// would be purged and the creator's registration and reserve with it.
#[tokio::test]
async fn never_spends_below_rent_exemption() {
    let (mut h, vault_key) = setup().await;
    let floor = Rent::default().minimum_balance(Vault::LEN);

    // No fees at all — distribution should be a no-op, not a raid on the rent.
    h.send(&[distribute_ix(vault_key, h.platform_wallet, vault_key)], vec![])
        .await
        .unwrap();
    assert_eq!(h.lamports(vault_key).await, floor);

    // A dust amount, far below what a 90/10 split divides evenly.
    h.accrue_fees(vault_key, 7).await;
    h.send(&[distribute_ix(vault_key, h.platform_wallet, vault_key)], vec![])
        .await
        .unwrap();
    assert!(h.lamports(vault_key).await >= floor);
}

/// Emits the addresses the program will actually derive, for the TypeScript
/// client to assert against.
///
/// This is the one mismatch that cannot be recovered from: pump.fun fixes a
/// coin's creator permanently at launch, so if the launcher derives a vault
/// address the program does not control, that coin's fees are stranded for
/// good. Generating the fixture here rather than hand-copying it means the two
/// sides cannot drift apart silently.
#[test]
fn emit_pda_fixtures() {
    use std::fmt::Write as _;

    let cases: [(&str, u8, &str); 4] = [
        ("x", 0, "mrbeast"),
        ("instagram", 1, "zendaya"),
        ("tiktok", 2, "khaby.lame"),
        // Case folding matters: two vaults for one creator would split their
        // fees across addresses neither of them could merge.
        ("x", 0, "MrBeast"),
    ];

    let mut json = String::from("{\n");
    let _ = writeln!(json, "  \"programId\": \"{PROGRAM_ID}\",");
    let _ = writeln!(json, "  \"config\": \"{}\",", config_pda());
    let _ = writeln!(json, "  \"vaults\": [");

    for (i, (platform_name, platform, handle)) in cases.iter().enumerate() {
        let hash: [u8; 32] = solana_sdk::hash::hash(handle.to_lowercase().as_bytes()).to_bytes();
        let (pubkey, bump) =
            Pubkey::find_program_address(&[VAULT_SEED, &[*platform], &hash], &PROGRAM_ID);
        let comma = if i + 1 == cases.len() { "" } else { "," };
        let _ = writeln!(
            json,
            "    {{ \"platform\": \"{platform_name}\", \"handle\": \"{handle}\", \"pubkey\": \"{pubkey}\", \"bump\": {bump} }}{comma}"
        );
    }
    let _ = writeln!(json, "  ]\n}}");

    std::fs::write(
        concat!(env!("CARGO_MANIFEST_DIR"), "/tests/pda-fixtures.json"),
        json,
    )
    .unwrap();
}
