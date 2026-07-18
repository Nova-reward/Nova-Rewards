import { Controller, Post, Get, Body, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsUrl, IsOptional, IsNumber } from 'class-validator';

class RegisterWebhookDto {
  @IsUrl()
  url: string;
}

class GetDeliveriesDto {
  @IsOptional()
  @IsNumber()
  limit?: number;
}

@ApiTags('webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new webhook URL' })
  @ApiResponse({
    status: 201,
    description: 'Webhook registered successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid URL or too many webhooks',
  })
  async registerWebhook(
    @Request() req: any,
    @Body() body: RegisterWebhookDto,
  ) {
    const merchantId = req.user.merchantId;
    const webhook = await this.webhookService.registerWebhook(
      merchantId,
      body.url,
    );

    return {
      success: true,
      message: 'Webhook registered successfully',
      webhook: {
        id: webhook.id,
        url: webhook.url,
        secret: webhook.secret,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
      },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all webhooks for merchant' })
  @ApiResponse({
    status: 200,
    description: 'Webhooks retrieved successfully',
  })
  async getWebhooks(@Request() req: any) {
    const merchantId = req.user.merchantId;
    const webhooks = await this.webhookService.getMerchantWebhooks(merchantId);

    return {
      success: true,
      webhooks,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiResponse({
    status: 200,
    description: 'Webhook deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook not found',
  })
  async deleteWebhook(
    @Param('id') webhookId: string,
    @Request() req: any,
  ) {
    const merchantId = req.user.merchantId;
    await this.webhookService.deleteWebhook(webhookId, merchantId);

    return {
      success: true,
      message: 'Webhook deleted successfully',
    };
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get delivery history for a webhook' })
  @ApiResponse({
    status: 200,
    description: 'Delivery history retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook not found',
  })
  async getDeliveryHistory(
    @Param('id') webhookId: string,
    @Request() req: any,
    @Query() query: GetDeliveriesDto,
  ) {
    const merchantId = req.user.merchantId;
    const limit = query.limit || 50;
    const deliveries = await this.webhookService.getDeliveryHistory(
      webhookId,
      merchantId,
      limit,
    );

    return {
      success: true,
      deliveries,
      count: deliveries.length,
    };
  }
}
