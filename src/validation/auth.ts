import { z } from 'zod'

const baseSchema = z.object({
  username: z.string()
    .min(1, 'USERNAME_REQUIRED')
    .min(3, 'USERNAME_MIN')
    .max(50, 'USERNAME_MAX'),
  password: z.string()
    .min(1, 'PASSWORD_REQUIRED')
    .min(8, 'PASSWORD_MIN')
    .max(72, 'PASSWORD_MAX')
    .regex(/[A-Z]/, 'PASSWORD_UPPER')
    .regex(/[a-z]/, 'PASSWORD_LOWER')
    .regex(/[0-9]/, 'PASSWORD_NUMBER'),
  confirmPassword: z.string().min(1, 'CONFIRM_PASSWORD_REQUIRED'),
  email: z.email('EMAIL_INVALID').max(300, 'EMAIL_MAX'),
  phoneNumber: z.string()
    .min(1, 'PHONE_REQUIRED')
    .regex(/^01[0125][0-9]{8}$/, 'PHONE_INVALID'),
})

const refinedBaseSchema = baseSchema.refine(
  (data) => data.password === data.confirmPassword,
  { message: 'PASSWORD_MISMATCH' }
)

const clientSignupSchema = refinedBaseSchema.extend({
  address: z.string()
    .min(1, 'ADDRESS_REQUIRED')
    .min(10, 'ADDRESS_SHORT')
    .max(255, 'ADDRESS_LONG'),
  activityType: z.enum(
    ['Wedding hall', 'Restaurant', 'Cafe', 'Club', 'Other'],
    { message: 'ACTIVITY_TYPE_INVALID' }
  ),
  activityName: z.string()
    .trim()
    .max(50, 'ACTIVITY_NAME_LONG')
    .min(1, 'ACTIVITY_NAME_REQUIRED'),
})

const loginSchema = z.object({
  identifier: z.string().min(1, 'IDENTIFIER_REQUIRED').max(300),
  password: z.string().min(1, 'PASSWORD_REQUIRED').max(72),
})

const deviceTokenSchema = z.object({
  device_token: z.string().min(1, 'FCM_TOKEN_REQUIRED'),
  language:z.enum(['ar','en']).default('en'),
})

const resetPasswordSchema = baseSchema
  .pick({ password: true, confirmPassword: true, email: true })
  .extend({ resetToken: z.uuid('RESET_TOKEN_INVALID') })
  .refine((data) => data.password === data.confirmPassword, { message: 'PASSWORD_MISMATCH' })

const enterEmailSchema = baseSchema.pick({ email: true })

const enterOtpSchema = baseSchema
  .pick({ email: true })
  .extend({
    otp: z.string().min(1, 'OTP_REQUIRED').length(6, 'OTP_LENGTH'),
  })

export {
  clientSignupSchema,
  loginSchema,
  resetPasswordSchema,
  enterEmailSchema,
  enterOtpSchema,
  deviceTokenSchema,
}





