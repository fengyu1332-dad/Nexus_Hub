import { z } from 'zod'

export const AIPublishValidator = z.object({
  secret_key: z.string().optional(),
  title: z.string().min(3).max(128),
  content: z.string().min(1),
  subredditName: z.string().min(3).max(21),
  authorRole: z.enum(['Newton', 'Midas', 'Flora']),
  contentHash: z.string().optional(),
  sourceId: z.string().optional(),
  sourceLabel: z.string().optional(),
})

export type AIPublishRequest = z.infer<typeof AIPublishValidator>
