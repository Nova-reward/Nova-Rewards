const express = require('express');
const request = require('supertest');
const {
  legacyApi,
  migrationGuideHandler,
  versionedApi,
  versionsHandler,
} = require('../middleware/apiVersioning');

function buildApp() {
  const app = express();

  const router = express.Router();
  router.get('/health', (req, res) => {
    res.json({ success: true, data: { version: req.apiVersion } });
  });

  app.get('/api/versions', legacyApi, versionsHandler);
  app.get('/api/v1/versions', versionedApi('v1'), versionsHandler);
  app.get('/api/versioning', legacyApi, migrationGuideHandler);
  app.get('/api/v1/versioning', versionedApi('v1'), migrationGuideHandler);
  app.use('/api/v1', versionedApi('v1'), router);
  app.use(/^\/api(?!\/v\d+(?:\/|$))/, legacyApi, router);

  return app;
}

describe('API versioning middleware', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  test('serves v1 routes under /api/v1 with current-version headers', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);

    expect(res.body.data.version).toBe('v1');
    expect(res.headers['x-api-version']).toBe('v1');
    expect(res.headers['x-api-deprecated']).toBe('false');
    expect(res.headers.deprecation).toBeUndefined();
    expect(res.headers.sunset).toBeUndefined();
  });

  test('keeps unversioned /api routes backward compatible as deprecated v1', async () => {
    const res = await request(app).get('/api/health').expect(200);

    expect(res.body.data.version).toBe('v1');
    expect(res.headers['x-api-version']).toBe('v1');
    expect(res.headers['x-api-deprecated']).toBe('true');
    expect(res.headers.deprecation).toBe('true');
    expect(res.headers.sunset).toBe('2027-01-01');
    expect(res.headers.link).toBe('</api/v1>; rel="successor-version"');
    expect(res.headers['x-api-migration-guide']).toBe('/api/versioning');
  });

  test('exposes version discovery metadata', async () => {
    const res = await request(app).get('/api/versions').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.current).toBe('v1');
    expect(res.body.data.supported).toEqual(['v1']);
    expect(res.body.data.routes.current).toBe('/api/v1');
    expect(res.body.data.deprecation.legacyApiDeprecated).toBe(true);
    expect(res.headers['x-api-version']).toBe('v1');
    expect(res.headers['x-api-deprecated']).toBe('true');
  });

  test('exposes v1 version discovery without legacy deprecation headers', async () => {
    const res = await request(app).get('/api/v1/versions').expect(200);

    expect(res.body.data.current).toBe('v1');
    expect(res.headers['x-api-version']).toBe('v1');
    expect(res.headers['x-api-deprecated']).toBe('false');
    expect(res.headers.deprecation).toBeUndefined();
  });

  test('exposes migration guide examples and sunset policy', async () => {
    const res = await request(app).get('/api/versioning').expect(200);

    expect(res.body.data.currentBasePath).toBe('/api/v1');
    expect(res.body.data.sunset).toBe('2027-01-01');
    expect(res.body.data.examples).toContainEqual({
      from: 'POST /api/auth/login',
      to: 'POST /api/v1/auth/login',
    });
    expect(res.body.data.policy.length).toBeGreaterThan(0);
    expect(res.headers['x-api-deprecated']).toBe('true');
  });
});
