import { envSchema } from '../env';

describe('Environment Validation', () => {
  it('should validate valid environment variables', () => {
    const validEnv = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'a'.repeat(32),
      ISSUER_PUBLIC: 'GABC123',
      ISSUER_SECRET: 'SABC123',
    };

    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('should reject missing required variables', () => {
    const invalidEnv = {
      NODE_ENV: 'development',
    };

    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });

  it('should reject invalid JWT_SECRET length', () => {
    const invalidEnv = {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'short',
      ISSUER_PUBLIC: 'GABC123',
      ISSUER_SECRET: 'SABC123',
    };

    const result = envSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some(e => e.path.includes('JWT_SECRET'))).toBe(true);
    }
  });

  it('should apply defaults for optional variables', () => {
    const minimalEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'a'.repeat(32),
      ISSUER_PUBLIC: 'GABC123',
      ISSUER_SECRET: 'SABC123',
    };

    const result = envSchema.safeParse(minimalEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
      expect(result.data.PORT).toBe(3000);
      expect(result.data.STELLAR_NETWORK).toBe('testnet');
    }
  });
});
