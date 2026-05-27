'use strict';

// Minimal env required by validateEnv / other modules loaded transitively
process.env.NODE_ENV = 'test';
process.env.ISSUER_PUBLIC = 'GDQGIY5T5QULPD7V54LJODKC5CMKPNGTWVEMYBQH4LV6STKI6IGO543K';
process.env.HORIZON_URL = 'https://horizon-testnet.stellar.org';
process.env.STELLAR_NETWORK = 'testnet';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

const express = require('express');
const request = require('supertest');

const { correlationMiddleware } = require('../middleware/correlationMiddleware');
const { httpLogger } = require('../middleware/httpLogger');
const logger = require('../lib/logger');

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(correlationMiddleware);
  app.use(httpLogger);
  app.get('/ok', (_req, res) => res.json({ ok: true }));
  app.get('/fail', (_req, res) => res.status(500).json({ ok: false }));
  app.get('/bad', (_req, res) => res.status(400).json({ ok: false }));
  return app;
}

// ── Logger unit tests ─────────────────────────────────────────────────────────

describe('logger', () => {
  it('is a winston logger with expected methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('emits a structured JSON log entry', (done) => {
    logger.once('data', (entry) => {
      expect(entry).toMatchObject({
        level: 'info',
        message: 'test message',
        service: expect.any(String),
        timestamp: expect.any(String),
      });
      done();
    });
    logger.info('test message', { foo: 'bar' });
  });

  it('includes extra metadata in the log entry', (done) => {
    logger.once('data', (entry) => {
      expect(entry.correlationId).toBe('abc-123');
      done();
    });
    logger.info('with meta', { correlationId: 'abc-123' });
  });

  it('respects LOG_LEVEL env var', () => {
    expect(logger.level).toBe(process.env.LOG_LEVEL || 'info');
  });

  it('does not add CloudWatch transport when CLOUDWATCH_LOG_GROUP is unset', () => {
    const cwTransports = logger.transports.filter(
      (t) => t.constructor.name === 'WinstonCloudWatch'
    );
    expect(cwTransports).toHaveLength(0);
  });
});

// ── correlationMiddleware tests ───────────────────────────────────────────────

describe('correlationMiddleware', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  it('generates a correlation ID when none is provided', async () => {
    const res = await request(app).get('/ok');
    expect(res.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('propagates an existing correlation ID from the request header', async () => {
    const id = 'my-trace-id-001';
    const res = await request(app).get('/ok').set('x-correlation-id', id);
    expect(res.headers['x-correlation-id']).toBe(id);
  });

  it('attaches correlationId to req object', async () => {
    let captured;
    const testApp = express();
    testApp.use(correlationMiddleware);
    testApp.get('/probe', (req, res) => {
      captured = req.correlationId;
      res.json({});
    });
    const id = 'probe-id-xyz';
    await request(testApp).get('/probe').set('x-correlation-id', id);
    expect(captured).toBe(id);
  });

  it('generates a unique ID per request when none is supplied', async () => {
    const [r1, r2] = await Promise.all([
      request(app).get('/ok'),
      request(app).get('/ok'),
    ]);
    expect(r1.headers['x-correlation-id']).not.toBe(r2.headers['x-correlation-id']);
  });
});

// ── httpLogger tests ──────────────────────────────────────────────────────────

describe('httpLogger', () => {
  let app;
  let logSpy;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    logSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('logs at info level for 2xx responses', async () => {
    await request(app).get('/ok');
    expect(logger.info).toHaveBeenCalledWith(
      'http request',
      expect.objectContaining({
        method: 'GET',
        url: '/ok',
        statusCode: 200,
        durationMs: expect.any(Number),
        correlationId: expect.any(String),
      })
    );
  });

  it('logs at warn level for 4xx responses', async () => {
    await request(app).get('/bad');
    expect(logger.warn).toHaveBeenCalledWith(
      'http request',
      expect.objectContaining({ statusCode: 400 })
    );
  });

  it('logs at error level for 5xx responses', async () => {
    await request(app).get('/fail');
    expect(logger.error).toHaveBeenCalledWith(
      'http request',
      expect.objectContaining({ statusCode: 500 })
    );
  });

  it('includes the correlationId from the request', async () => {
    const id = 'logger-test-id';
    await request(app).get('/ok').set('x-correlation-id', id);
    expect(logger.info).toHaveBeenCalledWith(
      'http request',
      expect.objectContaining({ correlationId: id })
    );
  });

  it('records a non-negative durationMs', async () => {
    await request(app).get('/ok');
    const [, meta] = logSpy.mock.calls[0];
    expect(meta.durationMs).toBeGreaterThanOrEqual(0);
  });
});
