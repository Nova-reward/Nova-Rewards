import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from './webhook.entity';
import { WebhookDelivery } from './webhook-delivery.entity';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private deliveryRepository: Repository<WebhookDelivery>,
  ) {}

  /**
   * Register a new webhook URL for a merchant
   */
  async registerWebhook(
    merchantId: string,
    url: string,
  ): Promise<Webhook> {
    // Check if merchant already has 5 webhooks
    const existingWebhooks = await this.webhookRepository.count({
      where: { merchantId, isActive: true },
    });

    if (existingWebhooks >= 5) {
      throw new BadRequestException(
        'Maximum of 5 webhook URLs allowed per merchant',
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL format');
    }

    // Generate a unique secret for this webhook
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = this.webhookRepository.create({
      merchantId,
      url,
      secret,
      isActive: true,
    });

    return this.webhookRepository.save(webhook);
  }

  /**
   * Get all webhooks for a merchant
   */
  async getMerchantWebhooks(merchantId: string): Promise<Webhook[]> {
    return this.webhookRepository.find({
      where: { merchantId, isActive: true },
    });
  }

  /**
   * Delete a webhook (soft delete by setting isActive: false)
   */
  async deleteWebhook(webhookId: string, merchantId: string): Promise<void> {
    const webhook = await this.webhookRepository.findOne({
      where: { id: webhookId, merchantId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    webhook.isActive = false;
    await this.webhookRepository.save(webhook);
  }

  /**
   * Deliver an event to all active webhooks for a merchant
   */
  async deliverEvent(
    merchantId: string,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const webhooks = await this.webhookRepository.find({
      where: { merchantId, isActive: true },
    });

    if (webhooks.length === 0) {
      this.logger.debug(`No active webhooks for merchant ${merchantId}`);
      return;
    }

    const deliveryPromises = webhooks.map((webhook) =>
      this.sendWebhook(webhook, eventType, payload),
    );

    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Send a webhook with retry logic
   */
  private async sendWebhook(
    webhook: Webhook,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const startTime = Date.now();
    let attemptCount = 0;
    let success = false;
    let lastError: Error | null = null;

    // Retry up to 5 times with exponential backoff
    while (attemptCount < 5 && !success) {
      attemptCount++;
      try {
        const delivery = await this.sendSingleWebhook(
          webhook,
          eventType,
          payload,
          attemptCount,
        );
        success = delivery.success;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        this.logger.error(
          `Webhook delivery failed for ${webhook.url} (attempt ${attemptCount}/5): ${error.message}`,
        );

        // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s, 8s, 16s)
        if (attemptCount < 5) {
          const backoffMs = Math.pow(2, attemptCount) * 1000;
          await this.sleep(backoffMs);
        }
      }
    }

    // Update webhook with last delivery info
    await this.webhookRepository.update(webhook.id, {
      lastDeliveryAt: new Date(),
      lastDeliveryStatus: success ? 200 : 500,
      failureCount: success ? 0 : webhook.failureCount + 1,
    });

    if (!success) {
      this.logger.error(
        `Webhook ${webhook.url} failed after 5 attempts: ${lastError?.message}`,
      );
    }
  }

  /**
   * Send a single webhook delivery
   */
  private async sendSingleWebhook(
    webhook: Webhook,
    eventType: string,
    payload: Record<string, any>,
    attemptNumber: number,
  ): Promise<WebhookDelivery> {
    const startTime = Date.now();

    // Create the payload to send
    const deliveryPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    // Sign the payload
    const signature = this.signPayload(
      JSON.stringify(deliveryPayload),
      webhook.secret,
    );

    try {
      const response = await axios.post(webhook.url, deliveryPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Id': webhook.id,
          'X-Webhook-Attempt': attemptNumber,
        },
        timeout: 10000, // 10 second timeout
      });

      const responseTimeMs = Date.now() - startTime;

      // Log successful delivery
      const delivery = await this.deliveryRepository.create({
        webhookId: webhook.id,
        eventType,
        payload,
        responseStatus: response.status,
        responseBody: JSON.stringify(response.data),
        responseTimeMs,
        attemptCount: attemptNumber,
        success: true,
      });

      await this.deliveryRepository.save(delivery);
      this.logger.debug(`Webhook delivered to ${webhook.url} in ${responseTimeMs}ms`);

      return delivery;
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;

      // Log failed delivery
      const delivery = await this.deliveryRepository.create({
        webhookId: webhook.id,
        eventType,
        payload,
        responseStatus: error.response?.status || 500,
        responseBody: error.response?.data || error.message,
        responseTimeMs,
        attemptCount: attemptNumber,
        success: false,
        errorMessage: error.message,
      });

      await this.deliveryRepository.save(delivery);
      throw error;
    }
  }

  /**
   * Sign payload with HMAC-SHA256
   */
  private signPayload(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveryHistory(
    webhookId: string,
    merchantId: string,
    limit: number = 50,
  ): Promise<WebhookDelivery[]> {
    // Verify webhook belongs to merchant
    const webhook = await this.webhookRepository.findOne({
      where: { id: webhookId, merchantId },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return this.deliveryRepository.find({
      where: { webhookId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Helper function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
