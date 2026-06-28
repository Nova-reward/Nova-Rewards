import { Injectable } from '@nestjs/common';
import { config, EnvConfig, isProduction, isDevelopment, isTest, isFeatureEnabled } from './env';

@Injectable()
export class ConfigService {
  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return config[key];
  }

  get all(): EnvConfig {
    return config;
  }

  isProduction(): boolean {
    return isProduction;
  }

  isDevelopment(): boolean {
    return isDevelopment;
  }

  isTest(): boolean {
    return isTest;
  }

  isFeatureEnabled(feature: 'ENABLE_METRICS' | 'ENABLE_LOGGING'): boolean {
    return isFeatureEnabled(feature);
  }
}
