-- Migration 007 - remember details per leg
-- Plain ASCII only. No status values inside indexes.

-- TSQ must send back the SAME date and time that was used on the original leg.
-- Right now the code sends the current time, so TSQ never matches and always fails.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ftd_date_time      VARCHAR(12);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ftc_date_time      VARCHAR(12);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reversal_date_time VARCHAR(12);

-- Counts how many times we tried to send the FTC.
-- Without this a failing FTC retries forever every 3 seconds.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ftc_attempts INTEGER DEFAULT 0;

COMMENT ON COLUMN transactions.ftd_date_time      IS 'dateTime sent on the FTD, format YYMMDDHHmmss';
COMMENT ON COLUMN transactions.ftc_date_time      IS 'dateTime sent on the FTC, format YYMMDDHHmmss';
COMMENT ON COLUMN transactions.reversal_date_time IS 'dateTime sent on the reversal, format YYMMDDHHmmss';
COMMENT ON COLUMN transactions.ftc_attempts       IS 'How many times we tried to send the FTC';
