//! # ContractError — Shared Error Enum
//!
//! Defines all failure modes across the Nova Rewards contract suite.
//! Every contract function returns `Result<T, ContractError>` rather than
//! panicking, giving the frontend and backend typed, numeric error codes they
//! can match on and display as meaningful messages.
//!
//! ## ABI / Error Code Reference
//!
//! | Code | Variant                  | Description                                                  |
//! |------|--------------------------|--------------------------------------------------------------|
//! |  1   | `AlreadyInitialized`     | Contract has already been initialized.                       |
//! |  2   | `NotInitialized`         | Contract has not been initialized yet.                       |
//! |  3   | `Unauthorized`           | Caller lacks the required authorization.                     |
//! |  4   | `InsufficientBalance`    | Account balance is too low for the requested operation.      |
//! |  5   | `InsufficientBudget`     | Campaign budget is exhausted; distribution cannot proceed.   |
//! |  6   | `CampaignNotFound`       | No campaign exists with the given identifier.                |
//! |  7   | `CampaignAlreadyExists`  | A campaign with this identifier has already been created.    |
//! |  8   | `CampaignExpired`        | Campaign end ledger has passed; no further actions allowed.  |
//! |  9   | `CampaignNotActive`      | Campaign is paused or ended; operation requires active state.|
//! | 10   | `CampaignAlreadyEnded`   | Campaign has already been permanently ended.                 |
//! | 11   | `CampaignAlreadyPaused`  | Campaign is already in the paused state.                     |
//! | 12   | `CampaignNotPaused`      | Resume was called on a campaign that is not paused.          |
//! | 13   | `InvalidRewardAmount`    | Reward amount must be strictly positive.                     |
//! | 14   | `InvalidBudget`          | Max budget must be greater than zero.                        |
//! | 15   | `InvalidLedgerRange`     | Start ledger must be strictly before end ledger.             |
//! | 16   | `InvalidTokenAddress`    | Provided token address is the zero/invalid address.          |
//! | 17   | `ContractPaused`         | The contract-level pause is active; all writes are blocked.  |
//! | 18   | `AmountMustBePositive`   | A numeric argument must be > 0.                              |
//! | 19   | `BatchTooLarge`          | Batch size exceeds the maximum allowed limit.                |
//! | 20   | `EmptyBatch`             | Batch must contain at least one entry.                       |
//! | 21   | `LengthMismatch`         | Two parallel arrays have different lengths.                  |
//! | 22   | `ClawbackWindowExpired`  | The 30-day clawback window has passed.                       |
//! | 23   | `NoClawbackRecord`       | No distribution record found for this recipient.             |
//! | 24   | `AlreadyVoted`           | This address has already cast a vote on the proposal.        |
//! | 25   | `ProposalNotFound`       | No proposal exists with the given identifier.                |
//! | 26   | `ProposalNotActive`      | Proposal is not in the Active state.                         |
//! | 27   | `VotingPeriodEnded`      | The voting window for this proposal has closed.              |
//! | 28   | `VotingPeriodNotEnded`   | Finalise was called before the voting period ended.          |
//! | 29   | `ProposalNotPassed`      | Execute was called on a proposal that did not pass.          |
//! | 30   | `Overflow`               | Arithmetic overflow detected in a checked operation.         |

#![no_std]

use soroban_sdk::contracterror;

/// Typed error enum covering all failure modes across the Nova Rewards
/// contract suite.
///
/// Annotated with `#[contracterror]` so Soroban encodes each variant as a
/// `u32` in the contract ABI, enabling clients to match on numeric codes.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    // ── Initialization ────────────────────────────────────────────────────────
    /// Contract has already been initialized (code 1).
    AlreadyInitialized = 1,
    /// Contract has not been initialized yet (code 2).
    NotInitialized = 2,

    // ── Authorization ─────────────────────────────────────────────────────────
    /// Caller lacks the required authorization (code 3).
    Unauthorized = 3,

    // ── Balance / Budget ──────────────────────────────────────────────────────
    /// Account balance is too low for the requested operation (code 4).
    InsufficientBalance = 4,
    /// Campaign budget is exhausted; distribution cannot proceed (code 5).
    InsufficientBudget = 5,

    // ── Campaign lifecycle ────────────────────────────────────────────────────
    /// No campaign exists with the given identifier (code 6).
    CampaignNotFound = 6,
    /// A campaign with this identifier has already been created (code 7).
    CampaignAlreadyExists = 7,
    /// Campaign end ledger has passed; no further actions allowed (code 8).
    CampaignExpired = 8,
    /// Campaign is paused or ended; operation requires active state (code 9).
    CampaignNotActive = 9,
    /// Campaign has already been permanently ended (code 10).
    CampaignAlreadyEnded = 10,
    /// Campaign is already in the paused state (code 11).
    CampaignAlreadyPaused = 11,
    /// Resume was called on a campaign that is not paused (code 12).
    CampaignNotPaused = 12,

    // ── Input validation ──────────────────────────────────────────────────────
    /// Reward amount must be strictly positive (code 13).
    InvalidRewardAmount = 13,
    /// Max budget must be greater than zero (code 14).
    InvalidBudget = 14,
    /// Start ledger must be strictly before end ledger (code 15).
    InvalidLedgerRange = 15,
    /// Provided token address is the zero/invalid address (code 16).
    InvalidTokenAddress = 16,

    // ── Contract-level pause ──────────────────────────────────────────────────
    /// The contract-level pause is active; all writes are blocked (code 17).
    ContractPaused = 17,

    // ── General numeric / collection guards ───────────────────────────────────
    /// A numeric argument must be > 0 (code 18).
    AmountMustBePositive = 18,
    /// Batch size exceeds the maximum allowed limit (code 19).
    BatchTooLarge = 19,
    /// Batch must contain at least one entry (code 20).
    EmptyBatch = 20,
    /// Two parallel arrays have different lengths (code 21).
    LengthMismatch = 21,

    // ── Distribution / clawback ───────────────────────────────────────────────
    /// The 30-day clawback window has passed (code 22).
    ClawbackWindowExpired = 22,
    /// No distribution record found for this recipient (code 23).
    NoClawbackRecord = 23,

    // ── Governance ────────────────────────────────────────────────────────────
    /// This address has already cast a vote on the proposal (code 24).
    AlreadyVoted = 24,
    /// No proposal exists with the given identifier (code 25).
    ProposalNotFound = 25,
    /// Proposal is not in the Active state (code 26).
    ProposalNotActive = 26,
    /// The voting window for this proposal has closed (code 27).
    VotingPeriodEnded = 27,
    /// Finalise was called before the voting period ended (code 28).
    VotingPeriodNotEnded = 28,
    /// Execute was called on a proposal that did not pass (code 29).
    ProposalNotPassed = 29,

    // ── Arithmetic ────────────────────────────────────────────────────────────
    /// Arithmetic overflow detected in a checked operation (code 30).
    Overflow = 30,
}
