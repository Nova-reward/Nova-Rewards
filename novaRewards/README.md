# NovaRewards

**NovaRewards** is a blockchain-powered loyalty rewards platform built on Stellar. It combines a customer rewards system with blockchain-backed NOVA token issuance, enabling merchants to create and manage loyalty campaigns with real cryptocurrency rewards.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Setup Instructions](#setup-instructions)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Project Architecture](#project-architecture)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up NovaRewards, ensure you have the following installed:

### System Requirements

- **Node.js 20+** ([download](https://nodejs.org/))
- **PostgreSQL 12+** ([download](https://www.postgresql.org/))
- **Redis** (optional, for rate limiting and caching) ([download](https://redis.io/))

### Browser Requirements

- **Stellar Freighter Wallet** ([install extension](https://www.freighter.app/)) — required for blockchain transactions on the frontend

### Development Tools

- `npm` (bundled with Node.js)
- `git` ([download](https://git-scm.com/))

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd Nova-Rewards/novaRewards

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Configure your .env (see Setup Instructions)
# Edit .env with PostgreSQL, Stellar testnet, and other credentials

# 5. Run database migrations
npm run migrate

# 6. Setup Testnet keypairs and issue NOVA asset
npm run setup:new

# 7. Start backend and frontend
npm run dev:all  # or run separately in different terminals:
# Terminal 1: npm run dev -w backend
# Terminal 2: npm run dev -w frontend

# 8. Run tests
npm run test
```

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Nova-Rewards/novaRewards
```

### 2. Install Dependencies

Using npm workspaces (all packages):

```bash
npm install
```

To install for a specific workspace:

```bash
npm install -w backend
npm install -w frontend
```

### 3. Environment Configuration

#### Copy the Example File

```bash
cp .env.example .env
```

#### Edit `.env` with Your Credentials

Open `.env` in your editor and configure:

**Stellar Testnet Accounts:**

```env
# Leave these empty initially; setup.js will generate them
ISSUER_PUBLIC=
ISSUER_SECRET=
DISTRIBUTION_PUBLIC=
DISTRIBUTION_SECRET=

STELLAR_NETWORK=testnet
HORIZON_URL=https://horizon-testnet.stellar.org
```

**PostgreSQL Database:**

```env
POSTGRES_USER=nova
POSTGRES_PASSWORD=changeme  # Change this!
POSTGRES_DB=nova_rewards
DATABASE_URL=postgresql://nova:changeme@localhost:5432/nova_rewards
DATABASE_MIGRATE_URL=postgresql://nova_migrate:changeme@localhost:5432/nova_rewards
```

**Backend Settings:**

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-long-random-secret-here  # Generate a strong secret
ALLOWED_ORIGIN=http://localhost:3000
```

**Frontend Settings:**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
```

For more environment variables, see `.env.example` comments.

### 4. Create PostgreSQL Database and User

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Create migration user and database
CREATE USER nova_migrate WITH PASSWORD 'changeme';
CREATE USER nova WITH PASSWORD 'changeme';
CREATE DATABASE nova_rewards OWNER nova;

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE nova_rewards TO nova;
GRANT ALL PRIVILEGES ON DATABASE nova_rewards TO nova_migrate;

\q
```

Alternatively, if PostgreSQL is running via Docker or has different credentials, adjust `DATABASE_URL` in `.env`.

### 5. Run Database Migrations

```bash
npm run migrate
```

This will execute all SQL migrations in `database/` to set up tables, indexes, and triggers.

To rollback migrations (dev only):

```bash
npm run migrate -- --rollback
```

### 6. Setup Testnet Keypairs and NOVA Asset

#### Option A: Generate New Keypairs (Recommended for Development)

```bash
npm run setup:new
```

This script will:
- Generate new Issuer and Distribution keypairs
- Fund them via Stellar Friendbot
- Print keypair details to the console
- **You must add these to your `.env` file manually**

Copy the output and update your `.env`:

```env
ISSUER_PUBLIC=G...
ISSUER_SECRET=S...
DISTRIBUTION_PUBLIC=G...
DISTRIBUTION_SECRET=S...
```

#### Option B: Use Existing Keypairs in `.env`

If you already have keypairs in `.env`:

```bash
npm run setup
```

This will:
- Use the existing `ISSUER_SECRET` and `DISTRIBUTION_SECRET` from `.env`
- Fund the accounts via Friendbot (if not already funded)
- Issue the NOVA asset to the Issuer account

**Note:** Friendbot provides 10,000 XLM to newly created testnet accounts.

---

## Running the Application

### Development Mode (Recommended)

Run all services with automatic file watching:

```bash
npm run dev:all
```

Or run individually in separate terminals:

```bash
# Terminal 1: Start backend (port 3001)
npm run dev -w backend

# Terminal 2: Start frontend (port 3000)
npm run dev -w frontend
```

### Production Build

```bash
# Build the frontend
npm run build

# Start the backend (must be built first)
npm run start -w backend

# Start the frontend
npm run start -w frontend
```

### Backend Only

```bash
# Development
npm run dev -w backend

# Production
npm start -w backend
```

**Runs on:** `http://localhost:3001`

### Frontend Only

```bash
# Development
npm run dev -w frontend

# Production (requires `npm run build` first)
npm run start -w frontend
```

**Runs on:** `http://localhost:3000`

---

## Testing

### Run All Tests

```bash
npm test
```

This runs tests for both backend and frontend with coverage reports.

### Backend Tests Only

```bash
npm run test:backend
```

Or:

```bash
npm run test -w backend
```

### Frontend Tests Only

```bash
npm run test:frontend
```

Or:

```bash
npm run test -w frontend
```

### Run Tests in Band (Single Process)

For debugging or when tests have race conditions:

```bash
npx jest --runInBand
```

### Run with Coverage

```bash
npm test -- --coverage
```

### Continuous Integration

```bash
npm run test:ci
```

This generates JUnit XML reports for CI/CD pipelines.

---

## Project Architecture

```
NovaRewards
├── backend/                          # Express.js API server
│   ├── server.js                    # Main server entry point
│   ├── middleware/                  # Auth, rate limiting, CORS
│   ├── routes/                      # API endpoints
│   ├── models/                      # Database queries (SQL layer)
│   ├── services/                    # Business logic
│   ├── stellar/                     # Stellar blockchain integration
│   ├── webhooks/                    # Event listeners
│   └── tests/                       # Jest unit tests
│
├── frontend/                         # Next.js React application
│   ├── pages/                       # Next.js pages and API routes
│   ├── components/                  # React components
│   ├── styles/                      # CSS modules and global styles
│   ├── lib/                         # Utilities (API calls, Stellar SDK)
│   ├── hooks/                       # React hooks
│   ├── context/                     # React context (auth, state)
│   ├── public/                      # Static assets
│   └── __tests__/                   # Jest unit tests
│
├── blockchain/                       # Stellar Soroban smart contracts
│   ├── contracts/                   # Rust contracts
│   └── test/                        # Contract tests
│
├── database/                         # PostgreSQL migrations
│   ├── 001_create_merchants.sql
│   ├── 002_create_users.sql
│   ├── ...
│   └── migrate.js                   # Migration runner
│
├── scripts/                          # Utility scripts
│   ├── setup.js                     # Testnet keypair generation
│   ├── reset-testnet.js             # Reset testnet data
│   └── deploy-contracts.sh          # Deploy contracts
│
├── emails/                           # Email templates
│   └── README.md                    # Email documentation
│
├── docs/                             # Additional documentation
│   ├── api/                         # API documentation
│   └── security/                    # Security guidelines
│
└── docker-compose.yml               # PostgreSQL + Redis setup
```

### Key Components

#### Backend API (`/backend`)

- **Framework:** Express.js
- **Database:** PostgreSQL with migration system
- **Authentication:** JWT (JSON Web Tokens)
- **Rate Limiting:** Express rate-limit with Redis
- **Blockchain:** Stellar SDK for asset management
- **Monitoring:** Prometheus metrics, Elasticsearch logging
- **Testing:** Jest with supertest

**Main Features:**
- User management and authentication
- Campaign management
- Points/rewards system
- Referral tracking
- Merchant account management
- Webhook listeners for contract events
- Email notifications

#### Frontend App (`/frontend`)

- **Framework:** Next.js 14 with React 18
- **Wallet Integration:** Stellar Freighter
- **State Management:** React Context + hooks
- **HTTP Client:** Axios
- **Testing:** Jest + React Testing Library
- **E2E Testing:** Playwright

**Main Features:**
- User onboarding and authentication
- Campaign discovery and participation
- Rewards dashboard
- Referral program interface
- Merchant admin panel
- Wallet connection and transaction signing

#### Database Schema

Core tables:
- `users` — Customer and merchant accounts
- `merchants` — Business details
- `campaigns` — Loyalty campaigns
- `transactions` — Point earn/redeem events
- `point_transactions` — Detailed ledger
- `redemptions` — Reward fulfillment
- `contract_events` — Blockchain events
- `webhooks` — Event subscriptions

All tables include audit columns (`created_at`, `updated_at`) and appropriate indexes for query performance.

#### Stellar Blockchain Integration

- **NOVA Asset:** Custom token issued on Stellar testnet
- **Accounts:** Issuer (issues NOVA) + Distribution (sends tokens)
- **Keypairs:** Generated via `setup.js` and funded via Friendbot
- **Contract Events:** Soroban contract webhooks logged for tracking

---

## Troubleshooting

### Database Connection Error

**Error:** `ECONNREFUSED ... 5432`

**Solution:**
- Ensure PostgreSQL is running: `sudo service postgresql status`
- Check `DATABASE_URL` in `.env` matches your PostgreSQL config
- If using Docker: `docker-compose up -d` (starts PostgreSQL in container)

### "Cannot find module" Error

**Error:** `Cannot find module 'express'`

**Solution:**
```bash
# Clear and reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Stellar Testnet Keypair Issues

**Error:** `ERROR: --use-env requires ISSUER_SECRET and DISTRIBUTION_SECRET in .env`

**Solution:**
```bash
npm run setup:new
# Copy the printed keypairs into your .env
# Then run: npm run setup
```

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
```bash
# Find and kill the process using port 3001
lsof -i :3001
kill -9 <PID>

# Or use a different port:
PORT=3002 npm run dev -w backend
```

### Redis Connection Error

**Error:** `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution:**
- Redis is optional. If not needed, remove `REDIS_URL` from `.env`
- To use Redis: `redis-server` (or `docker-compose up redis`)

### Test Failures

**Solution:**
1. Ensure database migrations are up to date: `npm run migrate`
2. Run tests in band mode: `npm run test -- --runInBand`
3. Check test output for specific error messages
4. Verify `.env` has correct database credentials for test environment

### Frontend Won't Connect to Backend

**Error:** `Failed to fetch from API`

**Solution:**
1. Verify backend is running: `npm run dev -w backend` (should listen on 3001)
2. Check `NEXT_PUBLIC_API_URL` in `.env`: should be `http://localhost:3001`
3. Check CORS settings in backend: `ALLOWED_ORIGIN` should match frontend URL
4. Check browser console for specific error messages

### Build Error: "Module not found"

**Error:** `Module not found: '@stellar/freighter-api'`

**Solution:**
```bash
npm install --save @stellar/freighter-api
npm run build
```

---

## Additional Resources

- **Stellar Documentation:** https://developers.stellar.org/
- **Freighter Wallet API:** https://github.com/stellar/freighter
- **Next.js Guide:** https://nextjs.org/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Express.js Guide:** https://expressjs.com/

---

## Support & Contribution

For issues, questions, or contributions, please refer to:
- `CONTRIBUTING.md` — Contribution guidelines
- `TEAM_COMMUNICATION.md` — Team structure
- Project issues: GitHub Issues

---

**Last Updated:** 2024
