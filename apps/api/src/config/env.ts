import { z } from 'zod';

// Define the environment variable schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Stellar
  STELLAR_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  HORIZON_URL: z.string().url('HORIZON_URL must be a valid URL').default('https://horizon-testnet.stellar.org'),
  ISSUER_PUBLIC: z.string().min(1, 'ISSUER_PUBLIC is required'),
  ISSUER_SECRET: z.string().min(1, 'ISSUER_SECRET is required'),

  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').default('redis://localhost:6379'),
  REDIS_CACHE_TTL: z.string().transform(Number).default('30'),

  // Rate Limiting
  RATE_LIMIT_STRICT: z.string().transform(Number).default('10'),
  RATE_LIMIT_STANDARD: z.string().transform(Number).default('60'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),

  // Multi-Signature
  COSIGNER_SECRET: z.string().optional(),
  MULTISIG_THRESHOLD_USD: z.string().transform(Number).default('10000'),

  // Webhooks
  WEBHOOK_RETRY_COUNT: z.string().transform(Number).default('5'),
  WEBHOOK_TIMEOUT_MS: z.string().transform(Number).default('10000'),

  // Feature Flags
  ENABLE_METRICS: z.enum(['true', 'false']).default('true'),
  ENABLE_LOGGING: z.enum(['true', 'false']).default('true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Security
  CORS_ORIGIN: z.string().default('*'),
  ALLOWED_ORIGINS: z.string().optional(),
});

// Infer the type from the schema
export type EnvConfig = z.infer<typeof envSchema>;

// Validate and export the config
function validateEnv(): EnvConfig {
  try {
    const validated = envSchema.parse(process.env);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('❌ Failed to validate environment variables:', error);
    }
    process.exit(1);
  }
}

// Single source of truth - no direct process.env access
export const config = validateEnv();

// Export the schema for use in .env.example generation
export { envSchema };

// Helper to get environment name
export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';

// Helper to check if feature is enabled
export const isFeatureEnabled = (feature: keyof Pick<EnvConfig, 'ENABLE_METRICS' | 'ENABLE_LOGGING'>): boolean => {
  return config[feature] === 'true';
};
