//! Stateful, property-based checks for the reward pool's accounting guards.

use std::panic::{catch_unwind, AssertUnwindSafe};

use proptest::prelude::*;
use reward_pool::{
    PoolError, PoolState, RewardPool, RewardPoolClient, WithdrawalHistory,
    DAILY_WITHDRAWAL_CAP, SECONDS_PER_DAY,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

const INITIAL_POOL_BALANCE: i128 = 2_500;
const ACCOUNT_COUNT: usize = 8;

#[derive(Clone, Debug)]
enum Action {
    Withdraw { account: usize, amount: i128 },
    Deposit(i128),
    AdvanceTime(u64),
    SetLocked(bool),
}

fn action_strategy() -> impl Strategy<Value = Action> {
    prop_oneof![
        (0usize..ACCOUNT_COUNT, 1i128..1_501).prop_map(|(account, amount)| Action::Withdraw {
            account,
            amount,
        }),
        (1i128..2_001).prop_map(Action::Deposit),
        // Include both values just below and at the boundary as well as longer jumps.
        prop_oneof![Just(SECONDS_PER_DAY - 1), Just(SECONDS_PER_DAY), 0u64..(2 * SECONDS_PER_DAY)]
            .prop_map(Action::AdvanceTime),
        any::<bool>().prop_map(Action::SetLocked),
    ]
}

fn setup() -> (Env, Address, RewardPoolClient<'static>, [Address; ACCOUNT_COUNT]) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(RewardPool, ());
    let client = RewardPoolClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.deposit(&admin, &INITIAL_POOL_BALANCE);

    let accounts = core::array::from_fn(|_| Address::generate(&env));
    (env, admin, client, accounts)
}

fn active_history(history: &WithdrawalHistory, now: u64) -> WithdrawalHistory {
    if now.saturating_sub(history.period_started_at) >= SECONDS_PER_DAY {
        WithdrawalHistory {
            daily_withdrawn: 0,
            period_started_at: now,
        }
    } else {
        history.clone()
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(500))]

    /// Each generated sequence interleaves wallets, re-seeds the pool, moves
    /// ledger time across daily boundaries, and locks/unlocks the pool.
    #[test]
    fn random_multi_wallet_sequences_preserve_accounting(
        actions in prop::collection::vec(action_strategy(), 32..96)
    ) {
        let (env, admin, client, accounts) = setup();
        let mut now = env.ledger().timestamp();
        let mut locked = false;
        let mut funded = INITIAL_POOL_BALANCE;
        let mut total_withdrawn = 0_i128;
        let mut histories: [Option<WithdrawalHistory>; ACCOUNT_COUNT] = core::array::from_fn(|_| None);

        for action in actions {
            match action {
                Action::Deposit(amount) => {
                    client.deposit(&admin, &amount);
                    funded += amount;
                }
                Action::AdvanceTime(seconds) => {
                    env.ledger().with_mut(|ledger| ledger.timestamp += seconds);
                    now += seconds;
                }
                Action::SetLocked(next_locked) => {
                    client.set_pool_state(&(if next_locked { PoolState::PoolLocked } else { PoolState::Active }));
                    locked = next_locked;
                    prop_assert_eq!(client.pool_state(), if locked { PoolState::PoolLocked } else { PoolState::Active });
                }
                Action::Withdraw { account, amount } => {
                    let balance_before = client.balance();
                    let history = histories[account].clone().unwrap_or(WithdrawalHistory {
                        daily_withdrawn: 0,
                        period_started_at: now,
                    });
                    let history = active_history(&history, now);
                    let result = catch_unwind(AssertUnwindSafe(|| {
                        client.withdraw(&accounts[account], &amount)
                    }));

                    if locked {
                        prop_assert_eq!(result.unwrap(), Err(PoolError::PoolLocked));
                        prop_assert_eq!(client.balance(), balance_before);
                    } else if amount > balance_before {
                        // The contract rejects an overdraft before touching history or balance.
                        prop_assert!(result.is_err());
                        prop_assert_eq!(client.balance(), balance_before);
                    } else if history.daily_withdrawn + amount > DAILY_WITHDRAWAL_CAP {
                        prop_assert_eq!(result.unwrap(), Err(PoolError::DailyWithdrawalCapExceeded));
                        prop_assert_eq!(client.balance(), balance_before);
                    } else {
                        prop_assert_eq!(result.unwrap(), Ok(()));
                        let expected_history = WithdrawalHistory {
                            daily_withdrawn: history.daily_withdrawn + amount,
                            period_started_at: history.period_started_at,
                        };
                        histories[account] = Some(expected_history.clone());
                        total_withdrawn += amount;
                        prop_assert_eq!(
                            client.withdrawal_history(&accounts[account]),
                            expected_history
                        );
                    }
                }
            }

            let pool_balance = client.balance();
            prop_assert!(pool_balance >= 0, "pool balance underflowed");
            prop_assert!(total_withdrawn <= funded, "withdrawals exceeded all pool funding");
            prop_assert_eq!(pool_balance + total_withdrawn, funded);
        }
    }
}

#[test]
fn locked_pool_rejects_withdrawals_without_mutating_balance_or_history() {
    let (_env, _admin, client, accounts) = setup();
    let user = &accounts[0];
    assert_eq!(client.withdraw(user, &400), Ok(()));

    let balance_before = client.balance();
    let history_before = client.withdrawal_history(user);
    client.set_pool_state(&PoolState::PoolLocked);

    assert_eq!(client.withdraw(user, &100), Err(PoolError::PoolLocked));
    assert_eq!(client.balance(), balance_before);
    assert_eq!(client.withdrawal_history(user), history_before);
}

#[test]
fn lock_remains_effective_through_reseeding_and_until_an_admin_unlocks() {
    let (env, admin, client, accounts) = setup();
    let user = &accounts[0];
    assert_eq!(client.withdraw(user, &DAILY_WITHDRAWAL_CAP), Ok(()));
    client.set_pool_state(&PoolState::PoolLocked);
    let balance_before = client.balance();

    assert_eq!(client.withdraw(user, &1), Err(PoolError::PoolLocked));
    env.ledger().with_mut(|ledger| ledger.timestamp += SECONDS_PER_DAY);
    // Re-seed in the next daily period; a lock must still take precedence.
    client.deposit(&admin, &700);
    let reseeded_balance = client.balance();

    assert_eq!(client.withdraw(user, &1), Err(PoolError::PoolLocked));
    assert_eq!(client.balance(), reseeded_balance);
    assert_eq!(reseeded_balance, balance_before + 700);

    client.set_pool_state(&PoolState::Active);
    assert_eq!(client.withdraw(user, &DAILY_WITHDRAWAL_CAP), Ok(()));
    assert_eq!(client.balance(), reseeded_balance - DAILY_WITHDRAWAL_CAP);
}

#[test]
fn daily_withdrawal_cap_resets_at_the_twenty_four_hour_boundary() {
    let (env, _admin, client, accounts) = setup();
    let user = &accounts[0];
    assert_eq!(client.withdraw(user, &DAILY_WITHDRAWAL_CAP), Ok(()));
    assert_eq!(client.withdraw(user, &1), Err(PoolError::DailyWithdrawalCapExceeded));

    env.ledger().with_mut(|ledger| ledger.timestamp += SECONDS_PER_DAY - 1);
    assert_eq!(client.withdraw(user, &1), Err(PoolError::DailyWithdrawalCapExceeded));

    env.ledger().with_mut(|ledger| ledger.timestamp += 1);
    assert_eq!(client.withdrawal_history(user).daily_withdrawn, 0);
    assert_eq!(client.withdraw(user, &DAILY_WITHDRAWAL_CAP), Ok(()));
}
