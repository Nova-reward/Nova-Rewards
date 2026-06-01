//! # Governance Contract
//!
//! On-chain governance for Nova Rewards protocol parameter changes.
//!
//! ## Lifecycle
//! 1. Any address calls [`create_proposal`](GovernanceContract::create_proposal) to open a vote.
//! 2. Token holders call [`vote`](GovernanceContract::vote) during the voting period (~7 days).
//! 3. After the period ends, anyone calls [`finalise`](GovernanceContract::finalise) to tally votes.
//! 4. The admin calls [`execute`](GovernanceContract::execute) to mark a passed proposal as executed.
//!
//! ## Upgrade
//! Admin signers call [`approve_upgrade`](GovernanceContract::approve_upgrade) with a new WASM hash.
//! Requires M-of-N admin signatures. Emits `ContractUpgraded` event.
//!
//! ## Event Schema (v1)
//! All events include `schema_version` as the first data element.
//!
//! | topics                      | data                                                    |
//! |-----------------------------|---------------------------------------------------------|
//! | `("gov", "proposed")`       | `(v, id, proposer, title)`                              |
//! | `("gov", "voted")`          | `(v, proposal_id, voter, support)`                      |
//! | `("gov", "finalised")`      | `(v, proposal_id, passed)`                              |
//! | `("gov", "executed")`       | `(v, proposal_id, proposer)`                            |
//! | `("gov", "upgraded")`       | `(v, new_wasm_hash)`                                    |
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, String, Vec,
};

// ── Constants ─────────────────────────────────────────────────────────────────

/// Voting period in ledgers (~7 days at 5 s/ledger).
const VOTING_PERIOD: u32 = 120_960;
/// Minimum yes-votes required for a proposal to pass.
const QUORUM: u32 = 1;

/// Schema version for all events emitted by this contract.
pub const EVENT_SCHEMA_VERSION: u32 = 1;

// ── Types ─────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum ProposalStatus {
    Active,
    Passed,
    Rejected,
    Executed,
}

#[contracttype]
#[derive(Clone)]
pub struct Proposal {
    pub id: u32,
    pub proposer: Address,
    pub title: String,
    pub description: String,
    pub yes_votes: u32,
    pub no_votes: u32,
    pub end_ledger: u32,
    pub status: ProposalStatus,
}

// ── Storage keys ──────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    ProposalCount,
    Proposal(u32),
    /// (proposal_id, voter) → bool
    HasVoted(u32, Address),
    /// Multisig signers for upgrade authorization
    Signers,
    /// Minimum approvals required for upgrade
    Threshold,
    /// Pending upgrade approvals: wasm_hash -> Vec<Address>
    UpgradeApprovals(BytesN<32>),
}

// ── Event helpers ─────────────────────────────────────────────────────────────

fn emit_proposed(env: &Env, id: u32, proposer: &Address, title: &String) {
    env.events().publish(
        (symbol_short!("gov"), symbol_short!("proposed")),
        (EVENT_SCHEMA_VERSION, id, proposer.clone(), title.clone()),
    );
}

fn emit_voted(env: &Env, proposal_id: u32, voter: &Address, support: bool) {
    env.events().publish(
        (symbol_short!("gov"), symbol_short!("voted")),
        (EVENT_SCHEMA_VERSION, proposal_id, voter.clone(), support),
    );
}

fn emit_finalised(env: &Env, proposal_id: u32, passed: bool) {
    env.events().publish(
        (symbol_short!("gov"), symbol_short!("finalised")),
        (EVENT_SCHEMA_VERSION, proposal_id, passed),
    );
}

fn emit_executed(env: &Env, proposal_id: u32, proposer: &Address) {
    env.events().publish(
        (symbol_short!("gov"), symbol_short!("executed")),
        (EVENT_SCHEMA_VERSION, proposal_id, proposer.clone()),
    );
}

fn emit_contract_upgraded(env: &Env, new_wasm_hash: &BytesN<32>) {
    env.events().publish(
        (symbol_short!("gov"), symbol_short!("upgraded")),
        (EVENT_SCHEMA_VERSION, new_wasm_hash.clone()),
    );
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct GovernanceContract;

#[contractimpl]
impl GovernanceContract {
    /// Initialise with an admin address and upgrade multisig config.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call [`execute`](GovernanceContract::execute).
    /// - `signers` – Multisig signer set for upgrade authorization.
    /// - `threshold` – Minimum approvals required to execute an upgrade.
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address, signers: Vec<Address>, threshold: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        assert!(threshold >= 1, "threshold must be at least 1");
        assert!(
            signers.len() >= threshold,
            "signers count must be >= threshold"
        );
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ProposalCount, &0_u32);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn proposal_count_val(env: &Env) -> u32 {
        env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0)
    }

    fn load_proposal(env: &Env, id: u32) -> Proposal {
        env.storage()
            .persistent()
            .get(&DataKey::Proposal(id))
            .expect("proposal not found")
    }

    fn save_proposal(env: &Env, proposal: &Proposal) {
        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal.id), proposal);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Proposal(proposal.id), 2_678_400, 2_678_400);
    }

    // ── Proposal creation ─────────────────────────────────────────────────────

    /// Create a new governance proposal. Any address may propose.
    ///
    /// # Events
    /// Emits `("gov", "proposed")` with `(schema_version, id, proposer, title)`.
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        title: String,
        description: String,
    ) -> u32 {
        proposer.require_auth();

        let id = Self::proposal_count_val(&env) + 1;
        let end_ledger = env.ledger().sequence() + VOTING_PERIOD;

        let proposal = Proposal {
            id,
            proposer: proposer.clone(),
            title: title.clone(),
            description,
            yes_votes: 0,
            no_votes: 0,
            end_ledger,
            status: ProposalStatus::Active,
        };

        Self::save_proposal(&env, &proposal);
        env.storage().instance().set(&DataKey::ProposalCount, &id);

        emit_proposed(&env, id, &proposer, &title);

        id
    }

    // ── Voting ────────────────────────────────────────────────────────────────

    /// Cast a vote on an active proposal. Each address may vote once.
    ///
    /// # Events
    /// Emits `("gov", "voted")` with `(schema_version, proposal_id, voter, support)`.
    pub fn vote(env: Env, voter: Address, proposal_id: u32, support: bool) {
        voter.require_auth();

        let voted_key = DataKey::HasVoted(proposal_id, voter.clone());
        if env
            .storage()
            .persistent()
            .get::<_, bool>(&voted_key)
            .unwrap_or(false)
        {
            panic!("already voted");
        }

        let mut proposal = Self::load_proposal(&env, proposal_id);
        assert!(
            proposal.status == ProposalStatus::Active,
            "proposal not active"
        );
        assert!(
            env.ledger().sequence() <= proposal.end_ledger,
            "voting period ended"
        );

        if support {
            proposal.yes_votes += 1;
        } else {
            proposal.no_votes += 1;
        }

        Self::save_proposal(&env, &proposal);

        env.storage().persistent().set(&voted_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&voted_key, 2_678_400, 2_678_400);

        emit_voted(&env, proposal_id, &voter, support);
    }

    // ── Finalise ──────────────────────────────────────────────────────────────

    /// Finalise a proposal after its voting period ends.
    ///
    /// # Events
    /// Emits `("gov", "finalised")` with `(schema_version, proposal_id, passed)`.
    pub fn finalise(env: Env, proposal_id: u32) {
        let mut proposal = Self::load_proposal(&env, proposal_id);
        assert!(
            proposal.status == ProposalStatus::Active,
            "proposal not active"
        );
        assert!(
            env.ledger().sequence() > proposal.end_ledger,
            "voting period not ended"
        );

        let passed =
            proposal.yes_votes >= QUORUM && proposal.yes_votes > proposal.no_votes;
        proposal.status = if passed {
            ProposalStatus::Passed
        } else {
            ProposalStatus::Rejected
        };

        Self::save_proposal(&env, &proposal);

        emit_finalised(&env, proposal_id, passed);
    }

    // ── Execution ─────────────────────────────────────────────────────────────

    /// Execute a passed proposal. Admin-gated.
    ///
    /// # Events
    /// Emits `("gov", "executed")` with `(schema_version, proposal_id, proposer)`.
    pub fn execute(env: Env, proposal_id: u32) {
        Self::admin(&env).require_auth();

        let mut proposal = Self::load_proposal(&env, proposal_id);
        assert!(
            proposal.status == ProposalStatus::Passed,
            "proposal not passed"
        );

        proposal.status = ProposalStatus::Executed;
        Self::save_proposal(&env, &proposal);

        emit_executed(&env, proposal_id, &proposal.proposer);
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    pub fn get_proposal(env: Env, proposal_id: u32) -> Proposal {
        Self::load_proposal(&env, proposal_id)
    }

    pub fn proposal_count(env: Env) -> u32 {
        Self::proposal_count_val(&env)
    }

    pub fn has_voted(env: Env, proposal_id: u32, voter: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::HasVoted(proposal_id, voter))
            .unwrap_or(false)
    }

    // ── Upgrade (M-of-N multisig) ─────────────────────────────────────────────

    /// Approve a pending WASM upgrade. Executes when threshold is reached.
    ///
    /// # Events
    /// Emits `("gov", "upgraded")` with `(schema_version, new_wasm_hash)` when threshold is met.
    ///
    /// # Panics
    /// - `"not an authorized signer"` if `signer` is not in the signer set.
    /// - `"already approved"` if `signer` has already approved this hash.
    pub fn approve_upgrade(env: Env, signer: Address, new_wasm_hash: BytesN<32>) {
        signer.require_auth();

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .expect("not initialized");
        let is_authorized = signers.iter().any(|s| s == signer);
        assert!(is_authorized, "not an authorized signer");

        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash.clone());
        let mut approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));

        let already_approved = approvals.iter().any(|a| a == signer);
        assert!(!already_approved, "already approved");

        approvals.push_back(signer);
        env.storage().instance().set(&approval_key, &approvals);

        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1);

        if approvals.len() >= threshold {
            env.storage().instance().remove(&approval_key);
            emit_contract_upgraded(&env, &new_wasm_hash);
            env.deployer().update_current_contract_wasm(new_wasm_hash);
        }
    }

    pub fn get_upgrade_approvals(env: Env, new_wasm_hash: BytesN<32>) -> u32 {
        let approval_key = DataKey::UpgradeApprovals(new_wasm_hash);
        let approvals: Vec<Address> = env
            .storage()
            .instance()
            .get(&approval_key)
            .unwrap_or(Vec::new(&env));
        approvals.len()
    }

    pub fn get_threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(1)
    }

    pub fn get_signers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(Vec::new(&env))
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events, Ledger},
        vec, BytesN, Env, String,
    };

    fn setup() -> (Env, Address, GovernanceContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin, &vec![&env, admin.clone()], &1);
        (env, admin, client)
    }

    fn make_proposal(env: &Env, client: &GovernanceContractClient) -> (u32, Address) {
        let proposer = Address::generate(env);
        let id = client.create_proposal(
            &proposer,
            &String::from_str(env, "Increase reward rate"),
            &String::from_str(env, "Raise the base reward rate from 1% to 2%"),
        );
        (id, proposer)
    }

    #[test]
    fn test_create_proposal() {
        let (env, _, client) = setup();
        let (id, proposer) = make_proposal(&env, &client);

        assert_eq!(id, 1);
        assert_eq!(client.proposal_count(), 1);

        let p = client.get_proposal(&id);
        assert_eq!(p.id, 1);
        assert_eq!(p.proposer, proposer);
        assert_eq!(p.yes_votes, 0);
        assert_eq!(p.no_votes, 0);
        assert_eq!(p.status, ProposalStatus::Active);
    }

    #[test]
    fn test_create_proposal_emits_event() {
        let (env, _, client) = setup();
        make_proposal(&env, &client);
        assert!(env.events().all().len() >= 1);
    }

    #[test]
    fn test_multiple_proposals_increment_id() {
        let (env, _, client) = setup();
        let (id1, _) = make_proposal(&env, &client);
        let (id2, _) = make_proposal(&env, &client);
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
        assert_eq!(client.proposal_count(), 2);
    }

    #[test]
    fn test_vote_yes() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let voter = Address::generate(&env);

        client.vote(&voter, &id, &true);

        let p = client.get_proposal(&id);
        assert_eq!(p.yes_votes, 1);
        assert_eq!(p.no_votes, 0);
        assert!(client.has_voted(&id, &voter));
    }

    #[test]
    fn test_vote_no() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let voter = Address::generate(&env);

        client.vote(&voter, &id, &false);

        let p = client.get_proposal(&id);
        assert_eq!(p.yes_votes, 0);
        assert_eq!(p.no_votes, 1);
    }

    #[test]
    fn test_vote_emits_event() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let voter = Address::generate(&env);
        client.vote(&voter, &id, &true);
        assert!(env.events().all().len() >= 1);
    }

    #[test]
    #[should_panic(expected = "already voted")]
    fn test_double_vote_rejected() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let voter = Address::generate(&env);
        client.vote(&voter, &id, &true);
        client.vote(&voter, &id, &false);
    }

    #[test]
    fn test_multiple_voters() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let v1 = Address::generate(&env);
        let v2 = Address::generate(&env);
        let v3 = Address::generate(&env);

        client.vote(&v1, &id, &true);
        client.vote(&v2, &id, &true);
        client.vote(&v3, &id, &false);

        let p = client.get_proposal(&id);
        assert_eq!(p.yes_votes, 2);
        assert_eq!(p.no_votes, 1);
    }

    #[test]
    fn test_finalise_passed() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let voter = Address::generate(&env);
        client.vote(&voter, &id, &true);

        env.ledger().with_mut(|l| l.sequence_number += VOTING_PERIOD + 1);
        client.finalise(&id);

        assert_eq!(client.get_proposal(&id).status, ProposalStatus::Passed);
    }

    #[test]
    fn test_finalise_rejected_no_quorum() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);

        env.ledger().with_mut(|l| l.sequence_number += VOTING_PERIOD + 1);
        client.finalise(&id);

        assert_eq!(client.get_proposal(&id).status, ProposalStatus::Rejected);
    }

    #[test]
    fn test_finalise_rejected_more_no_than_yes() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let v1 = Address::generate(&env);
        let v2 = Address::generate(&env);
        let v3 = Address::generate(&env);
        client.vote(&v1, &id, &true);
        client.vote(&v2, &id, &false);
        client.vote(&v3, &id, &false);

        env.ledger().with_mut(|l| l.sequence_number += VOTING_PERIOD + 1);
        client.finalise(&id);

        assert_eq!(client.get_proposal(&id).status, ProposalStatus::Rejected);
    }

    #[test]
    fn test_finalise_emits_event() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let voter = Address::generate(&env);
        client.vote(&voter, &id, &true);
        env.ledger().with_mut(|l| l.sequence_number += VOTING_PERIOD + 1);
        client.finalise(&id);
        assert!(env.events().all().len() >= 1);
    }

    #[test]
    #[should_panic(expected = "voting period not ended")]
    fn test_finalise_before_period_ends_panics() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        client.finalise(&id);
    }

    #[test]
    fn test_execute_passed_proposal() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let voter = Address::generate(&env);
        client.vote(&voter, &id, &true);
        env.ledger().with_mut(|l| l.sequence_number += VOTING_PERIOD + 1);
        client.finalise(&id);
        client.execute(&id);

        assert_eq!(client.get_proposal(&id).status, ProposalStatus::Executed);
    }

    #[test]
    fn test_execute_emits_event() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let voter = Address::generate(&env);
        client.vote(&voter, &id, &true);
        env.ledger().with_mut(|l| l.sequence_number += VOTING_PERIOD + 1);
        client.finalise(&id);
        client.execute(&id);
        assert!(env.events().all().len() >= 1);
    }

    #[test]
    #[should_panic(expected = "proposal not passed")]
    fn test_execute_rejected_proposal_panics() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        env.ledger().with_mut(|l| l.sequence_number += VOTING_PERIOD + 1);
        client.finalise(&id);
        client.execute(&id);
    }

    #[test]
    #[should_panic(expected = "proposal not passed")]
    fn test_execute_active_proposal_panics() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        client.execute(&id);
    }

    // ── Upgrade tests ─────────────────────────────────────────────────────────

    #[test]
    fn test_upgrade_approval_accumulates() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &id);
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        client.initialize(&s1, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[0u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        assert_eq!(client.get_upgrade_approvals(&fake_hash), 1);
        assert_eq!(client.get_threshold(), 2);
    }

    #[test]
    #[should_panic(expected = "not an authorized signer")]
    fn test_unauthorized_upgrade_rejected() {
        let (env, _, client) = setup();
        let outsider = Address::generate(&env);
        let fake_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.approve_upgrade(&outsider, &fake_hash);
    }

    #[test]
    #[should_panic(expected = "already approved")]
    fn test_duplicate_approval_rejected() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &id);
        let s1 = Address::generate(&env);
        let s2 = Address::generate(&env);
        client.initialize(&s1, &vec![&env, s1.clone(), s2.clone()], &2);

        let fake_hash = BytesN::from_array(&env, &[2u8; 32]);
        client.approve_upgrade(&s1, &fake_hash);
        client.approve_upgrade(&s1, &fake_hash);
    }
}
