/** @type {import('next').NextConfig} */
const nextConfig = {
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
