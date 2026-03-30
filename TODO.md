# Test Fixtures Implementation TODO

Status: 🚀 In Progress

## Steps (sequential)

### 1. ✅ Planning & Approval Complete

### 2. ✅ Install Dependencies

- Backend: `cd novaRewards/backend && npm i --save-dev @faker-js/faker knex` ✅ (complete)
- Frontend: `cd novaRewards/frontend && npm i --save-dev msw @faker-js/faker` ✅ (complete)
- Verify: no breaking changes

### 3. ✅ Database Fixtures

- Create `novaRewards/database/test_fixtures.sql`: PL/pgSQL factories (create_user(), create_campaign(), etc.) ✅
- Test: Run in psql, verify inserts/ids returned

### 4. ✅ Backend/API Fixtures & Jest Setup

- Create `novaRewards/backend/tests/fixtures/factory.js`, `db.js` ✅
- Edit `jest.setup.js`: Global beforeAll/afterAll (migrate fixtures, truncate tables) ✅
- Edit `security.test.js`: Replace manual payloads with factories ✅
- Test: `cd novaRewards/backend && npm test tests/security`

### 5. Contract Fixtures

- Create shared `contracts/nova-rewards/tests/fixtures.rs` (env helpers)
- Update key tests to import/use
- Test: `cd contracts/nova-rewards && cargo test`

### 6. Frontend Fixtures

- Create `novaRewards/frontend/__tests__/factories/index.js`, MSW handlers
- Update existing tests
- Test: `cd novaRewards/frontend && npm test`

### 7. Lifecycle, Cleanup, Docs

- Backend test DB docker-compose.test.yml
- Update READMEs, scripts in package.json
- Full run: `npm run test:fixtures`

### 8. ✅ Completion & Verification

Next: Step 2 🚀
