import type { NextConfig } from 'next';

// Validate required environment variables at startup.
// Throws with a clear message if any are missing.
const requiredEnvVars = [
  'NEXT_PUBLIC_API_URL',
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const nextConfig: NextConfig = {
  // Enable App Router (default in Next.js 14+)
  experimental: {
    typedRoutes: true,
  },

  // TypeScript strict mode enforced at build time
  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  // Absolute imports via tsconfig paths
  // (handled by tsconfig.json paths + Next.js automatic resolution)

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',
    NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL ?? '',
    NEXT_PUBLIC_ISSUER_PUBLIC: process.env.NEXT_PUBLIC_ISSUER_PUBLIC ?? '',
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet',
    NEXT_PUBLIC_MULTISIG_CONTRACT_ID: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID ?? '',
    NEXT_PUBLIC_STAKING_ENABLED: process.env.NEXT_PUBLIC_STAKING_ENABLED ?? 'false',
    NEXT_PUBLIC_REFERRAL_ENABLED: process.env.NEXT_PUBLIC_REFERRAL_ENABLED ?? 'false',
  },

  compress: true,
  poweredByHeader: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 86400,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
