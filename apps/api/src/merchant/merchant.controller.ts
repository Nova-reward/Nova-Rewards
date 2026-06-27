import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MerchantService } from './merchant.service';

@ApiTags('merchant')
@Controller('merchant')
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiBearerAuth('JWT-auth')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post('campaigns')
  @Roles('merchant', 'admin')
  @ApiOperation({ summary: 'Create a new campaign (Merchant only)' })
  @ApiResponse({
    status: 201,
    description: 'Campaign created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient role',
  })
  async createCampaign(@Body() campaignData: any) {
    return this.merchantService.createCampaign(campaignData);
  }

  @Get('campaigns')
  @Roles('merchant', 'admin')
  @ApiOperation({ summary: 'Get merchant campaigns' })
  @ApiResponse({
    status: 200,
    description: 'Campaigns retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient role',
  })
  async getCampaigns() {
    return this.merchantService.getCampaigns();
  }

  @Post('distribute')
  @Roles('merchant', 'admin')
  @ApiOperation({ summary: 'Distribute rewards (Merchant only)' })
  @ApiResponse({
    status: 200,
    description: 'Distribution successful',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient role',
  })
  async distributeRewards(@Body() distributionData: any) {
    return this.merchantService.distributeRewards(distributionData);
  }
}
