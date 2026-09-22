import { z } from 'zod'

const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'GOOGLE_ID_TOKEN_REQUIRED'),
})

const setupProfileSchema = z.object({
  address: z.string().min(1, 'ADDRESS_REQUIRED').min(10, 'ADDRESS_SHORT').max(255, 'ADDRESS_LONG'),
  phoneNumber: z.string().min(1, 'PHONE_REQUIRED').regex(/^01[0125][0-9]{8}$/, 'PHONE_INVALID'),
  activityType: z.enum(['Wedding hall', 'Restaurant', 'Cafe', 'Club', 'Other'], { message: 'ACTIVITY_TYPE_INVALID' }),
  activityName: z.string().min(1, 'ACTIVITY_NAME_REQUIRED').max(50, 'ACTIVITY_NAME_LONG'),
})

export { googleLoginSchema, setupProfileSchema }