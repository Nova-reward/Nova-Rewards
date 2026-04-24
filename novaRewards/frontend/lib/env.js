/**
 * Environment variable validation using Zod.
 *
 * This module validates all required environment variables at startup.
 * If any required variable is missing or invalid, the build/server will
 * throw a clear error rather than failing silently at runtime.
 *
 * Import this module in next.config.js so validation runs at build time.
 */

const { z } = require('zod');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // ── API ──────────────────────────────────────────────────────────────────
  NEXT_PUBLIC_API_URL: z
    .string()
    .url('NEXT_PUBLIC_API_URL must be a valid URL (e.g. http://localhost:3001)'),

  // ── Stellar ──────────────────────────────────────────────────────────────
  NEXT_PUBLIC_HORIZON_URL: z
    .string()
    .url('NEXT_PUBLIC_HORIZON_URL must be a valid URL'),

  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(['testnet', 'mainnet', 'public'], {
    errorMap: () => ({
      message:
        'NEXT_PUBLIC_STELLAR_NETWORK must be one of: testnet | mainnet | public',
    }),
  }),

  NEXT_PUBLIC_ISSUER_PUBLIC: z
    .string()
    .min(1, 'NEXT_PUBLIC_ISSUER_PUBLIC is required')
    .regex(/^G[A-Z2-7]{55}$/, 'NEXT_PUBLIC_ISSUER_PUBLIC must be a valid Stellar public key (starts with G)'),

  // ── Contract IDs (optional — not deployed in all environments) ───────────
  NEXT_PUBLIC_MULTISIG_CONTRACT_ID: z
    .string()
    .optional(),

  // ── Feature Flags ────────────────────────────────────────────────────────
  NEXT_PUBLIC_STAKING_ENABLED: z
    .enum(['true', 'false'], {
      errorMap: () => ({
        message: 'NEXT_PUBLIC_STAKING_ENABLED must be "true" or "false"',
      }),
    })
    .default('false'),

  NEXT_PUBLIC_REFERRAL_ENABLED: z
    .enum(['true', 'false'], {
      errorMap: () => ({
        message: 'NEXT_PUBLIC_REFERRAL_ENABLED must be "true" or "false"',
      }),
    })
    .default('false'),
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates process.env against the schema.
 * Throws a descriptive error listing every invalid/missing variable.
 *
 * @returns {z.infer<typeof envSchema>} The validated, typed env object.
 */
function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n\n❌  Invalid environment configuration — build aborted.\n\n` +
        `The following environment variables are missing or invalid:\n\n` +
        `${issues}\n\n` +
        `Check your .env.local (development) or the appropriate .env.<environment> file.\n`
    );
  }

  return result.data;
}

// Run validation immediately when this module is imported.
// In Next.js this happens during `next build` and `next dev` startup.
const env = validateEnv();

module.exports = { env, validateEnv };
