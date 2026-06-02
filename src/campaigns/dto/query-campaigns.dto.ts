import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryCampaignsDto {
  @IsOptional()
  @IsString()
  @IsIn(['draft', 'active', 'paused', 'completed', 'cancelled'])
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class CampaignsQueryResult {
  data: CampaignResponseDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
