import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { getLanguage, messageForLanguage } from '../utils/i18n'

export type AppErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'AUTHENTICATION_ERROR' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'
  | 'INSUFFICIENT_BALANCE' | 'PENDING_WITHDRAWAL_EXISTS' | 'WITHDRAWAL_NOT_FOUND'
  | 'WITHDRAWAL_NOT_PENDING' | 'WALLET_LOCK_FAILED' | 'WALLET_RELEASE_FAILED'
  | 'WALLET_NOT_FOUND' | 'INVALID_AMOUNT' | 'TRANSACTION_CREATE_FAILED'
  | 'CLOUDINARY_UPLOAD_FAILED' | 'INTERNAL_SERVER_ERROR' | string

export class AppError extends Error {
  constructor(public readonly code: AppErrorCode, message: string, public readonly statusCode: ContentfulStatusCode = 500) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(error: Error, c: Context) {
  console.error('API ERROR:', error)
  const lang = getLanguage(c)

  if (error instanceof AppError) {
    return c.json({
      success: false,
      error: {
        code: error.code,
        message: messageForLanguage(error.code, lang, error.message),
      },
    }, error.statusCode)
  }

  if (error instanceof HTTPException) {
    const code = error.status >= 500 ? 'INTERNAL_SERVER_ERROR' : error.status === 401 ? 'UNAUTHORIZED' : error.status === 403 ? 'FORBIDDEN' : error.status === 404 ? 'NOT_FOUND' : error.status === 409 ? 'CONFLICT' : 'REQUEST_FAILED'
    return c.json({
      success: false,
      error: { code, message: messageForLanguage(code, lang, error.message) },
    }, error.status)
  }

  return c.json({
    success: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message: messageForLanguage('INTERNAL_SERVER_ERROR', lang) },
  }, 500)
}
