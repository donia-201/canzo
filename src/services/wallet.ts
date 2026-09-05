export type WalletRow = {
    user_id: number
    balance: number
    pending_balance: number
}

export type WithdrawalRow = {
    id: number
    user_id: number
    amount: number
    status: 'Pending' | 'Approved' | 'Rejected'
    admin_id: number | null
    screenshot_path: string | null
    wallet_number: string | null
    wallet_type: string | null
    created_at: string
    updated_at: string
}

import { AppError } from '../middlewares/errorHandler'

export class WalletServiceError extends AppError {
    constructor(
        code:
            | 'INSUFFICIENT_BALANCE'
            | 'PENDING_WITHDRAWAL_EXISTS'
            | 'WITHDRAWAL_NOT_FOUND'
            | 'WITHDRAWAL_NOT_PENDING'
            | 'WALLET_LOCK_FAILED'
            | 'WALLET_RELEASE_FAILED'
            | 'WALLET_NOT_FOUND'
            | 'INVALID_AMOUNT',
        message: string
    ) {
        const statusMap: Record<WalletServiceError['code'], 400 | 404 | 409 | 500> = {
            INSUFFICIENT_BALANCE: 400,
            PENDING_WITHDRAWAL_EXISTS: 409,
            WITHDRAWAL_NOT_FOUND: 404,
            WITHDRAWAL_NOT_PENDING: 409,
            WALLET_LOCK_FAILED: 500,
            WALLET_RELEASE_FAILED: 500,
            // Added dedicated mappings for missing wallets and invalid amounts.
            WALLET_NOT_FOUND: 404,
            INVALID_AMOUNT: 400,
        }
        super(code, message, statusMap[code])
        this.name = 'WalletServiceError'
    }
}


export async function ensureWallet(db: D1Database, userId: number): Promise<void> {
    await db
        .prepare(
            'INSERT OR IGNORE INTO wallets (user_id, balance, pending_balance) VALUES (?1, 0, 0)'
        )
        .bind(userId)
        .run()
}

export async function getWallet(db: D1Database, userId: number): Promise<WalletRow> {
    await ensureWallet(db, userId)
    const wallet = await db
        .prepare(
            'SELECT user_id, balance, pending_balance FROM wallets WHERE user_id = ?1'
        )
        .bind(userId)
        .first<WalletRow>()
    if (!wallet) {
        // Missing wallet is a 404, not a wallet-lock/server error.
        throw new WalletServiceError('WALLET_NOT_FOUND', 'المحفظة غير موجودة')
    }
    return wallet
}

export async function creditWallet(
    db: D1Database,
    userId: number,
    amount: number
): Promise<void> {
    if (amount <= 0) {
        // Do not silently ignore invalid financial amounts.
        throw new WalletServiceError('INVALID_AMOUNT', 'المبلغ يجب أن يكون أكبر من الصفر')
    }
    await ensureWallet(db, userId)
    const result = await db
        .prepare(
            `UPDATE wallets
             SET balance = balance + ?1, updated_at = datetime('now')
             WHERE user_id = ?2`
        )
        .bind(amount, userId)
        .run()
    if (result.meta.changes === 0) {
        throw new WalletServiceError('WALLET_LOCK_FAILED', 'فشل تحديث رصيد المحفظة')
    }
}

export async function createWithdrawalRequest(
    db: D1Database,
    userId: number,
    amount: number,
    walletNumber: string,
    walletType: string
): Promise<number> {
    if (amount <= 0) {
        //Invalid amount gets its own 400 error code.
        throw new WalletServiceError('INVALID_AMOUNT', 'المبلغ يجب أن يكون أكبر من الصفر')
    }

    await ensureWallet(db, userId)

    const pending = await db
        .prepare(
            `SELECT id FROM withdrawal_requests
             WHERE user_id = ?1 AND status = 'Pending'
             LIMIT 1`
        )
        .bind(userId)
        .first<{ id: number }>()

    if (pending) {
        throw new WalletServiceError(
            'PENDING_WITHDRAWAL_EXISTS',
            'يوجد طلب سحب قيد المراجعة بالفعل'
        )
    }

    const lock = await db
        .prepare(
            `UPDATE wallets
             SET balance = balance - ?1,
                 pending_balance = pending_balance + ?2,
                 updated_at = datetime('now')
             WHERE user_id = ?3 AND balance >= ?4`
        )
        .bind(amount, amount, userId, amount)
        .run()

    if (lock.meta.changes === 0) {
        throw new WalletServiceError('INSUFFICIENT_BALANCE', 'الرصيد غير كافي للسحب')
    }

    const clientInfo = await db.prepare('SELECT activity_name FROM clients WHERE user_id = ?1')
        .bind(userId).first<{ activity_name: string }>()

    const clientName = clientInfo?.activity_name || `user ${userId}`

    const adminMessage = `طلب سحب جديد من ${clientName} بمبلغ ${amount} :ج. م ,نوع المحفظة ${walletType} رقم المحفظة :${walletNumber}`

    let withdrawalId: number | null = null

    try {
        const insert = await db
            .prepare(
                `INSERT INTO withdrawal_requests (user_id, amount, status, wallet_number, wallet_type)
                 VALUES (?1, ?2, 'Pending', ?3, ?4)`
            )
            .bind(userId, amount, walletNumber, walletType)
            .run()

        withdrawalId = Number(insert.meta.last_row_id)
        if (!withdrawalId) {
            throw new WalletServiceError('WALLET_LOCK_FAILED', 'فشل إنشاء طلب السحب')
        }

        //  If notification creation fails, the catch removes the withdrawal and restores the wallet.
        await db
            .prepare(
                `INSERT INTO notifications (recipient_id, recipient_type, message)
                 SELECT id, 'Admin', ?1 FROM users WHERE user_role = 'Admin'`
            )
            .bind(adminMessage)
            .run()

        return Number(withdrawalId)
    } catch (error) {
        // Compensate for a failed insert/notification so a failed request cannot leave the wallet deducted.
        try {
            await db.batch([
                db.prepare(
                    `DELETE FROM withdrawal_requests
                     WHERE id = ?1`
                ).bind(withdrawalId ?? -1),
                db.prepare(
                    `UPDATE wallets
                     SET balance = balance + ?1,
                         pending_balance = pending_balance - ?1,
                         updated_at = datetime('now')
                     WHERE user_id = ?2`
                ).bind(amount, userId),
            ])
        } catch (rollbackError) {
            // Log failed financial compensation as critical.
            console.error('CRITICAL: failed to restore wallet after withdrawal creation error:', rollbackError)
        }
        throw error
    }
}

export async function approveWithdrawal(
    db: D1Database,
    withdrawalId: number,
    adminId: number,
    screenshotPath: string | null
): Promise<void> {
    const withdrawal = await db
        .prepare(
            `SELECT id, user_id, amount, status
             FROM withdrawal_requests WHERE id = ?1`
        )
        .bind(withdrawalId)
        .first<WithdrawalRow>()

    if (!withdrawal) {
        throw new WalletServiceError('WITHDRAWAL_NOT_FOUND', 'طلب السحب غير موجود')
    }
    if (withdrawal.status !== 'Pending') {
        throw new WalletServiceError('WITHDRAWAL_NOT_PENDING', 'طلب السحب لم يعد قيد الانتظار')
    }

    const results = await db.batch([
        db
            .prepare(
                `UPDATE withdrawal_requests
                 SET status = 'Approved',
                     admin_id = ?1,
                     screenshot_path = ?2,
                     updated_at = datetime('now')
                 WHERE id = ?3 AND status = 'Pending'`  
            )
            .bind(adminId, screenshotPath, withdrawalId),
        db
            .prepare(
                `UPDATE wallets
                 SET pending_balance = pending_balance - ?1,
                     updated_at = datetime('now')
                 WHERE user_id = ?2 AND pending_balance >= ?1`
            )
            .bind(withdrawal.amount, withdrawal.user_id),
        db
            .prepare(
                `INSERT INTO transactions (
                    client_id, admin_id, amount, status, screenshot_path, note, approved_at
                 ) VALUES (?1, ?2, ?3, 'Approved', ?4, 'withdrawal', datetime('now'))`
            )
            .bind(
                withdrawal.user_id,
                adminId,
                -Math.abs(withdrawal.amount),
                screenshotPath
            ),
    ])

    if (results[0].meta.changes === 0) {
        throw new WalletServiceError('WITHDRAWAL_NOT_PENDING', 'طلب السحب لم يعد قيد الانتظار')
    }
    if (results[1].meta.changes === 0) {
        throw new WalletServiceError('WALLET_RELEASE_FAILED', 'فشل إنهاء عملية السحب')
    }

    // Notification failure must not turn an already successful financial operation into a 500.
    try {
        await db
            .prepare(
                `INSERT INTO notifications (recipient_id, recipient_type, message)
                 VALUES (?1, 'Client', ?2)`
            )
            .bind(withdrawal.user_id, ` تمت الموافقة على عملية السحب رقم  #${withdrawalId} `)
            .run()
    } catch (notificationError) {
        // Log notification failure while keeping the approved withdrawal successful.
        console.error('Withdrawal approval notification failed:', notificationError)
    }
}


export async function rejectWithdrawal(
    db: D1Database,
    withdrawalId: number,
    adminId: number
): Promise<void> {
    const withdrawal = await db
        .prepare(
            `SELECT id, user_id, amount, status
             FROM withdrawal_requests WHERE id = ?1`
        )
        .bind(withdrawalId)
        .first<WithdrawalRow>()

    if (!withdrawal) {
        throw new WalletServiceError('WITHDRAWAL_NOT_FOUND', 'طلب السحب غير موجود')
    }
    if (withdrawal.status !== 'Pending') {
        throw new WalletServiceError('WITHDRAWAL_NOT_PENDING', 'طلب السحب لم يعد قيد الانتظار')
    }

    const results = await db.batch([
        db
            .prepare(
                `UPDATE withdrawal_requests
                 SET status = 'Rejected',
                     admin_id = ?1,
                     updated_at = datetime('now')
                 WHERE id = ?2 AND status = 'Pending'`
            )
            .bind(adminId, withdrawalId),
        db
            .prepare(
                `UPDATE wallets
                 SET balance = balance + ?1,
                     pending_balance = pending_balance - ?1,
                     updated_at = datetime('now')
                 WHERE user_id = ?2 AND pending_balance >= ?1`
            )
            .bind(withdrawal.amount, withdrawal.user_id),
    ])

    if (results[0].meta.changes === 0) {
        throw new WalletServiceError('WITHDRAWAL_NOT_PENDING', 'طلب السحب لم يعد قيد الانتظار')
    }
    if (results[1].meta.changes === 0) {
        throw new WalletServiceError('WALLET_RELEASE_FAILED', 'فشل إعادة المبلغ إلى المحفظة')
    }
    try {
        await db
            .prepare(
                `INSERT INTO notifications (recipient_id, recipient_type, message)
                 VALUES (?1, 'Client', ?2)`
            )
            .bind(withdrawal.user_id, ` ${withdrawalId}# تم رفض عملية السحب رقم `)
            .run()
    } catch (notificationError) {
        //  Keep the successful rejection/refund successful if notification storage fails.
        console.error('Withdrawal rejection notification failed:', notificationError)
    }
}

   
