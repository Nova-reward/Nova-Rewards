import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrometheusService } from './prometheus';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly prometheusService: PrometheusService) {}

  /**
   * GET /metrics
   * Prometheus scrape endpoint — returns metrics in text exposition format.
   * Should be protected by network policy in production (not exposed publicly).
   */
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    try {
      const metrics = await this.prometheusService.getMetrics();
      res.setHeader('Content-Type', this.prometheusService.contentType);
      res.end(metrics);
    } catch (err) {
      res.status(500).end((err as Error).message);
    }
  }
}
