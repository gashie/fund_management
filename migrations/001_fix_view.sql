-- ============================================================================
-- FIX: Create the missing v_pending_attention view
-- Run this if you already ran 001_improved_schema.sql and got the LIKE error
-- ============================================================================

-- Drop if exists (in case of partial creation)
DROP VIEW IF EXISTS v_pending_attention;

-- Pending transactions requiring attention
-- Fixed: Cast ENUM to TEXT for LIKE operator
CREATE OR REPLACE VIEW v_pending_attention AS
SELECT
    t.*,
    CASE
        WHEN t.status::TEXT LIKE '%TSQ%' THEN 'Needs TSQ'
        WHEN t.reversal_required THEN 'Needs Reversal'
        WHEN t.timeout_at < CURRENT_TIMESTAMP THEN 'Timed Out'
        WHEN t.status = 'FTD_PENDING' AND t.created_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes' THEN 'FTD Callback Delayed'
        WHEN t.status = 'FTC_PENDING' AND t.created_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes' THEN 'FTC Callback Delayed'
    END as attention_reason
FROM transactions t
WHERE t.status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT')
  AND (
    t.status::TEXT LIKE '%TSQ%'
    OR t.reversal_required
    OR t.timeout_at < CURRENT_TIMESTAMP
    OR (t.status = 'FTD_PENDING' AND t.created_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes')
    OR (t.status = 'FTC_PENDING' AND t.created_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes')
  );

-- Verify
SELECT 'v_pending_attention view created successfully' as status;
