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
//! ## Constants
//! - `VOTING_PERIOD`: 120 960 ledgers (~7 days at 5 s/ledger)
//! - `QUORUM`: minimum 1 yes-vote required to pass
//!
//! ## Usage
//! ```ignore
//! let id = client.create_proposal(&proposer, &title, &description);
//! client.vote(&voter, &id, &true);
//! // advance ledger past voting period …
//! client.finalise(&id);
//! client.execute(&id); // admin only
//! ```
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

// ── Constants ─────────────────────────────────────────────────────────────────

/// Voting period in ledgers (~7 days at 5 s/ledger).
const VOTING_PERIOD: u32 = 120_960;
/// Minimum yes-votes required for a proposal to pass.
const QUORUM: u32 = 1;

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
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct GovernanceContract;

#[contractimpl]
impl GovernanceContract {
    /// Initialise with an admin address.
    ///
    /// # Parameters
    /// - `admin` – Address authorized to call [`execute`](GovernanceContract::execute).
    ///
    /// # Panics
    /// - `"already initialised"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialised");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ProposalCount, &0_u32);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn admin(env: &Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    fn proposal_count(env: &Env) -> u32 {
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
    /// # Parameters
    /// - `proposer` – Address creating the proposal (must authorize).
    /// - `title` – Short human-readable title (max ~32 chars recommended).
    /// - `description` – Full proposal description.
    ///
    /// # Returns
    /// The new proposal id (`u32`), starting at `1`.
    ///
    /// # Authorization
    /// Requires `proposer` authorization.
    ///
    /// # Events
    /// Emits `("gov", "proposed")` with data `(id: u32, proposer: Address, title: String)`.
    pub fn create_proposal(
        env: Env,
        proposer: Address,
        title: String,
        description: String,
    ) -> u32 {
        proposer.require_auth();

        let id = Self::proposal_count(&env) + 1;
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

        // emit proposal_created event
        env.events().publish(
            (symbol_short!("gov"), symbol_short!("proposed")),
            (id, proposer, title),
        );

        id
    }

    // ── Voting ────────────────────────────────────────────────────────────────

    /// Cast a vote on an active proposal. Each address may vote once.
    ///
    /// # Parameters
    /// - `voter` – Address casting the vote (must authorize).
    /// - `proposal_id` – Id of the proposal to vote on.
    /// - `support` – `true` for yes, `false` for no.
    ///
    /// # Authorization
    /// Requires `voter` authorization.
    ///
    /// # Events
    /// Emits `("gov", "voted")` with data `(proposal_id: u32, voter: Address, support: bool)`.
    ///
    /// # Panics
    /// - `"already voted"` if the voter has already cast a vote on this proposal.
    /// - `"proposal not active"` if the proposal is not in `Active` status.
    /// - `"voting period ended"` if the current ledger sequence exceeds `end_ledger`.
    pub fn vote(env: Env, voter: Address, proposal_id: u32, support: bool) {
        voter.require_auth();

        let voted_key = DataKey::HasVoted(proposal_id, voter.clone());
        if env.storage().persistent().get::<_, bool>(&voted_key).unwrap_or(false) {
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

        // record vote to prevent double-voting
        env.storage().persistent().set(&voted_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&voted_key, 2_678_400, 2_678_400);

        // emit voted event
        env.events().publish(
            (symbol_short!("gov"), symbol_short!("voted")),
            (proposal_id, voter, support),
        );
    }

    // ── Finalise ──────────────────────────────────────────────────────────────

    /// Finalise a proposal after its voting period ends.
    ///
    /// Tallies votes and transitions the proposal to `Passed` or `Rejected`.
    /// A proposal passes when `yes_votes >= QUORUM && yes_votes > no_votes`.
    ///
    /// # Parameters
    /// - `proposal_id` – Id of the proposal to finalise.
    ///
    /// # Events
    /// Emits `("gov", "finalised")` with data `(proposal_id: u32, passed: bool)`.
    ///
    /// # Panics
    /// - `"proposal not active"` if the proposal is not in `Active` status.
    /// - `"voting period not ended"` if the current ledger sequence is ≤ `end_ledger`.
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

        proposal.status = if proposal.yes_votes >= QUORUM && proposal.yes_votes > proposal.no_votes
        {
            ProposalStatus::Passed
        } else {
            ProposalStatus::Rejected
        };

        let status = proposal.status.clone();
        Self::save_proposal(&env, &proposal);

        // emit finalised event
        env.events().publish(
            (symbol_short!("gov"), symbol_short!("finalised")),
            (proposal_id, status == ProposalStatus::Passed),
        );
    }

    // ── Execution ─────────────────────────────────────────────────────────────

    /// Execute a passed proposal. Admin-gated.
    ///
    /// Marks the proposal as `Executed` and emits an event. Actual on-chain
    /// side-effects (e.g. parameter updates) must be implemented by the caller
    /// after verifying the emitted event.
    ///
    /// # Parameters
    /// - `proposal_id` – Id of the proposal to execute.
    ///
    /// # Authorization
    /// Requires admin authorization.
    ///
    /// # Events
    /// Emits `("gov", "executed")` with data `(proposal_id: u32, proposer: Address)`.
    ///
    /// # Panics
    /// - `"proposal not passed"` if the proposal status is not `Passed`.
    pub fn execute(env: Env, proposal_id: u32) {
        Self::admin(&env).require_auth();

        let mut proposal = Self::load_proposal(&env, proposal_id);
        assert!(
            proposal.status == ProposalStatus::Passed,
            "proposal not passed"
        );

        proposal.status = ProposalStatus::Executed;
        Self::save_proposal(&env, &proposal);

        // emit executed event
        env.events().publish(
            (symbol_short!("gov"), symbol_short!("executed")),
            (proposal_id, proposal.proposer),
        );
    }

    // ── Read-only ─────────────────────────────────────────────────────────────

    /// Returns the full [`Proposal`] struct for a given id.
    ///
    /// # Panics
    /// - `"proposal not found"` if no proposal exists with the given id.
    pub fn get_proposal(env: Env, proposal_id: u32) -> Proposal {
        Self::load_proposal(&env, proposal_id)
    }

    /// Returns the total number of proposals created.
    pub fn proposal_count(env: Env) -> u32 {
        Self::proposal_count(&env)
    }

    /// Returns `true` if `voter` has already voted on `proposal_id`.
    pub fn has_voted(env: Env, proposal_id: u32, voter: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::HasVoted(proposal_id, voter))
            .unwrap_or(false)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Events, Ledger}, Env, String};

    fn setup() -> (Env, Address, GovernanceContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
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

    // ── Proposal creation ─────────────────────────────────────────────────────

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

    // ── Voting ────────────────────────────────────────────────────────────────

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
        client.vote(&voter, &id, &false); // should panic
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

    // ── Finalise ──────────────────────────────────────────────────────────────

    #[test]
    fn test_finalise_passed() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        let voter = Address::generate(&env);
        client.vote(&voter, &id, &true);

        // advance ledger past voting period
        env.ledger().with_mut(|l| l.sequence_number += VOTING_PERIOD + 1);
        client.finalise(&id);

        assert_eq!(client.get_proposal(&id).status, ProposalStatus::Passed);
    }

    #[test]
    fn test_finalise_rejected_no_quorum() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        // no votes cast → yes_votes = 0 < QUORUM

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
        client.vote(&v1, &id, &true);
        client.vote(&v2, &id, &false);
        // tie → no_votes not strictly less than yes_votes → rejected
        // Actually yes > no here (1 > 1 is false), so rejected
        // Let's add another no vote
        let v3 = Address::generate(&env);
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
        client.finalise(&id); // should panic — period not over
    }

    // ── Execution ─────────────────────────────────────────────────────────────

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
        client.finalise(&id); // rejected (no votes)
        client.execute(&id);  // should panic
    }

    #[test]
    #[should_panic(expected = "proposal not passed")]
    fn test_execute_active_proposal_panics() {
        let (env, _, client) = setup();
        let (id, _) = make_proposal(&env, &client);
        client.execute(&id); // should panic — still active
    }
}
