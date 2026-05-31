import { xdr } from 'stellar-sdk';
import { encodeContractArgs, decodeContractResult, ScValInput } from './xdr-codec';

// ── Shared helper ─────────────────────────────────────────────────────────────

function encode(fn: string, args: ScValInput[]): xdr.ScVal[] {
  return encodeContractArgs(fn, args);
}

// ── nova-rewards contract ─────────────────────────────────────────────────────

export const novaRewardsContract = {
  /** issue_reward(recipient: Address, amount: i128, campaign_id: u64) */
  issueReward(recipient: string, amount: bigint, campaignId: bigint): xdr.ScVal[] {
    return encode('issue_reward', [recipient, amount, campaignId]);
  },

  /** redeem(user: Address, amount: i128) */
  redeem(user: string, amount: bigint): xdr.ScVal[] {
    return encode('redeem', [user, amount]);
  },

  /** get_balance(user: Address) → i128 */
  decodeGetBalance(result: string | xdr.ScVal): bigint {
    return decodeContractResult(result) as bigint;
  },
};

// ── nova_token contract ───────────────────────────────────────────────────────

export const novaTokenContract = {
  /** mint(to: Address, amount: i128) */
  mint(to: string, amount: bigint): xdr.ScVal[] {
    return encode('mint', [to, amount]);
  },

  /** burn(from: Address, amount: i128) */
  burn(from: string, amount: bigint): xdr.ScVal[] {
    return encode('burn', [from, amount]);
  },

  /** balance(id: Address) → i128 */
  decodeBalance(result: string | xdr.ScVal): bigint {
    return decodeContractResult(result) as bigint;
  },
};

// ── reward_pool contract ──────────────────────────────────────────────────────

export const rewardPoolContract = {
  /** deposit(from: Address, amount: i128) */
  deposit(from: string, amount: bigint): xdr.ScVal[] {
    return encode('deposit', [from, amount]);
  },

  /** withdraw(to: Address, amount: i128) */
  withdraw(to: string, amount: bigint): xdr.ScVal[] {
    return encode('withdraw', [to, amount]);
  },

  /** pool_balance() → i128 */
  decodePoolBalance(result: string | xdr.ScVal): bigint {
    return decodeContractResult(result) as bigint;
  },
};

// ── campaign contract ─────────────────────────────────────────────────────────

export const campaignContract = {
  /** create_campaign(merchant: Address, budget: i128, end_time: u64) */
  createCampaign(merchant: string, budget: bigint, endTime: bigint): xdr.ScVal[] {
    return encode('create_campaign', [merchant, budget, endTime]);
  },

  /** get_campaign(id: u64) → Campaign struct */
  decodeGetCampaign(result: string | xdr.ScVal): unknown {
    return decodeContractResult(result);
  },
};
