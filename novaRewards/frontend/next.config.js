/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL,
    NEXT_PUBLIC_ISSUER_PUBLIC: process.env.NEXT_PUBLIC_ISSUER_PUBLIC,
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_MULTISIG_CONTRACT_ID: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID,
  },
  publicRuntimeConfig: {
    NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL,
    NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
    NEXT_PUBLIC_MULTISIG_CONTRACT_ID: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID,
  },
  // Optimize for Vercel Edge Network
  compress: true,
  poweredByHeader: false,
  // Enable SWR for better caching
  swcMinify: true,
};

module.exports = nextConfig;
