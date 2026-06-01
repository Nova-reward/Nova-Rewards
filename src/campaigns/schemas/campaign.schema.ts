import { z } from 'zod';

export const CampaignStatus = z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']);

export const CreateCampaignSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must not exceed 5000 characters'),
  merchantId: z.string().uuid('Invalid merchant ID format'),
  rewardAmount: z.string()
    .regex(/^\d+(\.\d{1,7})?$/, 'Invalid reward amount format'),
  totalBudget: z.string()
    .regex(/^\d+(\.\d{1,7})?$/, 'Invalid budget format'),
  startDate: z.string().datetime('Invalid start date format'),
  endDate: z.string().datetime('Invalid end date format'),
  maxClaims: z.number().int().positive().optional(),
}).refine((data) => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const UpdateCampaignSchema = CreateCampaignSchema.partial().extend({
  status: CampaignStatus.optional(),
}).omit({ merchantId: true });

export const QueryCampaignsSchema = z.object({
  status: CampaignStatus.optional(),
  merchantId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20).optional(),
});

export const CampaignIdParamSchema = z.object({
  id: z.string().uuid('Invalid campaign ID format'),
});

export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;
export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;
export type QueryCampaignsDto = z.infer<typeof QueryCampaignsSchema>;
