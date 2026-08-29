#![no_main]
//! Fuzz harness for the referral contract.
//!
//! Drives an arbitrary interleaving of `register_referral`, `claim_referral_reward`,
//! and `fund_pool` over a small fixed pool of addresses, so fuzzed inputs can
//! actually collide into self-referrals, duplicate registrations, and
//! double-claims rather than only ever hitting fresh, unrelated addresses.
//!
//! Checks after every successful claim that the pool balance moved by
//! exactly `referrer_amount + referee_amount`, and after every single
//! operation that the pool balance never goes negative.
//!
//! Rejections by the contract (self-referral, duplicate registration,
//! already-rewarded, insufficient pool) are valid behaviour and are
//! observed via the `try_` client methods; only invariant violations count
//! as crashes.

use libfuzzer_sys::fuzz_target;
use referral::{ReferralContract, ReferralContractClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

const ACCOUNT_COUNT: usize = 4;

/// initial pool funding (16)
const HEADER_LEN: usize = 16;
/// op selector(1) + referrer idx(1) + referee idx(1) + referrer_amount(16) + referee_amount(16)
const OP_LEN: usize = 35;

/// Reduces an arbitrary byte-derived `i128` to a small, always-nonnegative
/// range so repeated additions in the harness (and in the contract's own
/// `checked_add`) cannot overflow.
fn bounded_amount(bytes: &[u8]) -> i128 {
    let raw = i128::from_le_bytes(bytes.try_into().unwrap());
    raw.checked_abs().unwrap_or(i128::MAX) % (i128::MAX / 4)
}

fuzz_target!(|data: &[u8]| {
    if data.len() < HEADER_LEN + OP_LEN {
        return;
    }

    let initial_fund = bounded_amount(&data[..16]);
    if initial_fund == 0 {
        return;
    }

    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReferralContract, ());
    let client = ReferralContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.fund_pool(&initial_fund);

    let accounts: [Address; ACCOUNT_COUNT] = core::array::from_fn(|_| Address::generate(&env));

    for op in data[HEADER_LEN..].chunks_exact(OP_LEN) {
        let referrer = &accounts[op[1] as usize % ACCOUNT_COUNT];
        let referee = &accounts[op[2] as usize % ACCOUNT_COUNT];

        match op[0] & 0x03 {
            0 => {
                // Rejections here (self-referral, already-referred) are
                // valid contract behaviour, not fuzzer crashes.
                let _ = client.try_register_referral(referrer, referee);
            }
            1 => {
                let top_up = bounded_amount(&op[3..19]);
                if top_up > 0 {
                    client.fund_pool(&top_up);
                }
            }
            _ => {
                let referrer_amount = bounded_amount(&op[3..19]);
                let referee_amount = bounded_amount(&op[19..35]);
                if referrer_amount == 0 || referee_amount == 0 {
                    continue;
                }

                let pool_before = client.pool_balance();
                if let Ok(Ok(())) =
                    client.try_claim_referral_reward(referee, &referrer_amount, &referee_amount)
                {
                    assert_eq!(
                        client.pool_balance(),
                        pool_before - (referrer_amount + referee_amount),
                        "pool balance after claim must equal pool before minus both rewards"
                    );
                    assert!(client.is_reward_claimed(referee));
                }
            }
        }

        // Core invariant after every single operation, regardless of which
        // branch executed.
        assert!(client.pool_balance() >= 0, "referral pool balance went negative");
    }
});
