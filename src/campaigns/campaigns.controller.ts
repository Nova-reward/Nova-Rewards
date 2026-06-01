import { Controller, Get, Query, Param, UseGuards, BadRequestException, ValidationPipe } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { QueryCampaignsDto } from './dto/query-campaigns.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('campaigns')
@Controller('api/campaigns')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all campaigns with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Returns paginated campaigns' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'active', 'paused', 'completed', 'cancelled'] })
  @ApiQuery({ name: 'merchantId', required: false, type: 'string' })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: 'number', example: 20 })
  async findAll(@Query(new ValidationPipe({ transform: true })) query: QueryCampaignsDto) {
    try {
      return await this.campaignsService.findAll(query);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Invalid query parameters');
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single campaign by ID' })
  @ApiResponse({ status: 200, description: 'Returns the campaign' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string) {
    return await this.campaignsService.findOne(id);
  }

  @Get('merchant/:merchantId')
  @ApiOperation({ summary: 'Get campaigns by merchant ID' })
  @ApiResponse({ status: 200, description: 'Returns merchant campaigns' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findByMerchant(
    @Param('merchantId') merchantId: string,
    @Query(new ValidationPipe({ transform: true })) query: QueryCampaignsDto,
  ) {
    return await this.campaignsService.findByMerchant(merchantId, query);
  }
}
