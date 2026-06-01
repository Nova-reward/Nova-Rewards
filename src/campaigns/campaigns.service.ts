import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, Between } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { QueryCampaignsDto, CampaignsQueryResult } from './dto/query-campaigns.dto';
import { CampaignResponseDto } from './dto/campaign-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignRepository: Repository<Campaign>,
  ) {}

  async findAll(query: QueryCampaignsDto): Promise<CampaignsQueryResult> {
    const { status, merchantId, page = 1, pageSize = 20 } = query;
    
    // Build where clause
    const where: FindOptionsWhere<Campaign> = {};
    
    if (status) {
      where.status = status;
    }
    
    if (merchantId) {
      where.merchantId = merchantId;
    }
    
    // Calculate skip for pagination
    const skip = (page - 1) * pageSize;
    
    // Execute query with pagination
    const [data, total] = await this.campaignRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
      relations: ['merchant'],
    });
    
    // Transform to response DTO
    const transformedData = data.map(campaign => 
      plainToInstance(CampaignResponseDto, campaign, { excludeExtraneousValues: true })
    );
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pageSize);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;
    
    return {
      data: transformedData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    };
  }

  async findOne(id: string): Promise<CampaignResponseDto> {
    const campaign = await this.campaignRepository.findOne({
      where: { id },
      relations: ['merchant'],
    });
    
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }
    
    return plainToInstance(CampaignResponseDto, campaign, { excludeExtraneousValues: true });
  }

  async findByMerchant(merchantId: string, query: QueryCampaignsDto): Promise<CampaignsQueryResult> {
    return this.findAll({ ...query, merchantId });
  }
}
