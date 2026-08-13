-- Migration 006 - P0 parking states
-- Adds two new statuses so the system can stop and ask a person instead of guessing.
--
-- IMPORTANT: run 005_ftc_session_tracking.sql BEFORE this file.
-- The live database is missing ftc_session_id and ftc_tracking_number.
--
-- This file is plain ASCII on purpose. Curly quotes and long dashes break psql
-- when the client encoding is not UTF8.

-- FTD took the customer's money but FTC did not deliver it.
-- Auto reversal is off, so the transaction waits here for an operator.
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'MANUAL_REVERSAL_REQUIRED';

-- TSQ could not tell us the outcome after the maximum attempts.
-- Unknown is not the same as failed, so we park it instead of reporting a result.
ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'NEEDS_MANUAL_REVIEW';

-- Plain index, no status values written into it.
-- A partial index listing the new values fails: Postgres will not let you use a new
-- enum value until the statement that added it has been committed.
CREATE INDEX IF NOT EXISTS idx_transactions_status_updated
    ON transactions (status, updated_at);
