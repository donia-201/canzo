import { z } from 'zod'

const addBasketSchema = z.object({
  content_type: z.enum(['Plastic', 'Canz'], { message: 'CONTENT_TYPE_INVALID' }),
  content_weight: z.number({ message: 'WEIGHT_NUMBER' })
    .positive('WEIGHT_POSITIVE')
    .max(15, 'WEIGHT_MAX'),
  amount: z.number({ message: 'QUANTITY_NUMBER' })
    .positive('QUANTITY_POSITIVE')
    .int('QUANTITY_INTEGER')
    .max(100, 'QUANTITY_MAX'),
})

const arrayBasketsSchema = z.array(addBasketSchema)

const updateProfileSchema = z.object({
  username: z.string().min(3, 'USERNAME_MIN').max(50, 'USERNAME_MAX').optional(),
  email: z.string().email('EMAIL_INVALID').max(300, 'EMAIL_MAX').optional(),
  phoneNumber: z.string().regex(/^01[0125][0-9]{8}$/, 'PHONE_INVALID').optional(),
  address: z.string().min(10, 'ADDRESS_SHORT').max(255, 'ADDRESS_LONG').optional(),
  activityType: z.enum(['Wedding hall', 'Restaurant', 'Cafe', 'Club', 'Other'], { message: 'ACTIVITY_TYPE_INVALID' }).optional(),
  activityName: z.string().min(1, 'ACTIVITY_NAME_REQUIRED').max(50, 'ACTIVITY_NAME_LONG').optional(),
       
})

const passwordSchema = z
    .object({
oldPassword: z.string().min(8, 'PASSWORD_MIN'),
  newPassword: z.string()
    .min(1, 'PASSWORD_REQUIRED')
    .min(8, 'PASSWORD_MIN')
    .max(72, 'PASSWORD_MAX')
    .regex(/[A-Z]/, 'PASSWORD_UPPER')
    .regex(/[a-z]/, 'PASSWORD_LOWER')
    .regex(/[0-9]/, 'PASSWORD_NUMBER'),
  confirmPassword: z.string().min(1, 'CONFIRM_PASSWORD_REQUIRED'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'PASSWORD_MISMATCH',
  path: ['confirmPassword'],
    })

export { arrayBasketsSchema, updateProfileSchema, passwordSchema }