# NovaRewards — Entity Relationship Diagram

Generated: 2026-03-28

## ERD (Mermaid)

```mermaid
erDiagram
    MERCHANTS {
        serial      id          PK
        varchar     name
        varchar     api_key     UK
        boolean     is_active
        timestamptz created_at
    }

    USERS {
        serial      id              PK
        varchar     wallet_address  UK
        varchar     email
        varchar     first_name
        varchar     last_name
        text        bio
        varchar     stellar_public_key
        varchar     role
        integer     referred_by     FK
        boolean     referral_bonus_claimed
        timestamptz referred_at
        timestamptz last_login_at
        timestamptz daily_bonus_granted_at
        boolean     is_deleted
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    CAMPAIGNS {
        serial      id          PK
        integer     merchant_id FK
        varchar     name
        numeric     reward_rate
        date        start_date
        date        end_date
        boolean     is_active
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTIONS {
        serial      id              PK
        varchar     tx_hash         UK
        varchar     tx_type
        numeric     amount
        varchar     from_wallet
        varchar     to_wallet
        integer     merchant_id     FK
        integer     campaign_id     FK
        integer     user_id         FK
        integer     stellar_ledger
        timestamptz created_at
    }

    POINT_TRANSACTIONS {
        serial      id                  PK
        uuid        uuid                UK
        integer     user_id             FK
        varchar     type
        integer     amount
        integer     balance_before
        integer     balance_after
        text        description
        integer     referred_user_id    FK
        integer     campaign_id         FK
        timestamptz created_at
    }

    USER_BALANCE {
        integer     user_id     PK "FK -> users.id"
        integer     balance
        timestamptz updated_at
    }

    REWARDS {
        serial      id          PK
        varchar     name
        numeric     cost
        integer     stock
        boolean     is_active
        boolean     is_deleted
        timestamptz created_at
        timestamptz updated_at
    }

    CONTRACT_EVENTS {
        serial      id                  PK
        varchar     contract_id
        varchar     event_type
        jsonb       event_data
        varchar     transaction_hash
        integer     ledger_sequence
        timestamptz processed_at
        integer     retry_count
        varchar     status
        text        error_message
        timestamptz created_at
    }

    EMAIL_LOGS {
        serial      id              PK
        varchar     recipient_email
        varchar     email_type
        varchar     subject
        varchar     status
        text        error_message
        timestamptz sent_at
        timestamptz delivered_at
        timestamptz created_at
    }

    MERCHANTS    ||--o{ CAMPAIGNS         : "has"
    MERCHANTS    ||--o{ TRANSACTIONS      : "owns"
    USERS        ||--o{ TRANSACTIONS      : "makes"
    USERS        ||--o{ POINT_TRANSACTIONS: "earns/redeems"
    USERS        ||--|| USER_BALANCE      : "has balance"
    USERS        ||--o{ USERS             : "refers (referred_by)"
    CAMPAIGNS    ||--o{ TRANSACTIONS      : "linked to"
    CAMPAIGNS    ||--o{ POINT_TRANSACTIONS: "linked to"
    USERS        ||--o{ POINT_TRANSACTIONS: "referred_user_id"
```

## Key Design Decisions

### point_transactions
| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL | Internal auto-increment PK |
| `uuid` | UUID | Stable external identifier (gen_random_uuid()) |
| `user_id` | INTEGER FK | Owner of the transaction |
| `type` | VARCHAR CHECK | `earned` \| `redeemed` \| `expired` \| `bonus` \| `referral` |
| `amount` | INTEGER | Always positive; sign is derived from `type` |
| `balance_before` | INTEGER | Snapshot of balance before this transaction |
| `balance_after` | INTEGER | Snapshot of balance after this transaction |
| `description` | TEXT | Human-readable reason |
| `referred_user_id` | INTEGER FK | Set for `referral` type transactions |
| `campaign_id` | INTEGER FK | Optional campaign linkage |
| `created_at` | TIMESTAMPTZ | Immutable insert timestamp |

**DB-level constraints:**
- `amount <> 0` — zero-value transactions are rejected at the DB layer
- `balance_after >= 0` — balance can never go negative
- `type IN (...)` — enum enforced by CHECK constraint

### user_balance
Maintained by the `trg_sync_user_balance` AFTER INSERT trigger on `point_transactions`.  
Every insert atomically upserts `user_balance.balance = NEW.balance_after`.  
The service layer acquires a `FOR UPDATE` lock on the `user_balance` row before computing `balance_before` / `balance_after`, preventing race conditions under concurrent writes.

### Concurrency safety
`recordPointTransaction()` in `pointTransactionRepository.js`:
1. Opens a transaction
2. `INSERT ... ON CONFLICT DO NOTHING` to ensure the `user_balance` row exists
3. `SELECT ... FOR UPDATE` to lock the row
4. Computes delta, validates `balanceAfter >= 0`
5. Inserts the `point_transactions` row (trigger fires, updates `user_balance`)
6. Commits
