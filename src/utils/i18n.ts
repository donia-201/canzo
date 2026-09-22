import type { Context } from 'hono'
import type { ZodError } from 'zod'

export type Language = 'ar' | 'en'

export function getLanguage(c: Context): Language {
  const lang = (c.req.query('lang') || 'ar').toLowerCase()
  return lang === 'en' ? 'en' : 'ar'
}

export function localized(c: Context, ar: string, en: string) {
  return getLanguage(c) === 'en' ? en : ar
}

export const activityTypeLabels: Record<string, { ar: string; en: string }> = {
  'Wedding hall': { ar: 'قاعة أفراح', en: 'Wedding hall' },
  Restaurant: { ar: 'مطعم', en: 'Restaurant' },
  Cafe: { ar: 'مقهى', en: 'Cafe' },
  Club: { ar: 'نادي', en: 'Club' },
  Other: { ar: 'أخرى', en: 'Other' },
}

export const walletTypeLabels: Record<string, { ar: string; en: string }> = {
  'Vodafone Cash': { ar: 'فودافون كاش', en: 'Vodafone Cash' },
  'Orange Cash': { ar: 'أورنج كاش', en: 'Orange Cash' },
  'Etisalat Cash': { ar: 'اتصالات كاش', en: 'Etisalat Cash' },
  InstaPay: { ar: 'إنستا باي', en: 'InstaPay' },
}

export const statusLabels: Record<string, { ar: string; en: string }> = {
  Pending: { ar: 'قيد المراجعة', en: 'Pending' },
  Approved: { ar: 'تمت الموافقة', en: 'Approved' },
  Rejected: { ar: 'مرفوض', en: 'Rejected' },
  Completed: { ar: 'مكتمل', en: 'Completed' },
  Cancelled: { ar: 'ملغي', en: 'Cancelled' },
}

export function label(
  map: Record<string, { ar: string; en: string }>,
  value: string | null | undefined,
  lang: Language,
) {
  if (!value) return value
  return map[value]?.[lang] ?? value
}


export const errorMessages: Record<string, { ar: string; en: string }> = {
  VALIDATION_ERROR: { ar: 'البيانات المرسلة غير صحيحة', en: 'Validation failed' },
  UNAUTHORIZED: { ar: 'يجب تسجيل الدخول أولاً', en: 'Authentication is required' },
  AUTHENTICATION_ERROR: { ar: 'بيانات تسجيل الدخول غير موجودة', en: 'Authentication data is missing' },
  FORBIDDEN: { ar: 'ليس لديك صلاحية لتنفيذ هذا الإجراء', en: 'You do not have permission to perform this action' },
  NOT_FOUND: { ar: 'العنصر المطلوب غير موجود', en: 'Resource not found' },
  CONFLICT: { ar: 'يوجد تعارض في الطلب', en: 'Conflict' },
  USER_ALREADY_EXISTS: { ar: 'المستخدم موجود بالفعل', en: 'User already exists' },
  INVALID_CREDENTIALS: { ar: 'بيانات الدخول غير صحيحة', en: 'Invalid credentials' },
  USER_NOT_FOUND: { ar: 'المستخدم غير موجود', en: 'User not found' },
  INVALID_OTP: { ar: 'رمز التحقق غير صحيح', en: 'Invalid OTP' },
  INVALID_RESET_TOKEN: { ar: 'رمز إعادة التعيين غير صالح', en: 'Invalid reset token' },
  INVALID_GOOGLE_TOKEN: { ar: 'رمز Google غير صالح', en: 'Invalid Google token' },
  GOOGLE_TOKEN_WRONG_AUDIENCE: { ar: 'رمز Google غير مخصص لهذا التطبيق', en: 'Google token is not intended for this app' },
  CLIENT_NOT_FOUND: { ar: 'العميل غير موجود', en: 'Client not found' },
  WATER_WEDDING_HALL_ONLY: { ar: 'المياه متاحة حالياً لقاعات الأفراح فقط', en: 'Water is currently available for wedding halls only' },
  BASKET_NOT_FOUND_OR_FULL_UPDATE_FAILED: { ar: 'فشل في تغيير حالة السلة إلى ممتلئة أو السلة غير موجودة', en: 'Failed to fill the basket or the basket was not found' },
  BASKET_FULL_CANNOT_DELETE: { ar: 'لا يمكن حذف سلة ممتلئة', en: 'A full basket cannot be deleted' },
  BASKET_NOT_FOUND: { ar: 'السلة غير موجودة', en: 'Basket not found' },
  INVALID_KEY: { ar: 'المعرّف غير صالح', en: 'Invalid key' },
  FCM_TOKEN_NOT_FOUND: { ar: 'المستخدم ليس لديه FCM Token', en: 'User does not have an FCM Token' },
  INVALID_ORDER_STATUS: { ar: 'حالة الطلب غير صحيحة', en: 'Invalid order status' },
  INVALID_WITHDRAWAL_STATUS: { ar: 'حالة طلب السحب غير صحيحة', en: 'Invalid withdrawal status' },
  INVALID_WITHDRAWAL_ID: { ar: 'معرّف طلب السحب غير صالح', en: 'Invalid withdrawal id' },
  PAYMENT_SCREENSHOT_REQUIRED: { ar: 'صورة إثبات الدفع مطلوبة عند الموافقة على طلب السحب. استخدم الحقل screenshot.', en: 'Payment screenshot is required when approving a withdrawal. Use the screenshot field.' },
  IMAGE_TOO_LARGE: { ar: 'حجم الصورة أكبر من 2 ميجابايت', en: 'Image size must not exceed 2 MB' },
  INVALID_IMAGE_TYPE: { ar: 'نوع الصورة غير صالح. المسموح: png, jpg, jpeg, webp', en: 'Invalid image type. Allowed: png, jpg, jpeg, webp' },
  PROFILE_FIELD_REQUIRED: { ar: 'يجب إرسال حقل واحد على الأقل لتعديل الملف الشخصي', en: 'At least one field must be provided to update profile' },
  PROFILE_ALREADY_SETUP: { ar: 'تم إعداد الملف الشخصي من قبل', en: 'The profile has already been set up' },
  PROFILE_SETUP_SUCCESS: { ar: 'تم إعداد الملف الشخصي بنجاح', en: 'Profile setup completed successfully' },
  PHONE_ALREADY_EXISTS: { ar: 'رقم الهاتف مسجل بالفعل', en: 'Phone number is already registered' },
  EMAIL_ALREADY_EXISTS: { ar: 'البريد الإلكتروني مستخدم بالفعل', en: 'Email is already in use' },
  INVALID_PASSWORD: { ar: 'كلمة المرور غير صحيحة', en: 'Incorrect password' },
  CLIENT_ALREADY_EXISTS: { ar: 'العميل موجود بالفعل', en: 'Client already exists' },
  DEVICE_TOKEN_REQUIRED: { ar: 'FCM Token مطلوب', en: 'FCM Token is required' },
  UNAUTHORIZED_USER: { ar: 'المستخدم غير مصرح له', en: 'User is not authorized' },
  INTERNAL_SERVER_ERROR: { ar: 'حدث خطأ داخلي في الخادم', en: 'Internal server error' },
  REQUEST_FAILED: { ar: 'فشل تنفيذ الطلب', en: 'Request failed' },

  INSUFFICIENT_BALANCE: { ar: 'الرصيد غير كافٍ للسحب', en: 'Insufficient balance for this withdrawal' },
  PENDING_WITHDRAWAL_EXISTS: { ar: 'يوجد طلب سحب قيد المراجعة بالفعل', en: 'There is already a pending withdrawal request' },
  WITHDRAWAL_NOT_FOUND: { ar: 'طلب السحب غير موجود', en: 'Withdrawal request not found' },
  WITHDRAWAL_NOT_PENDING: { ar: 'طلب السحب لم يعد قيد المراجعة', en: 'Withdrawal request is no longer pending' },
  WALLET_LOCK_FAILED: { ar: 'فشل حجز رصيد المحفظة', en: 'Failed to reserve the wallet balance' },
  WALLET_RELEASE_FAILED: { ar: 'فشل تحرير الرصيد المعلّق', en: 'Failed to release the pending wallet balance' },
  WALLET_NOT_FOUND: { ar: 'المحفظة غير موجودة', en: 'Wallet not found' },
  INVALID_AMOUNT: { ar: 'المبلغ يجب أن يكون أكبر من الصفر', en: 'Amount must be greater than zero' },
  AMOUNT_MAX: { ar: 'المبلغ تجاوز الحد المسموح به', en: 'Amount exceeds the allowed limit' },
  TRANSACTION_CREATE_FAILED: { ar: 'فشل إنشاء العملية المالية', en: 'Failed to create the financial transaction' },
  CLOUDINARY_UPLOAD_FAILED: { ar: 'فشل رفع صورة إثبات الدفع', en: 'Failed to upload the payment screenshot' },

  USERNAME_REQUIRED: { ar: 'اسم المستخدم مطلوب', en: 'Username is required' },
  USERNAME_MIN: { ar: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل', en: 'Username must be at least 3 characters' },
  USERNAME_MAX: { ar: 'اسم المستخدم لا يجب أن يزيد عن 50 حرف', en: 'Username must not exceed 50 characters' },
  PASSWORD_REQUIRED: { ar: 'كلمة المرور مطلوبة', en: 'Password is required' },
  PASSWORD_MIN: { ar: 'يجب أن تكون كلمة المرور 8 أحرف على الأقل', en: 'Password must be at least 8 characters' },
  PASSWORD_MAX: { ar: 'كلمة المرور لا يجب أن تتجاوز 72 حرفاً', en: 'Password must not exceed 72 characters' },
  PASSWORD_UPPER: { ar: 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل', en: 'Password must contain at least one uppercase letter' },
  PASSWORD_LOWER: { ar: 'كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل', en: 'Password must contain at least one lowercase letter' },
  PASSWORD_NUMBER: { ar: 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل', en: 'Password must contain at least one number' },
  CONFIRM_PASSWORD_REQUIRED: { ar: 'تأكيد كلمة المرور مطلوب', en: 'Password confirmation is required' },
  PASSWORD_MISMATCH: { ar: 'كلمتا المرور غير متطابقتين', en: 'Passwords do not match' },
  EMAIL_INVALID: { ar: 'البريد الإلكتروني غير صالح', en: 'Invalid email address' },
  EMAIL_MAX: { ar: 'البريد الإلكتروني طويل جداً', en: 'Email is too long' },
  PHONE_REQUIRED: { ar: 'رقم الهاتف مطلوب', en: 'Phone number is required' },
  PHONE_INVALID: { ar: 'رقم الهاتف غير صالح', en: 'Invalid phone number' },
  ADDRESS_REQUIRED: { ar: 'العنوان مطلوب', en: 'Address is required' },
  ADDRESS_SHORT: { ar: 'العنوان قصير جداً', en: 'Address is too short' },
  ADDRESS_LONG: { ar: 'العنوان طويل جداً', en: 'Address is too long' },
  ACTIVITY_TYPE_INVALID: { ar: 'نوع النشاط غير صالح', en: 'Invalid activity type' },
  ACTIVITY_NAME_REQUIRED: { ar: 'اسم النشاط مطلوب', en: 'Activity name is required' },
  ACTIVITY_NAME_LONG: { ar: 'اسم النشاط طويل جداً', en: 'Activity name is too long' },
  IDENTIFIER_REQUIRED: { ar: 'معرّف الدخول مطلوب', en: 'Login identifier is required' },
  OTP_REQUIRED: { ar: 'كود التحقق مطلوب', en: 'OTP is required' },
  OTP_LENGTH: { ar: 'كود التحقق يجب أن يتكون من 6 أرقام', en: 'OTP must be 6 digits' },
  RESET_TOKEN_INVALID: { ar: 'رمز إعادة التعيين غير صالح', en: 'Reset token is invalid' },
  GOOGLE_ID_TOKEN_REQUIRED: { ar: 'معرّف Google ID Token مطلوب', en: 'Google ID Token is required' },
  CONTENT_TYPE_INVALID: { ar: 'نوع المحتوى يجب أن يكون Plastic أو Canz', en: 'Content type must be Plastic or Canz' },
  WEIGHT_NUMBER: { ar: 'الوزن يجب أن يكون رقماً', en: 'Weight must be a number' },
  WEIGHT_POSITIVE: { ar: 'الوزن يجب أن يكون رقماً موجباً', en: 'Weight must be positive' },
  WEIGHT_MAX: { ar: 'الوزن الأقصى المسموح به هو 15', en: 'Maximum allowed weight is 15' },
  QUANTITY_NUMBER: { ar: 'الكمية يجب أن تكون رقماً', en: 'Quantity must be a number' },
  QUANTITY_POSITIVE: { ar: 'الكمية يجب أن تكون رقماً موجباً', en: 'Quantity must be positive' },
  QUANTITY_INTEGER: { ar: 'الكمية يجب أن تكون رقماً صحيحاً', en: 'Quantity must be an integer' },
  QUANTITY_MAX: { ar: 'الكمية لا يجب أن تتجاوز 100 سلة في الطلب الواحد', en: 'Quantity must not exceed 100 baskets per request' },
  FCM_TOKEN_REQUIRED: { ar: 'FCM Token مطلوب', en: 'FCM Token is required' },
  WALLET_TYPE_INVALID: { ar: 'نوع المحفظة غير صالح', en: 'Invalid wallet type' },
  WALLET_NUMBER_REQUIRED: { ar: 'رقم المحفظة مطلوب', en: 'Wallet number is required' },
  WALLET_NUMBER_MIN: { ar: 'رقم المحفظة يجب أن يحتوي على 5 خانات على الأقل', en: 'Wallet number must contain at least 5 characters' },
  WALLET_NUMBER_MAX: { ar: 'رقم المحفظة يجب ألا يتجاوز 50 خانة', en: 'Wallet number must not exceed 50 characters' },
}

export function messageForLanguage(code: string, lang: Language, fallback?: string) {
  return errorMessages[code]?.[lang] ?? fallback ?? code
}

export function localizedError(c: Context, code: string, fallback?: string) {
  return messageForLanguage(code, getLanguage(c), fallback)
}

export function validationMessage(error: ZodError, lang: Language) {
  const issue = error.issues[0]
  return messageForLanguage(issue?.message || 'VALIDATION_ERROR', lang, issue?.message)
}

export function notificationText(
  kind: 'withdrawal_admin' | 'withdrawal_approved' | 'withdrawal_rejected',
  withdrawalId: number,
  lang: Language,
  details?: { name?: string; amount?: number; walletType?: string; walletNumber?: string }
) {
  const id = `#${withdrawalId}`

  if (kind === 'withdrawal_approved') {
    return lang === 'en'
      ? `Withdrawal request ${id}\nStatus: Approved`
      : `طلب السحب ${id}\nالحالة: تمت الموافقة`
  }

  if (kind === 'withdrawal_rejected') {
    return lang === 'en'
      ? `Withdrawal request ${id}\nStatus: Rejected`
      : `طلب السحب ${id}\nالحالة: مرفوض`
  }

  const name = details?.name || (lang === 'en' ? 'Client' : 'العميل')
  const amount = details?.amount ?? 0
  const walletType = label(walletTypeLabels, details?.walletType, lang) || (lang === 'en' ? 'Unknown' : 'غير معروف')
  const walletNumber = details?.walletNumber || (lang === 'en' ? 'Not provided' : 'غير متوفر')

  return lang === 'en'
    ? `New withdrawal request ${id}\nClient: ${name}\nAmount: ${amount} EGP\nWallet type: ${walletType}\nWallet number: ${walletNumber}`
    : `طلب سحب جديد ${id}\nالعميل: ${name}\nالمبلغ: ${amount} جنيه\nنوع المحفظة: ${walletType}\nرقم المحفظة: ${walletNumber}`
}
