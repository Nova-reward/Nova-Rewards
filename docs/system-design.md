# Nova Rewards System Design

This document is the diagram-as-code source for issue #668. The diagrams are
written in Mermaid so they can be reviewed in pull requests and kept close to
the code paths they describe.

## Scope

The diagrams cover the currently implemented Nova Rewards platform:

- `novaRewards/frontend`: Next.js PWA, Freighter wallet integration, API clients,
  Zustand stores, and user/merchant views.
- `novaRewards/backend`: Express API, middleware, service layer, repositories,
  BullMQ workers, contract event indexing, webhooks, and observability.
- `novaRewards/database`: PostgreSQL migrations for merchants, users, campaigns,
  reward issuances, point transactions, redemptions, webhooks, and contract
  events.
- `novaRewards/blockchain`: Stellar Horizon payment and trustline helpers.
- `contracts`: Soroban contracts in the workspace.
- `helm`, `k8s`, `infra`, and `novaRewards/docker-compose*.yml`: deployment
  topologies for staging and production.

## Acceptance Criteria Map

| Issue #668 requirement | Where it is covered |
| --- | --- |
| Component diagram showing all services and interactions | [Component Diagram](#component-diagram) |
| Data flow diagram for reward issuance end-to-end | [Reward Issuance Data Flow](#reward-issuance-data-flow) |
| Contract interaction diagram showing cross-contract calls | [Contract Interaction Diagram](#contract-interaction-diagram) |
| Deployment topology diagram for staging and production | [Deployment Topology](#deployment-topology) |
| At least 5 ADRs for key design choices | [Architecture Decision Records](#architecture-decision-records) |

## Component Diagram

```mermaid
flowchart LR
    user["User browser"]
    merchant["Merchant browser"]
    admin["Admin operator"]
    freighter["Freighter wallet extension"]

    subgraph frontend["Frontend: novaRewards/frontend"]
        next["Next.js PWA"]
        pages["Pages: dashboard, campaigns, rewards, staking, history"]
        contexts["Contexts and stores: Auth, Wallet, Notification, Campaigns, Rewards"]
        apiClient["API clients: lib/api.js, transactionAPI, campaignsApi"]
    end

    subgraph edge["Edge and gateway"]
        nginx["Nginx gateway or Kubernetes Ingress"]
        cors["CORS, TLS termination, path routing"]
    end

    subgraph backend["Backend: novaRewards/backend"]
        express["Express API server"]
        middleware["Middleware: auth, merchant API keys, rate limits, audit, metrics, tracing"]
        routes["Routes: auth, merchants, campaigns, rewards, redemptions, transactions, wallet, trustline, admin, webhooks, contract-events"]
        services["Services: reward issuance, Soroban, Stellar auth, wallet, transaction, notification, webhook, analytics, contract event, cache"]
        repos["Repositories: users, merchants, campaigns, transactions, point transactions, reward issuances, redemptions, webhooks, contract events"]
        jobs["Workers: reward issuance, webhook retry, leaderboard warmer, daily login bonus, reports, backups"]
        swagger["Swagger/OpenAPI at /api/docs"]
    end

    subgraph data["Data layer"]
        postgres["PostgreSQL primary store"]
        redis["Redis cache, rate limits, BullMQ queues"]
        bull["BullMQ queues: reward-issuance, webhook-delivery, transaction-submission"]
    end

    subgraph stellar["Stellar network"]
        horizon["Horizon API"]
        sorobanRpc["Soroban RPC"]
        stellarLedger["Stellar ledger payments and trustlines"]
    end

    subgraph contracts["Soroban contracts: contracts/*"]
        novaToken["nova_token"]
        rewardPool["reward_pool"]
        distribution["distribution"]
        novaRewards["nova-rewards"]
        campaign["campaign"]
        redemption["redemption"]
        referral["referral"]
        vesting["vesting"]
        adminRoles["admin_roles"]
        governance["governance"]
        escrow["escrow"]
        contractState["contract_state"]
    end

    subgraph external["External integrations"]
        email["Email provider"]
        merchantWebhook["Merchant webhook endpoints"]
        monitoring["Prometheus, Grafana, Alertmanager, Loki"]
    end

    user --> next
    merchant --> next
    admin --> next
    next --> pages
    next --> contexts
    contexts --> freighter
    pages --> apiClient
    apiClient --> nginx
    nginx --> cors --> express
    express --> middleware --> routes
    routes --> services
    routes --> repos
    routes --> swagger
    services --> repos
    jobs --> services
    repos --> postgres
    services --> redis
    middleware --> redis
    jobs --> bull
    bull --> redis
    services --> horizon
    services --> sorobanRpc
    horizon --> stellarLedger
    sorobanRpc --> campaign
    sorobanRpc --> novaRewards
    sorobanRpc --> rewardPool
    sorobanRpc --> distribution
    stellarLedger --> novaToken
    stellarLedger --> rewardPool
    stellarLedger --> distribution
    stellarLedger --> novaRewards
    stellarLedger --> campaign
    stellarLedger --> redemption
    stellarLedger --> referral
    stellarLedger --> vesting
    stellarLedger --> adminRoles
    stellarLedger --> governance
    stellarLedger --> escrow
    stellarLedger --> contractState
    services --> email
    services --> merchantWebhook
    monitoring -.->|"scrapes /metrics"| express
    monitoring -.->|"reads metrics"| postgres
    monitoring -.->|"reads metrics"| redis
```

## Reward Issuance Data Flow

The primary issuance path is asynchronous: merchants call
`POST /api/rewards/issue`, the API creates an idempotent database record, and a
BullMQ worker performs the Stellar distribution. The older
`POST /api/rewards/distribute` route performs similar checks and distribution
synchronously.

```mermaid
sequenceDiagram
    autonumber
    actor Merchant
    participant Frontend as Merchant UI / API client
    participant RewardsAPI as Express /api/rewards/issue
    participant Auth as Merchant auth and rate limits
    participant CampaignRepo as campaignRepository
    participant IssuanceRepo as rewardIssuanceRepository
    participant Redis as Redis / BullMQ
    participant Worker as rewardIssuanceWorker
    participant Trustline as blockchain/trustline
    participant Horizon as Stellar Horizon
    participant Ledger as Stellar ledger
    participant DB as PostgreSQL
    participant Monitoring as Metrics and logs

    Merchant->>Frontend: Issue reward for wallet, amount, campaign, idempotency key
    Frontend->>RewardsAPI: POST /api/rewards/issue
    RewardsAPI->>Auth: authenticateMerchant, sliding reward limiter
    Auth-->>RewardsAPI: merchant accepted
    RewardsAPI->>IssuanceRepo: getIssuanceByKey(idempotencyKey)
    alt Duplicate idempotency key
        IssuanceRepo-->>RewardsAPI: existing issuance status
        RewardsAPI-->>Frontend: 200 duplicate with issuanceId and status
    else First request
        RewardsAPI->>IssuanceRepo: createIssuance(status = pending)
        IssuanceRepo->>DB: INSERT reward_issuances
        RewardsAPI->>Redis: enqueue reward-issuance job with same key as jobId
        RewardsAPI-->>Frontend: 202 queued with issuanceId
        Redis-->>Worker: issue-reward job
        Worker->>IssuanceRepo: incrementAttempts(issuanceId)
        Worker->>CampaignRepo: getActiveCampaign(campaignId)
        CampaignRepo->>DB: SELECT active campaign
        alt Campaign inactive or expired
            Worker->>IssuanceRepo: markFailed(reason)
            IssuanceRepo->>DB: UPDATE reward_issuances failed
        else Campaign active
            Worker->>Trustline: verify recipient NOVA trustline
            Trustline->>Horizon: load account balances
            Horizon-->>Trustline: trustline exists or missing
            alt Missing trustline or invalid payment state
                Worker->>IssuanceRepo: markFailed(error) after final retry
                IssuanceRepo->>DB: UPDATE reward_issuances failed
                Worker->>Redis: move exhausted job to reward-issuance-dlq
            else Trustline valid and distribution funded
                Worker->>Horizon: submit payment from distribution account
                Horizon->>Ledger: apply NOVA payment transaction
                Ledger-->>Horizon: transaction hash
                Horizon-->>Worker: txHash
                Worker->>IssuanceRepo: markConfirmed(txHash)
                IssuanceRepo->>DB: UPDATE reward_issuances confirmed
                Worker->>Monitoring: emit job completion and API metrics
            end
        end
    end
```

### Reward Issuance Persistence

```mermaid
erDiagram
    merchants ||--o{ campaigns : owns
    users ||--o{ reward_issuances : receives
    campaigns ||--o{ reward_issuances : funds
    users ||--o{ point_transactions : has
    users ||--o{ transactions : has
    campaigns ||--o{ transactions : attributes
    reward_issuances {
        serial id PK
        varchar idempotency_key UK
        integer campaign_id FK
        integer user_id FK
        varchar wallet_address
        numeric amount
        varchar status
        varchar tx_hash
        text error_message
        integer attempts
        timestamptz created_at
        timestamptz updated_at
    }
```

## Contract Interaction Diagram

This diagram distinguishes actual cross-contract calls from off-chain backend
invocations. Standalone contracts still appear so contract ownership is visible.

```mermaid
flowchart LR
    subgraph offchain["Off-chain callers"]
        backendSoroban["backend/services/sorobanService.js"]
        backendPayments["backend + blockchain/sendRewards.js"]
        eventIndexer["contractEventService.js"]
        freighterWallet["Freighter signed user transactions"]
    end

    subgraph network["Stellar access"]
        sorobanRpc["Soroban RPC"]
        horizon["Horizon API"]
        ledger["Stellar ledger"]
    end

    subgraph contracts["Soroban contracts"]
        campaign["campaign"]
        novaRewards["nova-rewards"]
        novaToken["nova_token"]
        rewardPool["reward_pool"]
        distribution["distribution"]
        redemption["redemption"]
        referral["referral"]
        vesting["vesting"]
        adminRoles["admin_roles"]
        governance["governance"]
        escrow["escrow"]
        contractState["contract_state"]
        dexRouter["Configured DEX router"]
        xlmSac["XLM Stellar Asset Contract"]
    end

    backendSoroban -->|"register_campaign, update_campaign, pause_campaign"| sorobanRpc
    sorobanRpc --> campaign
    backendPayments -->|"verify trustline, submit NOVA payment"| horizon
    horizon --> ledger
    ledger --> novaToken
    freighterWallet -->|"wallet auth, trustline, user-signed tx"| ledger

    rewardPool -->|"transfer(from, pool, amount)"| novaToken
    rewardPool -->|"balance(pool)"| novaToken
    rewardPool -->|"transfer(pool, recipient, amount)"| novaToken

    distribution -->|"balance(distribution)"| novaToken
    distribution -->|"transfer(distribution, recipient, amount)"| novaToken
    distribution -->|"transfer_from(distribution, recipient, distribution, amount)"| novaToken

    novaRewards -->|"swap_exact_in(user, amount, min_out, path)"| dexRouter
    novaRewards -.->|"stores XLM SAC address for swap path"| xlmSac

    campaign -.->|"stores reward_token address; emits reward event"| novaToken
    referral -.->|"internal pool accounting in current code"| novaToken
    vesting -.->|"internal pool accounting in current code"| novaToken
    redemption -.->|"request/confirm/cancel lifecycle only"| novaToken
    adminRoles -.->|"authorizes privileged operations"| novaRewards
    governance -.->|"proposal execution placeholder"| adminRoles
    escrow -.->|"escrow lifecycle only"| novaToken
    contractState -.->|"state snapshots and migrations"| novaRewards

    eventIndexer -->|"streams configured contract IDs"| horizon
    horizon -.->|"mint, claim, stake, unstake events"| eventIndexer
```

Cross-contract calls in source:

| Caller | Target | Source | Calls |
| --- | --- | --- | --- |
| `reward_pool` | `nova_token` | `contracts/reward_pool/src/lib.rs` | `transfer`, `balance` |
| `distribution` | `nova_token` | `contracts/distribution/src/lib.rs` | `balance`, `transfer`, `transfer_from` |
| `nova-rewards` | configured DEX router | `contracts/nova-rewards/src/lib.rs` | `swap_exact_in` |
| Backend Soroban service | `campaign` contract | `novaRewards/backend/services/sorobanService.js` | `register_campaign`, `update_campaign`, `pause_campaign` |
| Backend payment helper | Stellar ledger / NOVA asset | `novaRewards/blockchain/sendRewards.js` | Horizon payment operation |

## Deployment Topology

```mermaid
flowchart TB
    developer["Developer or CI"]
    stellarTestnet["Stellar testnet / Soroban testnet"]
    stellarMainnet["Stellar public network / Soroban mainnet"]

    subgraph staging["Staging: novaRewards/docker-compose.staging.yml"]
        stgGateway["Nginx gateway :8080"]
        stgFrontend["Frontend container :3000"]
        stgBackend["Backend container :3001"]
        stgMigrate["One-shot migration container"]
        stgPostgres["PostgreSQL staging database"]
        stgRedis["Redis single node"]
        stgVolumes["Docker volumes: postgres_data, redis_data"]
    end

    subgraph prodAws["Production: AWS infrastructure from infra/"]
        publicSubnets["Public subnets"]
        privateSubnets["Private subnets"]
        alb["Application Load Balancer with HTTPS"]
        asg["EC2 Auto Scaling Group or Kubernetes worker nodes"]
        rds["RDS PostgreSQL 16, private, encrypted, Multi-AZ"]
        elasticache["ElastiCache Redis, encrypted, auth token"]
        secrets["AWS Secrets Manager"]
        cloudwatch["CloudWatch"]
    end

    subgraph prodK8s["Production app runtime: helm/nova-rewards"]
        ingress["Nginx Ingress with TLS secret"]
        frontendPods["Frontend Deployment, 3 replicas in production override"]
        backendPods["Backend Deployment, 3 replicas in production override"]
        hpa["HorizontalPodAutoscaler"]
        pdb["PodDisruptionBudget"]
        configMap["ConfigMap: NODE_ENV, PORT, NEXT_PUBLIC_API_URL"]
        k8sSecrets["nova-rewards-secrets"]
        services["ClusterIP Services for frontend and backend"]
    end

    subgraph observability["Observability"]
        prometheus["Prometheus"]
        grafana["Grafana"]
        alertmanager["Alertmanager"]
        loki["Loki and Promtail"]
    end

    developer -->|"docker compose -f docker-compose.staging.yml up"| stgGateway
    stgGateway --> stgFrontend
    stgGateway --> stgBackend
    stgMigrate --> stgPostgres
    stgBackend --> stgPostgres
    stgBackend --> stgRedis
    stgPostgres --> stgVolumes
    stgRedis --> stgVolumes
    stgBackend --> stellarTestnet

    developer -->|"terraform apply"| prodAws
    developer -->|"helm upgrade --install -f values-production.yaml"| prodK8s
    alb --> ingress
    ingress --> services
    services --> frontendPods
    services --> backendPods
    hpa --> frontendPods
    hpa --> backendPods
    pdb --> frontendPods
    pdb --> backendPods
    configMap --> frontendPods
    configMap --> backendPods
    k8sSecrets --> backendPods
    secrets --> asg
    asg --> privateSubnets
    alb --> publicSubnets
    backendPods --> rds
    backendPods --> elasticache
    backendPods --> stellarMainnet
    cloudwatch -.->|"metrics and logs"| asg
    prometheus -.->|"scrape /metrics"| backendPods
    grafana --> prometheus
    alertmanager --> prometheus
    loki -.->|"logs"| backendPods
```

### Environment Differences

| Concern | Staging | Production |
| --- | --- | --- |
| Runtime | Docker Compose from `novaRewards/docker-compose.staging.yml` | Helm chart in `helm/nova-rewards` on AWS-managed infrastructure |
| Frontend | One container, `NODE_ENV=staging` | 3 replicas with production override and HPA |
| Backend | One container, conservative DB pool | 3 replicas with production override, HPA, health probes |
| Database | Compose PostgreSQL volume | Private encrypted RDS PostgreSQL 16, Multi-AZ |
| Cache and queues | Single Redis container | Encrypted ElastiCache Redis |
| Network | Nginx gateway on `:8080` | ALB/Ingress with TLS |
| Secrets | `.env.staging` for compose | Kubernetes secret plus AWS Secrets Manager |
| Chain | Testnet endpoints | Mainnet/public endpoints after contract IDs are configured |

## Architecture Decision Records

The ADRs live in `docs/adr/`:

- [ADR 0001: Layered PWA and Express API](adr/0001-layered-pwa-and-express-api.md)
- [ADR 0002: PostgreSQL System of Record with Redis Operational Cache](adr/0002-postgresql-system-of-record-with-redis-operational-cache.md)
- [ADR 0003: Stellar and Soroban for Reward Settlement](adr/0003-stellar-and-soroban-for-reward-settlement.md)
- [ADR 0004: Idempotent Asynchronous Reward Issuance](adr/0004-idempotent-asynchronous-reward-issuance.md)
- [ADR 0005: Modular Soroban Contracts with Explicit Cross-Contract Calls](adr/0005-modular-soroban-contracts.md)
- [ADR 0006: Compose for Staging and Helm on AWS for Production](adr/0006-deployment-topology.md)
