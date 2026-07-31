import { Module, Global } from '@nestjs/common';
import { PrometheusService } from './prometheus';
import { MetricsController } from './metrics.controller';

/**
 * MetricsModule
 *
 * Registers the Prometheus metrics registry and exposes the /metrics
 * scrape endpoint consumed by the Prometheus server defined in
 * monitoring/prometheus/prometheus.yml.
 *
 * Marked @Global so PrometheusService can be injected anywhere without
 * re-importing this module.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [PrometheusService],
  exports: [PrometheusService],
})
export class MetricsModule {}
