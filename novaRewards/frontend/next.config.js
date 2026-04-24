/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Validate all required environment variables at build / dev-server startup.
// If any variable is missing or invalid this throws with a clear error message
// and the build is aborted before any code is compiled.
require('./lib/env');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

// 1-year immutable cache for hashed static assets; no-store for HTML
const cacheHeaders = [
  {
    source: '/_next/static/(.*)',
    headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
  },
  {
    source: '/icons/(.*)',
    headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
  },
  {
    source: '/(.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?))',
    headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
  },
];

const nextConfig = {
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      ...cacheHeaders,
    ];
  },
  webpack(config, { isServer }) {
    // These packages are loaded dynamically at runtime only; exclude from bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'albedo-link': false,
        '@creit.tech/stellar-wallets-kit': false,
      };
    }
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL,
    NEXT_PUBLIC_ISSUER_PUBLIC: process.env.NEXT_PUBLIC_ISSUER_PUBLIC,
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_MULTISIG_CONTRACT_ID: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID,
    // Feature flags — baked into the bundle at build time
    NEXT_PUBLIC_STAKING_ENABLED: process.env.NEXT_PUBLIC_STAKING_ENABLED ?? 'false',
    NEXT_PUBLIC_REFERRAL_ENABLED: process.env.NEXT_PUBLIC_REFERRAL_ENABLED ?? 'false',
  },
  publicRuntimeConfig: {
    NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL,
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_MULTISIG_CONTRACT_ID: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID,
  },
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 86400,
  },
  sentry: {
    hideSourceMaps: true,
    widenClientFileUpload: true,
  },
};

const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
};

module.exports = withSentryConfig(
  withBundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions
);
