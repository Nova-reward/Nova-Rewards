# RewardPool Fee Accumulation TODO

- [x] Step 1: Update DataKey enum to add Token, FeeBps, Treasury.
- [x] Step 2: Update initialize to accept and store token Address.
- [x] Step 3: Add update_fee(new_bps: u32) and update_treasury(new_treasury: Address) functions (admin-gated).
- [x] Step 4: Add get_treasury_balance() -> i128 using NovaTokenClient.
- [x] Step 5: Modify withdraw to compute fee/net, update balance, transfer tokens (fee to treasury, net to to), emit fee_collected(gross, fee, net).
- [x] Step 6: Add tests for zero-fee, various bps deductions, treasury accumulation. (pool_tests.rs + integration.rs)
- [ ] Step 7: Run `cargo test` to verify and update snapshots.
- [ ] Step 8: Complete task.
