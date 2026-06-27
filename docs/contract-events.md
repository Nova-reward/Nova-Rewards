# Nova Rewards — Contract Event Schemas

**Schema version:** 1  
**Last updated:** 2026-05-31  
**Soroban SDK:** 25.3.1

All events follow the Soroban event convention:

```
topics : (contract_tag: Symbol, event_type: Symbol)
data   : (schema_version: u32, ...fields)
```

- `schema_version` is always the **first** element of the data tuple.  
  Increment it (and update this document) whenever the payload shape changes.
- Symbol keys use `symbol_short!` (≤ 9 ASCII chars).
- No sensitive data (private keys, passwords, secrets) is ever included.

---

## Versioning policy

| Change type | Action |
|---|---|
| Add optional field at end of tuple | Bump `schema_version`, minor doc update |
| Remove or reorder field | Bump `schema_version`, migration note required |
| New event type added | No version bump needed; add row to table |
| Topic symbols changed | Bump `schema_version`, update indexer `EVENT_TYPES` map |

---

## 1. NovaRewards (`nova_rwd`)

Source: `contracts/nova-rewards/src/utils/events.rs`

| event_type  | topics tuple                        | data (after schema_version)                                      | trigger                        |
|-------------|-------------------------------------|------------------------------------------------------------------|--------------------------------|
| `init`      | `("nova_rwd", "init")`              | `admin: Address`                                                 | Contract first initialised     |
| `bal_set`   | `("nova_rwd", "bal_set")`           | `user: Address, amount: i128`                                    | Admin sets user balance        |
| `staked`    | `("nova_rwd", "staked")`            | `staker: Address, amount: i128, timestamp: u64`                  | User stakes tokens             |
| `unstaked`  | `("nova_rwd", "unstaked")`          | `staker: Address, principal: i128, yield: i128, timestamp: u64`  | User unstakes + collects yield |
| `rate_set`  | `("nova_rwd", "rate_set")`          | `rate: i128`                                                     | Admin updates annual rate (bps)|
| `swap`      | `("nova_rwd", "swap")`              | `user: Address, nova_amount: i128, xlm_received: i128, path: Vec<Address>` | Nova → XLM swap    |
| `paused`    | `("nova_rwd", "paused")`            | `procedure: Symbol, timestamp: u64`                              | Contract paused                |
| `resumed`   | `("nova_rwd", "resumed")`           | `timestamp: u64`                                                 | Contract resumed               |
| `emrg_paus` | `("nova_rwd", "emrg_paus")`         | `expiry: u64`                                                    | Emergency pause with auto-expiry|
| `rec_op`    | `("nova_rwd", "rec_op")`            | `recovery_admin: Address`                                        | Recovery admin assigned        |
| `snap`      | `("nova_rwd", "snap")`              | `user: Address, balance: i128, timestamp: u64`                   | Account snapshot captured      |
| `restore`   | `("nova_rwd", "restore")`           | `user: Address, balance: i128, timestamp: u64`                   | Account snapshot restored      |
| `rec_tx`    | `("nova_rwd", "rec_tx")`            | `user: Address, delta: i128, new_balance: i128`                  | Recovery balance delta applied |
| `rec_funds` | `("nova_rwd", "rec_funds")`         | `from: Address, to: Address, amount: i128`                       | Recovery fund transfer         |
| `upgraded`  | `("nova_rwd", "upgraded")`          | `wasm_hash: BytesN<32>, migration_version: u32`                  | WASM upgraded + migrated       |

### Example: `staked` event (decoded)

```json
{
  "topics": ["nova_rwd", "staked"],
  "data": [1, "GABC...XYZ", 5000000, 1748649600]
}
```

---

## 2. NovaToken (`nova_tok`)

Source: `contracts/nova_token/src/lib.rs`

| event_type      | topics tuple                          | data (after schema_version)                              | trigger                    |
|-----------------|---------------------------------------|----------------------------------------------------------|----------------------------|
| `mint`          | `("nova_tok", "mint")`                | `to: Address, amount: i128`                              | Tokens minted              |
| `burn`          | `("nova_tok", "burn")`                | `from: Address, amount: i128`                            | Tokens burned              |
| `transfer`      | `("nova_tok", "transfer")`            | `from: Address, to: Address, amount: i128`               | Token transfer             |
| `transfer_from` | `("nova_tok", "transfer_from")`       | `spender: Address, from: Address, to: Address, amount: i128` | Allowance-based transfer|
| `approve`       | `("nova_tok", "approve")`             | `owner: Address, spender: Address, amount: i128`         | Allowance set              |
| `inc_allow`     | `("nova_tok", "inc_allow")`           | `owner: Address, spender: Address, new_allowance: i128`  | Allowance increased        |
| `dec_allow`     | `("nova_tok", "dec_allow")`           | `owner: Address, spender: Address, new_allowance: i128`  | Allowance decreased        |

> **Note:** `nova_token` events do not yet include `schema_version` as the first data element.
> This will be added in schema v2 when the token contract is next upgraded.

---

## 3. Campaign (`camp`)

Source: `contracts/campaign/src/lib.rs`

| event_type    | topics tuple                        | data (schema_version, ...)                                        | trigger                      |
|---------------|-------------------------------------|-------------------------------------------------------------------|------------------------------|
| `created`     | `("camp", "created")`               | `id: u64, owner: Address, reward_count: u32, max_participants: u32` | Campaign created           |
| `activated`   | `("camp", "activated")`             | `id: u64, owner: Address`                                         | Campaign activated           |
| `deactivated` | `("camp", "deactivated")`           | `id: u64, owner: Address`                                         | Campaign deactivated         |
| `joined`      | `("camp", "joined")`                | `id: u64, participant: Address`                                   | Participant joined           |
| `rwd_issued`  | `("camp", "rwd_issued")`            | `id: u64, participant: Address, reward_count: u32`                | Reward issued to participant |
| `paused`      | `("camp", "paused")`                | `admin: Address`                                                  | Contract paused              |
| `unpaused`    | `("camp", "unpaused")`              | `admin: Address`                                                  | Contract unpaused            |
| `upgraded`    | `("camp", "upgraded")`              | `new_wasm_hash: BytesN<32>`                                       | WASM upgraded (multisig)     |

---

## 4. Escrow (`escrow`)

Source: `contracts/escrow/src/lib.rs`

| event_type  | topics tuple                        | data (schema_version, ...)                                        | trigger                      |
|-------------|-------------------------------------|-------------------------------------------------------------------|------------------------------|
| `created`   | `("escrow", "created")`             | `id: u32, depositor: Address, beneficiary: Address, timeout: u64` | Escrow created               |
| `funded`    | `("escrow", "funded")`              | `id: u32, depositor: Address, amount: i128`                       | Escrow funded                |
| `released`  | `("escrow", "released")`            | `id: u32, beneficiary: Address, amount: i128`                     | Funds released to beneficiary|
| `refunded`  | `("escrow", "refunded")`            | `id: u32, depositor: Address, amount: i128`                       | Funds refunded to depositor  |
| `upgraded`  | `("escrow", "upgraded")`            | `new_wasm_hash: BytesN<32>`                                       | WASM upgraded (multisig)     |

---

## 5. Distribution (`dist`)

Source: `contracts/distribution/src/lib.rs`

| event_type    | topics tuple                        | data (schema_version, ...)                                        | trigger                      |
|---------------|-------------------------------------|-------------------------------------------------------------------|------------------------------|
| `distributed` | `("dist", "distributed")`           | `recipient: Address, amount: i128, clawback_deadline: u64`        | Single distribution          |
| `batch_dist`  | `("dist", "batch_dist")`            | `count: u32, total_amount: i128`                                  | Batch distribution summary   |
| `clawback`    | `("dist", "clawback")`              | `recipient: Address, amount: i128`                                | Distribution clawed back     |
| `upgraded`    | `("dist", "upgraded")`              | `new_wasm_hash: BytesN<32>`                                       | WASM upgraded (multisig)     |

---

## 6. Governance (`gov`)

Source: `contracts/governance/src/lib.rs`

| event_type  | topics tuple                        | data (schema_version, ...)                                        | trigger                      |
|-------------|-------------------------------------|-------------------------------------------------------------------|------------------------------|
| `proposed`  | `("gov", "proposed")`               | `id: u32, proposer: Address, title: String`                       | Proposal created             |
| `voted`     | `("gov", "voted")`                  | `proposal_id: u32, voter: Address, support: bool`                 | Vote cast                    |
| `finalised` | `("gov", "finalised")`              | `proposal_id: u32, passed: bool`                                  | Proposal finalised           |
| `executed`  | `("gov", "executed")`               | `proposal_id: u32, proposer: Address`                             | Proposal executed            |
| `upgraded`  | `("gov", "upgraded")`               | `new_wasm_hash: BytesN<32>`                                       | WASM upgraded (multisig)     |

---

## 7. AdminRoles (`adm_roles`)

Source: `contracts/admin_roles/src/lib.rs`

| event_type  | topics tuple                        | data (schema_version, ...)                                        | trigger                      |
|-------------|-------------------------------------|-------------------------------------------------------------------|------------------------------|
| `adm_prop`  | `("adm_roles", "adm_prop")`         | `current_admin: Address, proposed: Address`                       | Admin transfer proposed      |
| `adm_xfer`  | `("adm_roles", "adm_xfer")`         | `old_admin: Address, new_admin: Address`                          | Admin transfer completed     |
| `role_chg`  | `("adm_roles", "role_chg")`         | `admin: Address, operation: Symbol, target: Address`              | Privileged role operation    |
| `upgraded`  | `("adm_roles", "upgraded")`         | `new_wasm_hash: BytesN<32>`                                       | WASM upgraded (multisig)     |

### `role_chg` operation values

| `operation` symbol | meaning                  |
|--------------------|--------------------------|
| `mint`             | Admin mint hook called   |
| `withdraw`         | Admin withdraw hook called|
| `rate`             | Rate update hook called  |
| `pause`            | Pause hook called        |
| `threshold`        | Threshold updated        |
| `signers`          | Signer set updated       |

---

## 8. ContractState (`state`)

Source: `contracts/contract_state/src/lib.rs`

| event_type  | topics tuple                        | data (schema_version, ...)                                        | trigger                      |
|-------------|-------------------------------------|-------------------------------------------------------------------|------------------------------|
| `set`       | `("state", "set")`                  | `schema_version_counter: u32`                                     | State entry written          |
| `delete`    | `("state", "delete")`               | `schema_version_counter: u32`                                     | State entry deleted          |
| `snapshot`  | `("state", "snapshot")`             | `schema_version_counter: u32`                                     | Snapshot captured            |
| `migrate`   | `("state", "migrate")`              | `new_version: u32`                                                | Schema version bumped        |
| `recover`   | `("state", "recover")`              | `snap_version: u32`                                               | State restored from snapshot |
| `upgraded`  | `("state", "upgraded")`             | `new_wasm_hash: BytesN<32>`                                       | WASM upgraded (multisig)     |

---

## 9. RewardPool (`rwd_pool`)

Source: `contracts/reward_pool/src/lib.rs`

| event_type  | topics tuple                        | data                                      | trigger           |
|-------------|-------------------------------------|-------------------------------------------|-------------------|
| `deposited` | `("rwd_pool", "deposited")`         | `from: Address, amount: i128`             | Pool deposit      |
| `withdrawn` | `("rwd_pool", "withdrawn")`         | `to: Address, amount: i128`               | Pool withdrawal   |

---

## 10. Vesting (`vesting`)

Source: `contracts/vesting/src/lib.rs`

| event_type  | topics tuple                        | data                                                              | trigger                |
|-------------|-------------------------------------|-------------------------------------------------------------------|------------------------|
| `tok_rel`   | `("vesting", "tok_rel")`            | `beneficiary: Address, amount: i128, timestamp: u64`             | Vested tokens released |

---

## 11. Referral (`referral`)

Source: `contracts/referral/src/lib.rs`

| event_type  | topics tuple                        | data                                                              | trigger                    |
|-------------|-------------------------------------|-------------------------------------------------------------------|----------------------------|
| `ref_reg`   | `("referral", "ref_reg")`           | `referrer: Address, referred: Address`                            | Referral registered        |
| `ref_cred`  | `("referral", "ref_cred")`          | `referrer: Address, referred: Address, amount: i128`              | Referrer credited          |

---

## Upgrade events — all contracts

Every contract that implements the M-of-N upgrade mechanism emits a `ContractUpgraded` event when the WASM is swapped. The `nova-rewards` contract additionally emits `upgraded` from `migrate()` with the migration version number.

| Contract       | topic 0      | topic 1    | data                                          |
|----------------|--------------|------------|-----------------------------------------------|
| nova-rewards   | `nova_rwd`   | `upgraded` | `(v, wasm_hash: BytesN<32>, migration_version: u32)` |
| campaign       | `camp`       | `upgraded` | `(v, wasm_hash: BytesN<32>)`                  |
| escrow         | `escrow`     | `upgraded` | `(v, wasm_hash: BytesN<32>)`                  |
| distribution   | `dist`       | `upgraded` | `(v, wasm_hash: BytesN<32>)`                  |
| governance     | `gov`        | `upgraded` | `(v, wasm_hash: BytesN<32>)`                  |
| admin_roles    | `adm_roles`  | `upgraded` | `(v, wasm_hash: BytesN<32>)`                  |
| contract_state | `state`      | `upgraded` | `(v, wasm_hash: BytesN<32>)`                  |

---

## Backend indexer integration

The `backend/routes/contractEvents.js` `EVENT_TYPES` map must be kept in sync with this document. Add new entries for every new event type:

```js
// Example entry format:
'nova_rwd:staked': { contract: 'nova-rewards', description: 'Tokens staked' },
```

The indexer parses events from the Soroban RPC `getEvents` response. Topic symbols are decoded as strings; data tuples are decoded as XDR `ScVal` arrays. The first data element (`schema_version`) should be validated against the expected version before processing.

### Parsing example (Node.js)

```js
function parseEvent(event) {
  const [tag, eventType] = event.topic.map(t => t.value);
  const data = event.value; // ScVal tuple
  const schemaVersion = data[0]; // u32
  // dispatch by `${tag}:${eventType}`
}
```
