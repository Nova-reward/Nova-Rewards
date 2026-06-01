import { Expose, Transform } from 'class-transformer';

export class CampaignResponseDto {
  @Expose()
  id: string;

  @Expose()
  title: string;

  @Expose()
  description: string;

  @Expose()
  merchantId: string;

  @Expose()
  merchantName?: string;

  @Expose()
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

  @Expose()
  rewardAmount: string;

  @Expose()
  totalBudget: string;

  @Expose()
  remainingBudget: string;

  @Expose()
  startDate: Date;

  @Expose()
  endDate: Date;

  @Expose()
  maxClaims?: number;

  @Expose()
  totalClaims: number;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  @Transform(({ obj }) => obj.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  isNew?: boolean;

  @Expose()
  @Transform(({ obj }) => {
    const now = new Date();
    const end = new Date(obj.endDate);
    return end < now ? 'ended' : end < new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) ? 'ending-soon' : 'active';
  })
  statusDisplay?: string;
}
