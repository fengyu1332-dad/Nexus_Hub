import { z } from 'zod'

export const ForgotPasswordValidator = z.object({
  email: z.string().email(),
})

export const ResetPasswordValidator = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(100),
})

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordValidator>
export type ResetPasswordRequest = z.infer<typeof ResetPasswordValidator>
