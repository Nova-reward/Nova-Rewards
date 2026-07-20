import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from './webhook.entity';
import { WebhookDelivery } from './webhook-delivery.entity';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Webhook, WebhookDelivery])],
  providers: [WebhookService],
  controllers: [WebhookController],
  exports: [WebhookService],
})
export class WebhookModule {}
