-- Migration: Add FTC session tracking columns
-- This allows matching FTC callbacks to transactions

-- Add FTC session and tracking columns
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS ftc_session_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS ftc_tracking_number VARCHAR(10);

-- Create index for callback matching on all session IDs
CREATE INDEX IF NOT EXISTS idx_transactions_ftc_session
ON transactions(ftc_session_id) WHERE ftc_session_id IS NOT NULL;

-- Update findBySessionId to check all session types
COMMENT ON COLUMN transactions.session_id IS 'FTD session ID (original)';
COMMENT ON COLUMN transactions.ftc_session_id IS 'FTC session ID (for credit leg)';
COMMENT ON COLUMN transactions.reversal_session_id IS 'Reversal session ID (if FTC fails)';
