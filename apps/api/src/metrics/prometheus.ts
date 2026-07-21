import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from 'prom-client';

@Injectable()
export class PrometheusService implements OnModuleInit {
  readonly registry: Registry;

  // HTTP metrics
  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationSeconds: Histogram<string>;
  readonly httpActiveRequests: Gauge<string>;

  // Database metrics
  readonly dbQueryDurationSeconds: Histogram<string>;

  // Business metrics
  readonly rewardsDistributedTotal: Counter<string>;
  readonly redemptionsProcessedTotal: Counter<string>;
  readonly userRegistrationsTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();

    // Default Node.js metrics (CPU, memory, GC, event loop, etc.)
    collectDefaultMetrics({ register: this.registry });

    // ── HTTP ──────────────────────────────────────────────────────────────
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.httpActiveRequests = new Gauge({
      name: 'http_active_requests',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['method', 'route'],
      registers: [this.registry],
    });

    // ── Database ──────────────────────────────────────────────────────────
    this.dbQueryDurationSeconds = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    // ── Business ──────────────────────────────────────────────────────────
    this.rewardsDistributedTotal = new Counter({
      name: 'rewards_distributed_total',
      help: 'Total number of rewards distributed to users',
      labelNames: ['merchant_id'],
      registers: [this.registry],
    });

    this.redemptionsProcessedTotal = new Counter({
      name: 'redemptions_processed_total',
      help: 'Total number of redemptions processed',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.userRegistrationsTotal = new Counter({
      name: 'user_registrations_total',
      help: 'Total number of new user registrations',
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    // Metrics are registered in the constructor; nothing extra needed at init.
  }

  /** Returns the Prometheus text-format scrape payload. */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type header value Prometheus expects. */
  get contentType(): string {
    return this.registry.contentType;
  }
}
