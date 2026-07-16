# CI/CD & Infrastructure Documentation

Complete guide to Nova Rewards E2E testing infrastructure for CI/CD pipelines, Docker, and local development.

## GitHub Actions Workflow

**File:** `.github/workflows/e2e.yml`

### Trigger Events
- Push to `main` branch
- Pull requests to `main` branch
- Manual trigger (`workflow_dispatch`)

### Execution Timeline

```
Job: e2e-tests (15-minute timeout)
│
├─ Checkout code (30s)
├─ Set up Node.js 20 (30s)
├─ Start PostgreSQL service (auto via services:)
│  └─ Health checks: pg_isready every 10s
│
├─ Install backend deps (60s)
├─ Wait for PostgreSQL (10s-30s)
├─ Run migrations (30s)
├─ Seed test data (20s)
├─ Start backend server (10s + wait for /health)
│
├─ Install frontend deps (60s)
├─ Install Playwright browsers (120s)
│
├─ Run Playwright tests (90-120s)
│  └─ desktop-chromium project only
│
├─ Upload artifacts (30s)
│  ├─ playwright-report/ (HTML)
│  ├─ test-results/ (traces, screenshots, videos)
│  └─ junit.xml (test results)
│
├─ Publish test report (30s)
└─ Comment on PR (10s)

Total: ~10-15 minutes
```

### Environment Variables

```yaml
PLAYWRIGHT_FRONTEND_URL: http://localhost:3000
PLAYWRIGHT_BACKEND_URL: http://localhost:3001
CI: "true"              # Enable retries, parallelism
NODE_VERSION: "20"
```

### Services

**PostgreSQL (ubuntu-latest)**
```yaml
postgres:
  image: postgres:16-alpine
  env:
    POSTGRES_USER: nova
    POSTGRES_PASSWORD: changeme
    POSTGRES_DB: nova_rewards
  health_checks: pg_isready every 10s
  ports: 5432:5432
```

Health checks ensure:
1. PostgreSQL is ready before migrations run
2. Migrations can connect successfully
3. Backend can connect to database

### Key Steps

**1. Database Preparation**
```bash
# Health check loop (waits up to 50s)
until pg_isready -h localhost -p 5432 -U nova; do sleep 2; done

# Run migrations
export DATABASE_URL="postgresql://nova:changeme@localhost:5432/nova_rewards"
node ../database/migrate.js

# Seed test data (optional reference data)
node ../../backend/scripts/seed-test-data.js
```

**2. Backend Startup**
```bash
PORT=3001 NODE_ENV=test npm start &

# Health check loop (waits up to 30s)
until curl -s http://localhost:3001/health | grep -q '"status":"ok"'; do
  echo "Waiting for backend..."
  sleep 2
done
```

**3. Playwright Test Execution**
```bash
# Desktop-chromium only (fast feedback)
# Mobile tests run separately on demand
npx playwright test --project=desktop-chromium
```

**4. Artifact Collection**
```
On failure:
  ├─ HTML report:     playwright-report/
  ├─ Test traces:     test-results/traces/
  ├─ Screenshots:     test-results/screenshots/
  ├─ Videos:          test-results/videos/
  └─ JUnit XML:       test-results/junit.xml
```

**5. PR Comments**
Workflow comments on PRs with:
```
## E2E Test Results ✅ PASSED

- **Passed**: 10
- **Failed**: 0
- **Skipped**: 0
- **Total**: 10

[View Full Report](...)
```

### Configuration Behavior

```
Local Development:
  CI variable not set
  ├─ retries: 0
  ├─ workers: 2
  ├─ reuseExistingServer: true
  └─ reporter: [html] (opens on failure)

GitHub Actions:
  CI=true
  ├─ retries: 1 (retry failed tests once)
  ├─ workers: all CPUs (parallel execution)
  ├─ reuseExistingServer: false (fresh start)
  └─ reporter: [github, html, junit, list]
```

## Docker Compose Setup

**File:** `novaRewards/docker-compose.yml`

### Services

**PostgreSQL (16-alpine)**
```yaml
postgres:
  healthcheck: pg_isready -U nova
  volumes: postgres_data:/var/lib/postgresql/data
  ports: 5432:5432
```

**Backend (Node.js)**
```yaml
backend:
  build: ./backend
  environment:
    DATABASE_URL: postgresql://nova:changeme@postgres:5432/nova_rewards
    PORT: 4000
  depends_on:
    postgres:
      condition: service_healthy
  ports: 4000:4000 (or 3001 for E2E)
```

### Startup Commands

```bash
# Start all services with health checks
docker-compose up --wait

# Or manually with dependency ordering
docker-compose up -d postgres
# Wait for health check
docker-compose up -d backend

# Verify readiness
curl http://localhost:3001/health
```

### For E2E Testing

```bash
# Update docker-compose to expose backend on 3001
# Then start services:
docker-compose up -d

# In CI (GitHub Actions):
docker-compose up --wait
```

## Test Data Seeding

**File:** `novaRewards/backend/scripts/seed-test-data.js`

### Purpose

Pre-populate test database with:
- Reference test merchant accounts
- Known wallet addresses (for reproducibility)
- Sample campaigns (optional)

### When to Run

1. **CI/GitHub Actions:** Automatically after migrations
2. **Local Docker:** Optional, after `docker-compose up -d`
3. **Manual testing:** Run explicitly if needed

### What It Does

```javascript
// Connects to database
const pool = new Pool({ connectionString: DATABASE_URL });

// Optionally inserts test merchants
// (Tests create their own with RUN_SUFFIX for uniqueness)

// Logs known wallet addresses for reference:
//   GCKFBEIYTKP5RCTLBMTPHBGO7NUWI6SNAJH5OVHQZAQHNOMZQR3ATYP (Merchant 1)
//   GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K (Customer 1)
//   ...

// Verifies database connectivity
```

### Why Optional

Tests use `RUN_SUFFIX = Date.now().toString(36)` to create unique merchants per run:
```javascript
const merchantName = `E2E Merchant ${RUN_SUFFIX}`;
// Automatically unique: "E2E Merchant 2pxk9l"
```

So database seeding is optional—tests create all needed data independently.

## Local Development Workflow

### Setup (One-time)

```bash
# Clone & navigate
git clone <repo>
cd novaRewards

# Install Node.js 20 (if not already installed)
nvm use 20

# Install backend deps
cd backend
npm install

# Install frontend deps
cd ../frontend
npm install
```

### Run Tests Locally

```bash
# Terminal 1: Start backend services
cd novaRewards
docker-compose up -d

# Terminal 2: Start frontend dev server
cd frontend
npm run dev

# Terminal 3: Run E2E tests
cd frontend
npx playwright test --project=desktop-chromium
```

### Development Iteration

```bash
# Run single test while developing
npx playwright test -g "Merchant registers" --project=desktop-chromium

# Debug mode (pauses at each step)
npx playwright test --debug

# UI mode (interactive, visual)
npx playwright test --ui

# View test report
npx playwright show-report
```

### Cleanup

```bash
# Stop backend services
docker-compose down

# Or reset database
docker-compose down -v
docker-compose up -d
```

## Playwright Configuration Details

**File:** `novaRewards/frontend/playwright.config.js`

### Key Settings

```javascript
// Test isolation
testTimeout: 60_000        // 60s per test
globalTimeout: 30 * 60_000 // 30m total

// Parallelism
fullyParallel: true        // Parallel spec files
workers: process.env.CI ? undefined : 2

// Retries (absorb transient issues in CI)
retries: process.env.CI ? 1 : 0

// Artifacts
screenshot: 'only-on-failure'
video: 'retain-on-failure'
trace: 'on-first-retry'

// Reporters (multiple in CI)
reporter: [github, html, junit, list]
```

### Frontend Server Management

```javascript
webServer: {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  stdout: process.env.CI ? 'ignore' : 'pipe',
  stderr: 'pipe',
}
```

- **CI:** Always start fresh (fail-fast on port conflicts)
- **Local:** Reuse running dev server (faster iteration)

## Deterministic Test Data

### RUN_SUFFIX Pattern

All test fixtures use `Date.now().toString(36)` for uniqueness:

```javascript
const RUN_SUFFIX = Date.now().toString(36); // "2pxk9l"

const merchantName = `E2E Merchant ${RUN_SUFFIX}`;
const campaignName = `E2E Campaign ${RUN_SUFFIX}`;
```

### Why This Works

```
Run 1: Date.now() = 1721163600000 → RUN_SUFFIX = "2pxk9l"
  Merchant: "E2E Merchant 2pxk9l"
  ✓ Unique (different from other runs)

Run 2: Date.now() = 1721163605000 → RUN_SUFFIX = "2pxk9l"
  Merchant: "E2E Merchant 2pxk9l"
  ✓ Same run within same second (deterministic)

Run 3: Later → RUN_SUFFIX = "2pxk9m"
  Merchant: "E2E Merchant 2pxk9m"
  ✓ Different from Run 1 (no DB collision)
```

### Database Collision Prevention

Tests run in parallel, each with unique data:

```
Test 1: Creates "E2E Merchant 2pxk9l" (parallel)
Test 2: Creates "E2E Merchant 2pxk9l" (parallel)  ← Same RUN_SUFFIX
        ✓ Different merchant names due to test-specific logic

OR

Test A: Creates "E2E Merchant 2pxk9l" (Run 1)
Test B: Creates "E2E Merchant 2pxk9m" (Run 2)
        ✓ Completely different names
```

## Environment-Specific Configuration

### Local Development
```bash
export PLAYWRIGHT_FRONTEND_URL=http://localhost:3000
export PLAYWRIGHT_BACKEND_URL=http://localhost:3001
unset CI

# Result:
#   retries: 0
#   workers: 2
#   reuseExistingServer: true
```

### GitHub Actions (CI)
```bash
export CI=true
export PLAYWRIGHT_FRONTEND_URL=http://localhost:3000
export PLAYWRIGHT_BACKEND_URL=http://localhost:3001

# Result:
#   retries: 1
#   workers: all CPUs
#   reuseExistingServer: false
```

### Docker (Local Testing)
```bash
docker-compose up --wait
cd frontend
npx playwright test --project=desktop-chromium

# Uses local defaults (no CI env var)
```

## Troubleshooting CI Failures

### PostgreSQL Won't Start
**Log:** `connection refused` from migrations  
**Fix:** Ensure `postgres` service is healthy:
```bash
# In CI logs:
docker logs $(docker-compose ps -q postgres)
```

### Backend Won't Start
**Log:** `EADDRINUSE` port 3001 already in use  
**Fix:** Force new server start (CI does this automatically):
```bash
lsof -i :3001 | kill -9 $(awk 'NR>1 {print $2}')
```

### Tests Timeout
**Log:** Balance polling exceeds 30s  
**Fix:** Check backend health:
```bash
curl http://localhost:3001/health
# Should return: { "success": true, "data": { "status": "ok" } }
```

### Freighter Mock Not Working
**Log:** `signTransaction is not a function`  
**Fix:** Verify mock is injected before navigation:
```javascript
await page.addInitScript(script, arg);  // BEFORE
await page.goto('/merchant');           // AFTER
```

## Artifacts & Debugging

### CI Artifacts

After test run, download from GitHub Actions:

```
playwright-report/
├─ index.html          # Full test report with screenshots
├─ trace/              # Browser traces (Playwright DevTools)
└─ ...

test-results/
├─ junit.xml           # Test results (parsed by CI)
├─ traces/             # Full browser traces
├─ screenshots/        # Failure screenshots
└─ videos/             # Test videos
```

### View Locally

```bash
# Download artifacts from CI
# Then:
npx playwright show-report

# Or open directly:
open playwright-report/index.html
```

## Performance Optimization

### Parallel Execution
```yaml
workers: undefined  # In CI: uses all CPUs
workers: 2          # Local: limit to 2 to avoid backend overload
```

### Test Retries
```yaml
retries: 1  # CI: retry once to absorb transient Horizon/Redis issues
retries: 0  # Local: fail fast so dev sees issues immediately
```

### Server Reuse
```yaml
reuseExistingServer: true   # Local: reuse dev server for fast iteration
reuseExistingServer: false  # CI: always fresh (clean state)
```

### Timeout Tuning
```javascript
testTimeout: 60_000         // Includes polling (30s) + buffer
navigationTimeout: 30_000   // Page loads
actionTimeout: 15_000       // Form fills, clicks
```

## Next Steps

1. **Run locally first:**
   ```bash
   cd novaRewards/frontend
   npx playwright test --project=desktop-chromium
   ```

2. **Push to main:**
   - GitHub Actions runs automatically
   - Results in Actions tab

3. **Review artifacts:**
   - HTML report
   - Screenshots on failure

4. **Iterate:**
   - Fix any issues
   - Re-run locally
   - Push again

---

**Infrastructure Status:** ✅ Complete and Ready

