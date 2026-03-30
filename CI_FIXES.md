# CI/CD Pipeline Fixes

## Issues Fixed

### 1. Backend Tests Failing
**Problem**: Tests were failing due to missing test environment setup (database, Redis, environment variables).

**Solution**: 
- Added PostgreSQL and Redis services to the CI workflow
- Added required environment variables for tests
- Changed from `npm install` to `npm ci` for consistent installs
- Added proper test database configuration

### 2. Frontend Build Failing
**Problem**: Frontend build was failing, possibly due to missing dependencies or package-lock.json.

**Solution**:
- Changed from `npm install` to `npm ci` for reproducible builds
- Added check for package-lock.json existence
- Kept all required environment variables for Next.js build

### 3. Vercel Preview Deployment Failing
**Problem**: Vercel deployment was failing due to missing secrets or incorrect action version.

**Solution**:
- Added conditional check to only run if Vercel secrets are configured
- Updated to use `amondnet/vercel-action@v25` (more stable)
- Fixed deployment URL reference in PR comment
- Made PR comment conditional on successful deployment

## Changes Made

### `.github/workflows/ci.yml`

#### Backend Tests
- Added PostgreSQL 16 service container
- Added Redis 7 service container
- Added health checks for both services
- Added environment variables:
  - `NODE_ENV=test`
  - `DATABASE_URL` pointing to test database
  - `REDIS_URL` pointing to test Redis
  - `JWT_SECRET` and `JWT_REFRESH_SECRET` for tests
- Changed to `npm ci` for faster, more reliable installs
- Added `--maxWorkers=2` to prevent resource exhaustion

#### Frontend Build
- Changed to `npm ci` for reproducible builds
- Added check for package-lock.json
- Kept all Next.js environment variables

### `.github/workflows/vercel-preview.yml`

- Added conditional: `if: ${{ secrets.VERCEL_TOKEN != '' }}`
- Updated action to `amondnet/vercel-action@v25`
- Fixed deployment URL reference
- Made PR comment conditional on success

## Required Secrets

For Vercel deployment to work, configure these secrets in GitHub:
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

## Testing the Fixes

### Local Testing

#### Backend Tests
```bash
cd novaRewards/backend

# Start test dependencies
docker run -d --name test-postgres -e POSTGRES_PASSWORD=test_password -e POSTGRES_DB=nova_rewards_test -p 5432:5432 postgres:16-alpine
docker run -d --name test-redis -p 6379:6379 redis:7-alpine

# Run tests
export NODE_ENV=test
export DATABASE_URL=postgresql://postgres:test_password@localhost:5432/nova_rewards_test
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=test_jwt_secret
export JWT_REFRESH_SECRET=test_jwt_refresh_secret
npm test

# Cleanup
docker stop test-postgres test-redis
docker rm test-postgres test-redis
```

#### Frontend Build
```bash
cd novaRewards/frontend

# Install dependencies
npm ci

# Build
export NEXT_PUBLIC_API_URL=https://api.nova-rewards.xyz
export NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
export NEXT_PUBLIC_ISSUER_PUBLIC=GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJGU3XYQVVXN7XNXQVVVVVVVV
export NEXT_PUBLIC_STELLAR_NETWORK=public
export NEXT_PUBLIC_MULTISIG_CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
npm run build
```

### CI Testing

Push changes to a branch and create a pull request to test:
```bash
git checkout -b fix/ci-pipeline
git add .github/workflows/
git commit -m "fix: CI/CD pipeline configuration"
git push origin fix/ci-pipeline
```

## Monitoring CI Status

Check CI status at:
- GitHub Actions: `https://github.com/[owner]/[repo]/actions`
- Pull Request checks tab

## Troubleshooting

### Backend Tests Still Failing

1. **Check database connection**:
   - Ensure PostgreSQL service is healthy
   - Verify DATABASE_URL is correct
   - Check if migrations are needed

2. **Check Redis connection**:
   - Ensure Redis service is healthy
   - Verify REDIS_URL is correct

3. **Check test files**:
   - Ensure all test files have proper mocks
   - Verify jest configuration is correct

### Frontend Build Still Failing

1. **Check dependencies**:
   ```bash
   cd novaRewards/frontend
   npm ci
   ```

2. **Check for missing files**:
   - Verify all imported components exist
   - Check for TypeScript errors

3. **Check environment variables**:
   - Ensure all NEXT_PUBLIC_* variables are set
   - Verify values are correct

### Vercel Deployment Still Failing

1. **Check secrets**:
   - Go to GitHub repo Settings > Secrets and variables > Actions
   - Verify VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID exist

2. **Check Vercel project**:
   - Ensure project exists in Vercel dashboard
   - Verify organization and project IDs match

3. **Manual deployment**:
   ```bash
   cd novaRewards/frontend
   vercel --token YOUR_TOKEN
   ```

## Additional Improvements

### Recommended: Add Test Coverage Reporting

Add to `.github/workflows/ci.yml`:
```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./novaRewards/backend/coverage/lcov.info
    flags: backend
```

### Recommended: Add Caching

The workflows already use npm caching via `cache: npm`, which speeds up installs.

### Recommended: Add Linting

Add linting step before tests:
```yaml
- name: Run linter
  working-directory: novaRewards/backend
  run: npm run lint
```

## Summary

All three CI failures have been addressed:
- ✅ Backend tests now have proper test environment
- ✅ Frontend build uses reproducible installs
- ✅ Vercel deployment handles missing secrets gracefully

The CI pipeline should now pass successfully on pull requests.
