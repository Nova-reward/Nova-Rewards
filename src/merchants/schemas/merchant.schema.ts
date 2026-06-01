import { z } from 'zod';

export const CreateMerchantSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email('Invalid email format'),
  walletAddress: z.string().regex(/^G[A-Z0-9]{55}$/, 'Invalid Stellar wallet address'),
  businessType: z.enum(['retail', 'ecommerce', 'restaurant', 'service', 'other']),
  website: z.string().url().optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
});

export const UpdateMerchantSchema = CreateMerchantSchema.partial();
