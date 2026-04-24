'use strict';

/**
 * Pact Provider Verification test for nova-rewards-backend.
 *
 * Fetches all consumer contracts published to the Pact Broker by
 * nova-rewards-frontend, replays each interaction against the running
 * Express server, and publishes the verification result back to the broker.
 *
 * Run with:
 *   PACT_BROKER_URL=https://pact.novarewards.io \
 *   PACT_BROKER_TOKEN=<token> \
 *   GIT_COMMIT=$(git rev-parse HEAD) \
 *   GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) \
 *   npx jest --testPathPattern="pact/" --runInBand
 *
 * For local testing without a broker, set PACT_LOCAL=true and place the
 * contract file at novaRewards/frontend/pacts/ — the verifier will read
 * it directly via pactUrls.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

// ── Module mocks — must be declared before any require() ──────────────────
// Mirror the mocks used in the existing backend test suite so the provider
// starts cleanly without real DB / Stellar / email connections.
jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));
jest.mock('../db/index', () => ({ query: jest.fn(), pool: { query: jest.fn() } }));
jest.mock('../services/emailService', () => ({
  sendWelcome: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../../blockchain/stellarService', () => ({
  server: {},
  NOVA: {},
  isValidStellarAddress: jest.fn().mockReturnValue(true),
  getNOVABalance: jest.fn().mockResolvedValue('0'),
}));
jest.mock('../../blockchain/sendRewards', () => ({ sendRewards: jest.fn() }));
jest.mock('../../blockchain/issueAsset', () => ({}));
jest.mock('../../blockchain/trustline', () => ({}));
jest.mock('../routes/rewards', () => require('express').Router());
jest.mock('../routes/transactions', () => require('express').Router());

// ── Inject a test user via the authenticateUser middleware mock ────────────
// The verifier sends interactions as-is; we decode the Authorization header
// to determine the role so admin vs. user interactions work correctly.
jest.mock('../middleware/authenticateUser', () => ({
  authenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'unauthorized', message: 'Bearer token is required' });
    }
    try {
      const parts = auth.substring(7).split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      req.user = { id: payload.userId || 42, role: payload.role || 'user' };
      next();
    } catch {
      // Token is not a real JWT (e.g. plain 'token' string from Pact interactions)
      // Default to a regular user so non-admin interactions pass auth
      req.user = { id: 42, role: 'user' };
      next();
    }
  },
  requireAdmin: (req, res, next) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Admin access required' });
    }
    next();
  },
  requireOwnershipOrAdmin: (req, res, next) => {
    if (req.method === 'GET') return next();
    const resourceUserId = parseInt(req.params.id);
    if (req.user?.id !== resourceUserId && req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'forbidden', message: 'Forbidden' });
    }
    next();
  },
}));

jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, _res, next) => {
    req.merchant = { id: 7, name: 'Test Merchant' };
    next();
  },
}));

const path = require('path');
const { Verifier } = require('@pact-foundation/pact');
const app = require('../server');

describe('Pact Provider Verification — nova-rewards-backend', () => {
  let server;
  let port;

  beforeAll((done) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('verifies all consumer contracts from the Pact Broker', () => {
    const isLocal = process.env.PACT_LOCAL === 'true';

    const verifierOptions = {
      providerBaseUrl: `http://127.0.0.1:${port}`,
      provider: 'nova-rewards-backend',
      providerVersion: process.env.GIT_COMMIT || 'local',
      providerVersionBranch: process.env.GIT_BRANCH || 'local',
      publishVerificationResult: process.env.CI === 'true',
      stateHandlers: require('./stateHandlers'),
      logLevel: 'warn',
      // Increase timeout for slower CI environments
      timeout: 30000,
    };

    if (isLocal) {
      // Local mode: read contract files directly from the consumer pacts directory
      verifierOptions.pactUrls = [
        path.resolve(
          __dirname,
          '../../frontend/pacts/nova-rewards-frontend-nova-rewards-backend.json'
        ),
      ];
    } else {
      // CI mode: fetch contracts from the Pact Broker
      verifierOptions.pactBrokerUrl = process.env.PACT_BROKER_URL;
      verifierOptions.pactBrokerToken = process.env.PACT_BROKER_TOKEN;
      // Verify contracts for the current branch and the main/develop branches
      verifierOptions.consumerVersionSelectors = [
        { branch: process.env.GIT_BRANCH || 'main' },
        { mainBranch: true },
        { deployedOrReleased: true },
      ];
    }

    return new Verifier(verifierOptions).verifyProvider();
  }, 60000); // 60s Jest timeout for the verification run
});
