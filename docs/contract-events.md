# Nova Rewards – Contract Event Schema

All events follow the convention:

```
topics : (contract_name: Symbol, event_type: Symbol)
data   : tuple of relevant fields
```

Symbol keys use `symbol_short!` to stay within the 32-byte limit.
No sensitive data (private keys, passwords) is ever included in event payloads.

---

## NovaToken (`nova_tok`)

| event_type  | topics tuple                        | data                              |
|-------------|-------------------------------------|-----------------------------------|
| `mint`      | `("nova_tok", "mint")`              | `(to: Address, amount: i128)`     |
| `burn`      | `("nova_tok", "burn")`              | `(from: Address, amount: i128)`   |
| `transfer`  | `("nova_tok", "transfer")`          | `(from: Address, to: Address, amount: i128)` |
| `approve`   | `("nova_tok", "approve")`           | `(owner: Address, spender: Address, amount: i128)` |

---

## RewardPool (`rwd_pool`)

| event_type  | topics tuple                        | data                              |
|-------------|-------------------------------------|-----------------------------------|
| `deposited` | `("rwd_pool", "deposited")`         | `(from: Address, amount: i128)`   |
| `withdrawn` | `("rwd_pool", "withdrawn")`         | `(to: Address, amount: i128)`     |

---

## AdminRoles (`adm_roles`)

| event_type          | topics tuple                            | data                                    |
|---------------------|-----------------------------------------|-----------------------------------------|
| `admin_proposed`    | `("adm_roles", "adm_prop")`             | `(current_admin: Address, proposed: Address)` |
| `admin_transferred` | `("adm_roles", "adm_xfer")`             | `(old_admin: Address, new_admin: Address)` |

---

## Vesting (`vesting`)

| event_type        | topics tuple                      | data                                              |
|-------------------|-----------------------------------|---------------------------------------------------|
| `tokens_released` | `("vesting", "tok_rel")`          | `(beneficiary: Address, amount: i128, timestamp: u64)` |

---

## Referral (`referral`)

| event_type             | topics tuple                        | data                                                    |
|------------------------|-------------------------------------|---------------------------------------------------------|
| `referral_registered`  | `("referral", "ref_reg")`           | `(referrer: Address, referred: Address)`                |
| `referrer_credited`    | `("referral", "ref_cred")`          | `(referrer: Address, referred: Address, amount: i128)`  |
