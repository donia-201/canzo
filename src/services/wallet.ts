import { AppError } from '../middlewares/errorHandler'
import { sendFirebasePush } from '../services/firebase'
import { notificationText } from '../utils/i18n'

export type WalletRow = { user_id: number; balance: number; pending_balance: number }
export type WithdrawalRow = {
  id: number; user_id: number; amount: number; status: 'Pending' | 'Approved' | 'Rejected'
  admin_id: number | null; screenshot_path: string | null; wallet_number: string | null; wallet_type: string | null
  created_at: string; updated_at: string
}

export class WalletServiceError extends AppError {
  constructor(code: 'INSUFFICIENT_BALANCE'|'PENDING_WITHDRAWAL_EXISTS'|'WITHDRAWAL_NOT_FOUND'|'WITHDRAWAL_NOT_PENDING'|'WALLET_LOCK_FAILED'|'WALLET_RELEASE_FAILED'|'WALLET_NOT_FOUND'|'INVALID_AMOUNT'|'TRANSACTION_CREATE_FAILED', message: string) {
    const statusMap: Record<string, 400|404|409|500> = {
      INSUFFICIENT_BALANCE:400, PENDING_WITHDRAWAL_EXISTS:409, WITHDRAWAL_NOT_FOUND:404, WITHDRAWAL_NOT_PENDING:409,
      WALLET_LOCK_FAILED:500, WALLET_RELEASE_FAILED:500, WALLET_NOT_FOUND:404, INVALID_AMOUNT:400, TRANSACTION_CREATE_FAILED:500,
    }
    super(code, message, statusMap[code]); this.name='WalletServiceError'
  }
}

export async function ensureWallet(db:D1Database,userId:number) {
  await db.prepare('INSERT OR IGNORE INTO wallets (user_id,balance,pending_balance) VALUES (?1,0,0)').bind(userId).run()
}
export async function getWallet(db:D1Database,userId:number):Promise<WalletRow> {
  await ensureWallet(db,userId)
  const wallet=await db.prepare('SELECT user_id,balance,pending_balance FROM wallets WHERE user_id=?1').bind(userId).first<WalletRow>()
  if(!wallet) throw new WalletServiceError('WALLET_NOT_FOUND','المحفظة غير موجودة')
  return wallet
}
export async function creditWallet(db:D1Database,userId:number,amount:number) {
  if(amount<=0) throw new WalletServiceError('INVALID_AMOUNT','المبلغ يجب أن يكون أكبر من الصفر')
  await ensureWallet(db,userId)
  const r=await db.prepare("UPDATE wallets SET balance=balance+?1,updated_at=datetime('now') WHERE user_id=?2").bind(amount,userId).run()
  if(r.meta.changes===0) throw new WalletServiceError('WALLET_LOCK_FAILED','فشل تحديث رصيد المحفظة')
}

export async function createWithdrawalRequest(db:D1Database,userId:number,amount:number,walletNumber:string,walletType:string, firebaseEnv:{
  FIREBASE_PROJECT_ID:string
  FIREBASE_CLIENT_EMAIL:string
  FIREBASE_PRIVATE_KEY:string
}):Promise<number> {
  if(amount<=0) throw new WalletServiceError('INVALID_AMOUNT','المبلغ يجب أن يكون أكبر من الصفر')
  await ensureWallet(db,userId)
  const pending=await db.prepare("SELECT id FROM withdrawal_requests WHERE user_id=?1 AND status='Pending' LIMIT 1").bind(userId).first<{id:number}>()
  if(pending) throw new WalletServiceError('PENDING_WITHDRAWAL_EXISTS','يوجد طلب سحب قيد المراجعة بالفعل')

  const client=await db.prepare('SELECT u.user_name, c.activity_name FROM users u LEFT JOIN clients c ON c.user_id=u.id WHERE u.id=?1').bind(userId).first<{user_name:string;activity_name:string|null}>()
  const requesterName=client?.activity_name || client?.user_name || `user ${userId}`

  // The financial reservation + request creation are one D1 transaction.
  // Notification is deliberately outside it: a notification failure must never undo money movement.
  const result=await db.batch([
    db.prepare("UPDATE wallets SET balance=balance-?1,pending_balance=pending_balance+?1,updated_at=datetime('now') WHERE user_id=?2 AND balance>=?1 AND NOT EXISTS (SELECT 1 FROM withdrawal_requests WHERE user_id=?2 AND status='Pending')").bind(amount,userId),
    db.prepare("INSERT INTO withdrawal_requests (user_id,amount,status,wallet_number,wallet_type) SELECT ?1,?2,'Pending',?3,?4 WHERE EXISTS (SELECT 1 FROM wallets WHERE user_id=?1 AND pending_balance>=?2) AND NOT EXISTS (SELECT 1 FROM withdrawal_requests WHERE user_id=?1 AND status='Pending')").bind(userId,amount,walletNumber,walletType),
  ])
  const walletUpdate=result[0]
  const insert=result[1]
  if(walletUpdate.meta.changes===0) {
    const pendingNow=await db.prepare("SELECT id FROM withdrawal_requests WHERE user_id=?1 AND status='Pending' LIMIT 1").bind(userId).first<{id:number}>()
    if(pendingNow) throw new WalletServiceError('PENDING_WITHDRAWAL_EXISTS','يوجد طلب سحب قيد المراجعة بالفعل')
    throw new WalletServiceError('INSUFFICIENT_BALANCE','الرصيد غير كافي للسحب')
  }
  if(insert.meta.changes===0) throw new WalletServiceError('WALLET_LOCK_FAILED','تم حجز الرصيد لكن تعذر إنشاء طلب السحب. حاول مرة أخرى')
  const withdrawalId=Number(insert.meta.last_row_id)
  if(!withdrawalId) throw new WalletServiceError('WALLET_LOCK_FAILED','فشل إنشاء طلب السحب')

 try {
    // CHANGE: Build the same notification content in both languages
    // using the existing centralized notificationText() helper.
    const messageAr = notificationText(
      'withdrawal_admin',
      withdrawalId,
      'ar',
      {
        name: requesterName,
        amount,
        walletType,
        walletNumber,
      }
    )

    const messageEn = notificationText(
      'withdrawal_admin',
      withdrawalId,
      'en',
      {
        name: requesterName,
        amount,
        walletType,
        walletNumber,
      }
    )

    // CHANGE: Store both Arabic and English versions in the database.
    // The GET notifications endpoint already chooses the correct language.
    await db.prepare(
     ` INSERT INTO notifications
        (recipient_id, recipient_type, message, message_en)
      SELECT
        id,
        'Admin',
        ?1,
        ?2
      FROM users
      WHERE user_role = 'Admin'`
    )
      .bind(messageAr, messageEn)
      .run()

    // CHANGE: Get each admin's FCM token and preferred language.
    // This allows every admin to receive the Push in their own language.
    const admins = await db.prepare(
     ` SELECT id, fcm_token, language
      FROM users
      WHERE user_role = 'Admin'
        AND fcm_token IS NOT NULL
        AND TRIM(fcm_token) != " `
    ).all<{
      id: number
      fcm_token: string
      language: 'ar' | 'en'
    }>()

    for (const admin of admins.results ?? []) {
      try {
        // CHANGE: Select the Push message according to the admin's language.
        const pushMessage =
          admin.language === 'en' ? messageEn : messageAr

        await sendFirebasePush(
          firebaseEnv,
          admin.fcm_token,
          'Canzo',
          pushMessage,
          {
            type: 'withdrawal',
            withdraw_id: String(withdrawalId),
          }
        )
      } catch (e) {
        // CHANGE: Push failure must not cancel the withdrawal operation.
        console.error(
          `ADMIN_WITHDRAWAL_PUSH_ERROR_${admin.id}:`,
          e
        )
      }
    }
  } catch (e) {
    // CHANGE: Notification failure must never rollback or break
    // the already-created withdrawal request.
    console.error(
      'WITHDRAWAL_NOTIFICATION_CREATE_ERROR:',
      e
    )
  } 
  return  withdrawalId
}

export async function approveWithdrawal(db:D1Database,withdrawalId:number,adminId:number,screenshotPath:string,firebaseEnv:{FIREBASE_PROJECT_ID:string;FIREBASE_CLIENT_EMAIL:string;FIREBASE_PRIVATE_KEY:string}):Promise<void> {
  if(!screenshotPath) throw new AppError('VALIDATION_ERROR','يجب رفع صورة إثبات الدفع قبل الموافقة على طلب السحب',400)
  const withdrawal=await db.prepare("SELECT id,user_id,amount,status FROM withdrawal_requests WHERE id=?1").bind(withdrawalId).first<WithdrawalRow>()
  if(!withdrawal) throw new WalletServiceError('WITHDRAWAL_NOT_FOUND','طلب السحب غير موجود')
  if(withdrawal.status!=='Pending') throw new WalletServiceError('WITHDRAWAL_NOT_PENDING',`لا يمكن الموافقة على طلب السحب لأنه ${withdrawal.status==='Approved'?'تمت الموافقة عليه بالفعل':'تم رفضه بالفعل'}`)

  const walletBefore=await db.prepare('SELECT pending_balance FROM wallets WHERE user_id=?1').bind(withdrawal.user_id).first<{pending_balance:number}>()
  if(!walletBefore) throw new WalletServiceError('WALLET_NOT_FOUND','المحفظة غير موجودة')
  if(walletBefore.pending_balance < withdrawal.amount) throw new WalletServiceError('WALLET_RELEASE_FAILED','الرصيد المعلّق غير كافٍ لإتمام عملية السحب')

  // One D1 batch = one transaction. No financial step is committed alone.
  // withdrawal_id is unique, so a second approval cannot create a duplicate transaction.
  const results=await db.batch([
    db.prepare("UPDATE wallets SET pending_balance=pending_balance-?1,updated_at=datetime('now') WHERE user_id=?2 AND pending_balance>=?1 AND EXISTS (SELECT 1 FROM withdrawal_requests WHERE id=?3 AND status='Pending')").bind(withdrawal.amount,withdrawal.user_id,withdrawalId),
    db.prepare("UPDATE withdrawal_requests SET status='Approved',admin_id=?1,screenshot_path=?2,updated_at=datetime('now') WHERE id=?3 AND status='Pending' AND EXISTS (SELECT 1 FROM wallets WHERE user_id=?4 AND pending_balance=?5)").bind(adminId,screenshotPath,withdrawalId,withdrawal.user_id,walletBefore.pending_balance-withdrawal.amount),
    db.prepare("INSERT INTO transactions (client_id,admin_id,amount,status,screenshot_path,note,approved_at,withdrawal_id) SELECT ?1,?2,?3,'Approved',?4,'withdrawal',datetime('now'),?5 WHERE EXISTS (SELECT 1 FROM withdrawal_requests WHERE id=?5 AND status='Approved' AND admin_id=?2 AND screenshot_path=?4)").bind(withdrawal.user_id,adminId,-Math.abs(withdrawal.amount),screenshotPath,withdrawalId),
  ])
  if(results[0].meta.changes===0 || results[1].meta.changes===0 || results[2].meta.changes===0) {
    throw new WalletServiceError('WALLET_RELEASE_FAILED','فشل إنهاء عملية السحب المالية. لم يتم اعتماد العملية.')
  }
// CHANGE: Prepare both Arabic and English versions for notification history.
const messageAr = notificationText(
  'withdrawal_approved',
  withdrawalId,
  'ar'
)

const messageEn = notificationText(
  'withdrawal_approved',
  withdrawalId,
  'en'
)

try {
  // CHANGE: Store both language versions in notification history.
  await db.prepare(
    `INSERT INTO notifications
      (recipient_id, recipient_type, message, message_en)
    VALUES (?1, 'Client', ?2, ?3)`
  )
    .bind(withdrawal.user_id, messageAr, messageEn)
    .run()
} catch (e) {
  console.error(
    'APPROVAL_NOTIFICATION_DB_ERROR:',
    e
  )
}

try {
  // CHANGE: Get the client's FCM token and preferred language
  // so the Push Notification is sent in the selected language.
  const user = await db.prepare(
   ` SELECT fcm_token, language
    FROM users
    WHERE id = ?1`
  )
    .bind(withdrawal.user_id)
    .first<{
      fcm_token: string | null
      language: 'ar' | 'en'
    }>()

  if (user?.fcm_token) {
    // CHANGE: Select the Push message according to the client's language.
    const pushMessage =
      user.language === 'en' ? messageEn : messageAr

    await sendFirebasePush(
      firebaseEnv,
      user.fcm_token,
      'Canzo',
      pushMessage,
      {
        type: 'withdrawal',
        withdraw_id: String(withdrawalId),
      }
    )
  }
} catch (e) {
  // CHANGE: Push failure must not affect the successful withdrawal approval.
  console.error(
    'APPROVAL_PUSH_NOTIFICATION_ERROR:',
    e
  )
}
 
}

export async function rejectWithdrawal(db:D1Database,withdrawalId:number,adminId:number,firebaseEnv:{FIREBASE_PROJECT_ID:string;FIREBASE_CLIENT_EMAIL:string;FIREBASE_PRIVATE_KEY:string}):Promise<void> {
  const withdrawal=await db.prepare("SELECT id,user_id,amount,status FROM withdrawal_requests WHERE id=?1").bind(withdrawalId).first<WithdrawalRow>()
  if(!withdrawal) throw new WalletServiceError('WITHDRAWAL_NOT_FOUND','طلب السحب غير موجود')
  if(withdrawal.status!=='Pending') throw new WalletServiceError('WITHDRAWAL_NOT_PENDING',`لا يمكن رفض طلب السحب لأنه ${withdrawal.status==='Approved'?'تمت الموافقة عليه بالفعل':'تم رفضه بالفعل'}`)
  const operationTime=new Date().toISOString()
  const results=await db.batch([
    db.prepare("UPDATE withdrawal_requests SET status='Rejected',admin_id=?1,updated_at=?2 WHERE id=?3 AND status='Pending'").bind(adminId,operationTime,withdrawalId),
    db.prepare("UPDATE wallets SET pending_balance=pending_balance-?1,balance=balance+?1,updated_at=datetime('now') WHERE user_id=?2 AND pending_balance>=?1 AND EXISTS (SELECT 1 FROM withdrawal_requests WHERE id=?3 AND status='Rejected' AND admin_id=?4 AND updated_at=?5)").bind(withdrawal.amount,withdrawal.user_id,withdrawalId,adminId,operationTime),
  ])
  if(results[0].meta.changes===0) throw new WalletServiceError('WITHDRAWAL_NOT_PENDING','طلب السحب تم التعامل معه بالفعل بواسطة عملية أخرى')
  if(results[1].meta.changes===0) throw new WalletServiceError('WALLET_RELEASE_FAILED','فشل إعادة المبلغ إلى رصيد المحفظة')
  // CHANGE: Prepare both Arabic and English versions for notification history.
const messageAr = notificationText(
  'withdrawal_rejected',
  withdrawalId,
  'ar'
)

const messageEn = notificationText(
  'withdrawal_rejected',
  withdrawalId,
  'en'
)

try {
  // CHANGE: Store both language versions in notification history.
  await db.prepare(
  `  INSERT INTO notifications
      (recipient_id, recipient_type, message, message_en)
    VALUES (?1, 'Client', ?2, ?3)`
  )
    .bind(withdrawal.user_id, messageAr, messageEn)
    .run()
} catch (e) {
  console.error(
    'REJECTION_NOTIFICATION_DB_ERROR:',
    e
  )
}

try {
  // CHANGE: Get the client's language together with the FCM token.
  const user = await db.prepare(
    `SELECT fcm_token, language
    FROM users
    WHERE id = ?1`
  )
    .bind(withdrawal.user_id)
    .first<{
      fcm_token: string | null
      language: 'ar' | 'en'
    }>()

  if (user?.fcm_token) {
    // CHANGE: Send the Push Notification in the client's selected language.
    const pushMessage =
      user.language === 'en' ? messageEn : messageAr

    await sendFirebasePush(
      firebaseEnv,
      user.fcm_token,
      'Canzo',
      pushMessage,
      {
        type: 'withdrawal',
        withdraw_id: String(withdrawalId),
      }
    )
  }
} catch (e) {
  // CHANGE: Push failure must not affect the successful withdrawal rejection.
  console.error(
    'REJECTION_PUSH_NOTIFICATION_ERROR:',
    e
  )
}
}
