import type { Context } from 'hono'

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

export function label(map: Record<string, { ar: string; en: string }>, value: string | null | undefined, lang: Language) {
  if (!value) return value
  return map[value]?.[lang] ?? value
}

export function notificationText(
  kind: 'withdrawal_admin' | 'withdrawal_approved' | 'withdrawal_rejected',
  withdrawalId: number,
  lang: Language,
  details?: { name?: string; amount?: number; walletType?: string; walletNumber?: string }
) {
  const id = `#${withdrawalId}`
  if (kind === 'withdrawal_approved') {
    return lang === 'en' ? `Withdrawal request ${id} has been approved` : `تمت الموافقة على عملية السحب رقم ${id}`
  }
  if (kind === 'withdrawal_rejected') {
    return lang === 'en' ? `Withdrawal request ${id} has been rejected` : `تم رفض عملية السحب رقم ${id}`
  }
  const name = details?.name || 'Client'
  const amount = details?.amount ?? 0
  const walletType = details?.walletType || ''
  const walletNumber = details?.walletNumber || ''
  return lang === 'en'
    ? `New withdrawal request ${id} from ${name}, amount ${amount} EGP, wallet type ${walletType}, wallet number ${walletNumber}`
    : `طلب سحب جديد رقم ${id} من ${name} بمبلغ ${amount} جنيه، نوع المحفظة ${walletType}، رقم المحفظة ${walletNumber}`
}
