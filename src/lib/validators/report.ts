import { z } from 'zod'

export const ReportValidator = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.string().min(1),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'misinformation', 'other']),
  description: z.string().max(500).optional(),
})

export type ReportRequest = z.infer<typeof ReportValidator>
