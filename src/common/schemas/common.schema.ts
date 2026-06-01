import { z } from 'zod';

export const PaginationSchema = z.object({
  page: z.coerce.number()
    .int()
    .positive()
    .default(1)
    .optional(),
  pageSize: z.coerce.number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .optional(),
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

export const IdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});
