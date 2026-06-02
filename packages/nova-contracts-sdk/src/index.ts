/**
 * TypeScript bindings for Nova Rewards Soroban smart contracts.
 * Auto-generated from docs/abis/*.json — do not edit manually.
 *
 * Closes #566
 */

// ── Shared primitives ────────────────────────────────────────────────────────

/** Stellar account address (G... or M... or A...) */
export type Address = string;

/** 128-bit signed integer represented as bigint */
export type i128 = bigint;

/** 32-bit unsigned integer */
export type u32 = number;

/** 64-bit unsigned integer represented as bigint */
export type u64 = bigint;

/** 32-byte hash as hex string */
export type BytesN32 = string;

// ── nova_token ────────────────────────────────────────────────────────────────

export interface NovaTokenClient {
  initialize(admin: Address): Promise<void>;
  mint(to: Address, amount: i128): Promise<void>;
  burn(from: Address, amount: i128): Promise<void>;
  transfer(from: Address, to: Address, amount: i128): Promise<void>;
  transfer_from(spender: Address, from: Address, to: Address, amount: i128): Promise<void>;
  approve(owner: Address, spender: Address, amount: i128): Promise<void>;
  increase_allowance(owner: Address, spender: Address, amount: i128): Promise<void>;
  decrease_allowance(owner: Address, spender: Address, amount: i128): Promise<void>;
  balance_of(address: Address): Promise<i128>;
  allowance(owner: Address, spender: Address): Promise<i128>;
  admin(): Promise<Address>;
}

// ── nova_rewards ──────────────────────────────────────────────────────────────

export interface StakeRecord {
  amount: i128;
  staked_at: u64;
}

export type RecoveryKind = 'FundsRecovery' | 'TransactionRecovery' | 'AccountRestore';

export interface NovaRewardsClient {
  initialize(admin: Address, recovery_admin: Address): Promise<void>;
  stake(user: Address, amount: i128): Promise<void>;
  unstake(user: Address): Promise<void>;
  get_stake(user: Address): Promise<StakeRecord>;
  calculate_yield(user: Address): Promise<i128>;
  set_annual_rate(rate_bps: u32): Promise<void>;
  get_annual_rate(): Promise<u32>;
  swap_for_xlm(user: Address, nova_amount: i128, min_xlm_out: i128): Promise<i128>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  is_paused(): Promise<boolean>;
  upgrade(new_wasm_hash: BytesN32): Promise<void>;
  migrate(): Promise<void>;
  snapshot_account(account: Address): Promise<void>;
  restore_account(account: Address): Promise<void>;
  recover_transaction(operation_id: BytesN32, kind: RecoveryKind, amount: i128): Promise<void>;
  recover_funds(from: Address, to: Address, amount: i128): Promise<void>;
}

// ── campaign ──────────────────────────────────────────────────────────────────

export interface TokenReward {
  token: Address;
  amount: i128;
}

export interface CampaignData {
  owner: Address;
  rewards: TokenReward[];
  active: boolean;
  completed: boolean;
  max_participants: u32;
  current_participants: u32;
}

export interface CampaignClient {
  initialize(admin: Address): Promise<void>;
  create_campaign(owner: Address, rewards: TokenReward[], max_participants: u32): Promise<u64>;
  set_active(campaign_id: u64, active: boolean): Promise<void>;
  join_campaign(user: Address, campaign_id: u64): Promise<void>;
  distribute_reward(campaign_id: u64, recipient: Address): Promise<void>;
  get_campaign(campaign_id: u64): Promise<CampaignData>;
  pause(): Promise<void>;
  unpause(): Promise<void>;
  is_paused(): Promise<boolean>;
}

// ── reward_pool ───────────────────────────────────────────────────────────────

export interface RewardPoolClient {
  initialize(admin: Address, token: Address): Promise<void>;
  deposit(from: Address, amount: i128): Promise<void>;
  withdraw(to: Address, amount: i128): Promise<void>;
  get_balance(): Promise<i128>;
  set_daily_limit(limit: i128): Promise<void>;
  get_merkle_root(): Promise<BytesN32>;
  is_claimed(leaf: BytesN32): Promise<boolean>;
  get_locked_until(): Promise<u32>;
}

// ── governance ────────────────────────────────────────────────────────────────

export type ProposalStatus = 'Active' | 'Passed' | 'Rejected' | 'Executed';

export interface Proposal {
  id: u32;
  proposer: Address;
  title: string;
  description: string;
  yes_votes: u32;
  no_votes: u32;
  end_ledger: u32;
  status: ProposalStatus;
}

export interface GovernanceClient {
  initialize(admin: Address): Promise<void>;
  create_proposal(proposer: Address, title: string, description: string): Promise<u32>;
  vote(voter: Address, proposal_id: u32, support: boolean): Promise<void>;
  finalise(proposal_id: u32): Promise<void>;
  execute(proposal_id: u32): Promise<void>;
  get_proposal(proposal_id: u32): Promise<Proposal>;
  proposal_count(): Promise<u32>;
  has_voted(voter: Address, proposal_id: u32): Promise<boolean>;
}

// ── vesting ───────────────────────────────────────────────────────────────────

export interface VestingSchedule {
  beneficiary: Address;
  amount: i128;
  released: i128;
  start_time: u64;
  cliff_seconds: u64;
  duration_seconds: u64;
}

export interface VestingClient {
  initialize(admin: Address, token: Address): Promise<void>;
  fund_pool(from: Address, amount: i128): Promise<void>;
  create_schedule(beneficiary: Address, amount: i128, cliff_seconds: u64, duration_seconds: u64): Promise<u32>;
  release(beneficiary: Address, schedule_id: u32): Promise<i128>;
  vested_amount(beneficiary: Address, schedule_id: u32): Promise<i128>;
  get_schedule(beneficiary: Address, schedule_id: u32): Promise<VestingSchedule>;
  pool_balance(): Promise<i128>;
}

// ── referral ──────────────────────────────────────────────────────────────────

export interface ReferralClient {
  initialize(admin: Address, token: Address): Promise<void>;
  fund_pool(from: Address, amount: i128): Promise<void>;
  register_referral(new_user: Address, referrer: Address): Promise<void>;
  credit_referrer(referrer: Address, amount: i128): Promise<void>;
  get_referrer(user: Address): Promise<Address | null>;
  total_referrals(referrer: Address): Promise<u32>;
  pool_balance(): Promise<i128>;
}

// ── distribution ──────────────────────────────────────────────────────────────

export interface DistributionClient {
  initialize(admin: Address, token: Address): Promise<void>;
  distribute(recipient: Address, amount: i128): Promise<void>;
  distribute_batch(recipients: Address[], amounts: i128[]): Promise<void>;
  clawback(recipient: Address, amount: i128): Promise<void>;
  calculate_reward(base_amount: i128, rate_bps: u32): Promise<i128>;
  get_distributed(recipient: Address): Promise<i128>;
  get_clawback_deadline(): Promise<u32>;
}

// ── redemption ────────────────────────────────────────────────────────────────

export type RedemptionStatus = 'Pending' | 'Confirmed' | 'Cancelled';

export interface RedemptionRequest {
  id: u32;
  user: Address;
  amount: i128;
  status: RedemptionStatus;
}

export interface RedemptionProof {
  user: Address;
  amount: i128;
  rate: u32;
  ledger: u32;
}

export interface RedemptionClient {
  initialize(admin: Address, token: Address): Promise<void>;
  set_redemption_rate(rate: u32): Promise<void>;
  request(user: Address, amount: i128): Promise<u32>;
  confirm(request_id: u32): Promise<void>;
  cancel(user: Address, request_id: u32): Promise<void>;
  redeem(user: Address, amount: i128): Promise<RedemptionProof>;
  get_redemption_rate(): Promise<u32>;
  get_total_redemptions(): Promise<u32>;
}

// ── escrow ────────────────────────────────────────────────────────────────────

export type EscrowStatus = 'Pending' | 'Funded' | 'Released' | 'Refunded';

export interface Escrow {
  id: u32;
  depositor: Address;
  beneficiary: Address;
  token: Address;
  amount: i128;
  timeout_ledger: u32;
  status: EscrowStatus;
}

export interface EscrowClient {
  initialize(admin: Address): Promise<void>;
  create(depositor: Address, beneficiary: Address, token: Address, amount: i128, timeout_ledger: u32): Promise<u32>;
  fund(escrow_id: u32, from: Address): Promise<void>;
  release(escrow_id: u32): Promise<void>;
  refund(escrow_id: u32, depositor: Address): Promise<void>;
  get(escrow_id: u32): Promise<Escrow>;
}

// ── admin_roles ───────────────────────────────────────────────────────────────

export interface AdminRolesClient {
  initialize(admin: Address, signers: Address[], threshold: u32): Promise<void>;
  propose_admin(new_admin: Address): Promise<void>;
  accept_admin(new_admin: Address): Promise<void>;
  update_signers(signers: Address[]): Promise<void>;
  update_threshold(threshold: u32): Promise<void>;
  mint(to: Address, amount: i128): Promise<void>;
  withdraw(to: Address, amount: i128): Promise<void>;
  update_rate(rate_bps: u32): Promise<void>;
  pause(): Promise<void>;
  get_admin(): Promise<Address>;
  get_pending_admin(): Promise<Address | null>;
  get_signers(): Promise<Address[]>;
  get_threshold(): Promise<u32>;
}

// ── Error codes ───────────────────────────────────────────────────────────────

export const ContractErrors = {
  AlreadyInitialized:    1,
  Unauthorized:          2,
  InsufficientBalance:   3,
  InsufficientAllowance: 4,
  AmountMustBePositive:  5,
  AlreadyStaked:         6,
  NoActiveStake:         7,
  SlippageExceeded:      8,
  Paused:                9,
  NotFound:              10,
  AlreadyVoted:          11,
  VotingClosed:          12,
  CliffNotPassed:        13,
  NothingToRelease:      14,
  AlreadyFullyReleased:  15,
  LengthMismatch:        16,
  ClawbackWindowExpired: 17,
  AlreadyConfirmed:      18,
  AlreadyCancelled:      19,
  NoRateSet:             20,
  TimeoutNotReached:     21,
  NoPendingProposal:     22,
} as const;

export type ContractErrorCode = typeof ContractErrors[keyof typeof ContractErrors];

export function getErrorMessage(code: ContractErrorCode): string {
  const messages: Record<ContractErrorCode, string> = {
    1:  'already initialized',
    2:  'unauthorized',
    3:  'insufficient balance',
    4:  'insufficient allowance',
    5:  'amount must be positive',
    6:  'already staked',
    7:  'no active stake',
    8:  'slippage exceeded',
    9:  'contract is paused',
    10: 'not found',
    11: 'already voted',
    12: 'voting period has ended',
    13: 'cliff period has not passed',
    14: 'nothing to release',
    15: 'schedule fully released',
    16: 'recipients and amounts length mismatch',
    17: 'clawback window has expired',
    18: 'already confirmed',
    19: 'already cancelled',
    20: 'redemption rate not set',
    21: 'timeout ledger not reached',
    22: 'no pending admin proposal',
  };
  return messages[code] ?? `unknown error (code ${code})`;
}
