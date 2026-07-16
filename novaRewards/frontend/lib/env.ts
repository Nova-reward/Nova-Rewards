/**
 * Environment variable validation for Next.js App Router.
 * Import this in next.config.ts to fail fast on missing vars.
 *
 * Closes #598
 */

const PUBLIC_VARS = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
} as const;

const SERVER_VARS = {
  // Add server-only vars here (not prefixed with NEXT_PUBLIC_)
} as const;

type EnvKey = keyof typeof PUBLIC_VARS | keyof typeof SERVER_VARS;

const REQUIRED: EnvKey[] = ['NEXT_PUBLIC_API_URL'];

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n\nCopy .env.example to .env and fill in the values.`
    );
  }
}

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL ?? '',
  issuerPublic: process.env.NEXT_PUBLIC_ISSUER_PUBLIC ?? '',
  stellarNetwork: (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet',
  multisigContractId: process.env.NEXT_PUBLIC_MULTISIG_CONTRACT_ID ?? '',
  stakingEnabled: process.env.NEXT_PUBLIC_STAKING_ENABLED === 'true',
  referralEnabled: process.env.NEXT_PUBLIC_REFERRAL_ENABLED === 'true',
} as const;

export type Env = typeof env;
