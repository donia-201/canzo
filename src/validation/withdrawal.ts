import { z } from 'zod'

export const walletTypeEnum = z.enum(
    ['Vodafone Cash', 'Orange Cash', 'Etisalat Cash', 'InstaPay'],
  { message: 'WALLET_TYPE_INVALID' }
)

const withdrawSchema = z.object({
     amount: z.number({ error: 'INVALID_AMOUNT' })
    .positive('INVALID_AMOUNT')
    .max(1_000_000, 'AMOUNT_MAX'),
  wallet_number: z.string({ error: 'WALLET_NUMBER_REQUIRED' })
    .min(5, 'WALLET_NUMBER_MIN')
    .max(50, 'WALLET_NUMBER_MAX'),
    wallet_type: walletTypeEnum,
})

const adminWithdrawStatusSchema = z.object({
    status: z.enum(['Approved', 'Rejected'], 
        { message: 'INVALID_WITHDRAWAL_STATUS' }),

})

export { withdrawSchema, adminWithdrawStatusSchema }
