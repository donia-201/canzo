ALTER TABLE transactions ADD COLUMN withdrawal_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_withdrawal_id ON transactions(withdrawal_id) WHERE withdrawal_id IS NOT NULL;
