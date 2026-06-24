const API_VERSIONS = {
  current: 'v1',
  supported: ['v1'],
  default: 'v1',
  legacySunset: '2027-01-01',
};

function applyVersionHeaders(req, res, next) {
  const version = req.apiVersion || API_VERSIONS.default;
  res.setHeader('X-API-Version', version);

  if (req.apiDeprecated) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', API_VERSIONS.legacySunset);
    res.setHeader('Link', '</api/v1>; rel="successor-version"');
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Migration-Guide', '/api/versioning');
  } else {
    res.setHeader('X-API-Deprecated', 'false');
  }

  next();
}

function versionedApi(version = API_VERSIONS.current) {
  return (req, res, next) => {
    req.apiVersion = version;
    req.apiDeprecated = false;
    applyVersionHeaders(req, res, next);
  };
}

function legacyApi(req, res, next) {
  req.apiVersion = API_VERSIONS.default;
  req.apiDeprecated = true;
  applyVersionHeaders(req, res, next);
}

function versionsHandler(req, res) {
  res.json({
    success: true,
    data: {
      current: API_VERSIONS.current,
      default: API_VERSIONS.default,
      supported: API_VERSIONS.supported,
      routes: {
        current: `/api/${API_VERSIONS.current}`,
        legacy: '/api',
      },
      deprecation: {
        legacyApiDeprecated: true,
        sunset: API_VERSIONS.legacySunset,
        migrationGuide: '/api/versioning',
        policy:
          'Unversioned /api routes remain backward compatible through the sunset date. New integrations should use /api/v1.',
      },
    },
  });
}

function migrationGuideHandler(req, res) {
  res.json({
    success: true,
    data: {
      current: API_VERSIONS.current,
      legacyBasePath: '/api',
      currentBasePath: `/api/${API_VERSIONS.current}`,
      sunset: API_VERSIONS.legacySunset,
      summary:
        'Prefix legacy /api routes with /api/v1. Request bodies, authentication headers, response envelopes, and error formats are unchanged for v1.',
      examples: [
        { from: 'POST /api/auth/login', to: 'POST /api/v1/auth/login' },
        { from: 'GET /api/campaigns', to: 'GET /api/v1/campaigns' },
        { from: 'GET /api/wallet/balance', to: 'GET /api/v1/wallet/balance' },
        { from: 'POST /api/webhooks', to: 'POST /api/v1/webhooks' },
      ],
      policy: [
        'Publish the successor version in OpenAPI servers and API docs.',
        'Return deprecation and sunset headers for retiring versions.',
        'Keep migration guidance available during the announced migration window.',
        'Maintain backward-compatible aliases until the sunset date.',
      ],
    },
  });
}

module.exports = {
  API_VERSIONS,
  applyVersionHeaders,
  legacyApi,
  migrationGuideHandler,
  versionedApi,
  versionsHandler,
};
