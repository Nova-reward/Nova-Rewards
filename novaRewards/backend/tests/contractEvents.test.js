// Feature: webhook listener for contracts
// Validates: Requirements #182

// Must be set before requiring server.js
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';

const request = require('supertest');

// Stub validateEnv so server.js does not halt on missing env vars
jest.mock('../middleware/validateEnv', () => ({ validateEnv: jest.fn() }));

// Mock the db layer
jest.mock('../db/contractEventRepository', () => ({
  getContractEvents: jest.fn(),
  getContractEventById: jest.fn(),
  recordContractEvent: jest.fn(),
  markEventProcessed: jest.fn(),
  markEventFailed: jest.fn(),
  getPendingEvents: jest.fn(),
}));

// Mock authenticateMerchant middleware
jest.mock('../middleware/authenticateMerchant', () => ({
  authenticateMerchant: (req, res, next) => {
    req.merchant = { id: 1, name: 'Test Merchant' };
    next();
  },
}));

const app = require('../server');
const {
  getContractEvents,
  getContractEventById,
} = require('../db/contractEventRepository');

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// GET /api/contract-events
// ---------------------------------------------------------------------------
describe('GET /api/contract-events', () => {
  test('200 - returns paginated contract events', async () => {
    const mockResult = {
      data: [
        {
          id: 1,
          contract_id: 'CONTRACT123',
          event_type: 'mint',
          event_data: { amount: '100' },
          status: 'processed',
          created_at: '2026-03-27T10:00:00Z',
        },
        {
          id: 2,
          contract_id: 'CONTRACT123',
          event_type: 'claim',
          event_data: { amount: '50' },
          status: 'processed',
          created_at: '2026-03-26T10:00:00Z',
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    };

    getContractEvents.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/contract-events');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  test('200 - filters by contract ID', async () => {
    const mockResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    getContractEvents.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/contract-events')
      .query({ contractId: 'CONTRACT123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getContractEvents).toHaveBeenCalledWith({
      contractId: 'CONTRACT123',
      eventType: undefined,
      page: 1,
      limit: 20,
    });
  });

  test('200 - filters by event type', async () => {
    const mockResult = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    getContractEvents.mockResolvedValue(mockResult);

    const res = await request(app)
      .get('/api/contract-events')
      .query({ type: 'mint' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getContractEvents).toHaveBeenCalledWith({
      contractId: undefined,
      eventType: 'mint',
      page: 1,
      limit: 20,
    });
  });

  test('400 - rejects when page is invalid', async () => {
    const res = await request(app)
      .get('/api/contract-events')
      .query({ page: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/page/i);
  });

  test('400 - rejects when limit exceeds maximum', async () => {
    const res = await request(app)
      .get('/api/contract-events')
      .query({ limit: 150 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/limit/i);
  });

  test('400 - rejects when type is invalid', async () => {
    const res = await request(app)
      .get('/api/contract-events')
      .query({ type: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.message).toMatch(/type/i);
  });
});

// ---------------------------------------------------------------------------
// GET /api/contract-events/:id
// ---------------------------------------------------------------------------
describe('GET /api/contract-events/:id', () => {
  test('200 - returns a specific contract event', async () => {
    const mockEvent = {
      id: 1,
      contract_id: 'CONTRACT123',
      event_type: 'mint',
      event_data: { amount: '100' },
      status: 'processed',
      created_at: '2026-03-27T10:00:00Z',
    };

    getContractEventById.mockResolvedValue(mockEvent);

    const res = await request(app)
      .get('/api/contract-events/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.event_type).toBe('mint');
  });

  test('400 - rejects when id is invalid', async () => {
    const res = await request(app)
      .get('/api/contract-events/invalid');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('validation_error');
  });

  test('404 - returns not found for non-existent event', async () => {
    getContractEventById.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/contract-events/999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('not_found');
  });
});
