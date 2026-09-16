import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { getLanguage } from '../utils/i18n'

export type AppErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'
  | 'INSUFFICIENT_BALANCE' | 'PENDING_WITHDRAWAL_EXISTS' | 'WITHDRAWAL_NOT_FOUND'
  | 'WITHDRAWAL_NOT_PENDING' | 'WALLET_LOCK_FAILED' | 'WALLET_RELEASE_FAILED'
  | 'WALLET_NOT_FOUND' | 'INVALID_AMOUNT' | 'TRANSACTION_CREATE_FAILED'
  | 'CLOUDINARY_UPLOAD_FAILED' | 'INTERNAL_SERVER_ERROR'

const EN: Record<string, string> = {
  VALIDATION_ERROR: 'Validation failed', UNAUTHORIZED: 'Authentication is required',
  FORBIDDEN: 'You do not have permission to perform this action', NOT_FOUND: 'Resource not found',
  CONFLICT: 'Conflict', INSUFFICIENT_BALANCE: 'Insufficient balance for this withdrawal',
  PENDING_WITHDRAWAL_EXISTS: 'There is already a pending withdrawal request',
  WITHDRAWAL_NOT_FOUND: 'Withdrawal request not found', WITHDRAWAL_NOT_PENDING: 'Withdrawal request is no longer pending',
  WALLET_LOCK_FAILED: 'Failed to reserve the wallet balance', WALLET_RELEASE_FAILED: 'Failed to release the pending wallet balance',
  WALLET_NOT_FOUND: 'Wallet not found', INVALID_AMOUNT: 'Amount must be greater than zero',
  TRANSACTION_CREATE_FAILED: 'Failed to create the financial transaction',
  CLOUDINARY_UPLOAD_FAILED: 'Failed to upload the screenshot', INTERNAL_SERVER_ERROR: 'Internal server error',
}

export class AppError extends Error {
  constructor(public readonly code: AppErrorCode | string, message: string, public readonly statusCode: ContentfulStatusCode = 500) {
    super(message); this.name = 'AppError'
  }
}

export function errorHandler(error: Error, c: Context) {
  console.error('API ERROR:', error)
  const lang = getLanguage(c)
  if (error instanceof AppError) {
    return c.json({ success: false, error: { code: error.code, message: lang === 'en' ? (EN[error.code] || error.message) : error.message } }, error.statusCode)
  }
  if (error instanceof HTTPException) {
    return c.json({ success: false, error: { code: error.status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'HTTP_ERROR', message: lang === 'en' ? (error.status >= 500 ? EN.INTERNAL_SERVER_ERROR : 'Request failed') : error.message } }, error.status)
  }
  return c.json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: lang === 'en' ? EN.INTERNAL_SERVER_ERROR : 'حدث خطأ داخلي في الخادم' } }, 500)
}
