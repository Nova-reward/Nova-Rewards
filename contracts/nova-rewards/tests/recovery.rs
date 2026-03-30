#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Symbol};

use nova_rewards::{NovaRewardsContract, NovaRewardsContractClient, RecoveryKind};

fn deploy(env: &Env) -> (NovaRewardsContractClient, Address) {
    let admin = Address::generate(env);
    let contract_id = env.register_contract(None, NovaRewardsContract);
    let client = NovaRewardsContractClient::new(env, &contract_id);
    client.initialize(&admin);
    (client, admin)
}

fn operation_id(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

#[test]
fn test_pause_blocks_state_changing_user_operations() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = deploy(&env);
    let user = Address::generate(&env);
    client.set_balance(&user, &1_000_i128);

    client.pause(&Symbol::new(&env, "incident"));
    assert!(client.is_paused());

    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.stake(&user, &100_i128);
    }));

    assert!(result.is_err());
}

#[test]
fn test_snapshot_and_restore_account_state() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = deploy(&env);
    let user = Address::generate(&env);

    client.set_balance(&user, &1_000_i128);
    client.set_annual_rate(&1_000_i128);
    client.stake(&user, &400_i128);

    let snapshot = client.snapshot_account(&user, &operation_id(&env, 1));
    assert_eq!(snapshot.balance, 600);
    assert_eq!(snapshot.stake.unwrap().amount, 400);

    client.pause(&Symbol::new(&env, "restore"));
    client.recover_transaction(&user, &150_i128, &operation_id(&env, 2));
    assert_eq!(client.get_balance(&user), 750);

    let restored = client.restore_account(&user, &operation_id(&env, 3));
    assert_eq!(restored.balance, 600);
    assert_eq!(client.get_balance(&user), 600);
    assert_eq!(client.get_stake(&user).unwrap().amount, 400);
}

#[test]
fn test_recover_transaction_is_idempotent() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = deploy(&env);
    let user = Address::generate(&env);
    let recovery_id = operation_id(&env, 9);

    client.set_balance(&user, &100_i128);
    client.pause(&Symbol::new(&env, "tx_recovery"));

    assert_eq!(client.recover_transaction(&user, &25_i128, &recovery_id), 125);
    assert_eq!(client.recover_transaction(&user, &25_i128, &recovery_id), 125);
    assert_eq!(client.get_balance(&user), 125);

    let operation = client.get_recovery_operation(&recovery_id).unwrap();
    assert_eq!(operation.kind, RecoveryKind::Transaction);
    assert_eq!(operation.amount, 25);
}

#[test]
fn test_recover_funds_moves_internal_balances() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = deploy(&env);
    let from = Address::generate(&env);
    let to = Address::generate(&env);

    client.set_balance(&from, &500_i128);
    client.set_balance(&to, &40_i128);
    client.pause(&Symbol::new(&env, "fund_recovery"));

    client.recover_funds(&from, &to, &200_i128, &operation_id(&env, 7));

    assert_eq!(client.get_balance(&from), 300);
    assert_eq!(client.get_balance(&to), 240);

    let operation = client.get_recovery_operation(&operation_id(&env, 7)).unwrap();
    assert_eq!(operation.kind, RecoveryKind::Fund);
    assert_eq!(operation.amount, 200);
    assert_eq!(operation.counterparty, Some(to));
}
