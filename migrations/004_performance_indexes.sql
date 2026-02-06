-- ============================================================================
-- Migration: Performance Indexes
-- Description: Add indexes to optimize slow queries identified in logs
-- ============================================================================

-- ============================================================================
-- TRANSACTIONS TABLE INDEXES
-- ============================================================================

-- Optimize: SELECT * FROM transactions WHERE reversal_required = true AND status NOT IN (...)
DROP INDEX IF EXISTS idx_transactions_reversal;
CREATE INDEX idx_transactions_reversal_pending ON transactions(reversal_required, status)
    WHERE reversal_required = true AND status NOT IN ('COMPLETED', 'FAILED', 'REVERSAL_SUCCESS');

-- Optimize: SELECT * FROM transactions WHERE status = $1 ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions(status, created_at DESC);

-- Optimize: SELECT * FROM transactions WHERE status = $1 ORDER BY updated_at (for SKIP LOCKED queries)
CREATE INDEX IF NOT EXISTS idx_transactions_status_updated ON transactions(status, updated_at ASC);

-- Optimize: SELECT DISTINCT institution_id FROM transactions WHERE status = ...
CREATE INDEX IF NOT EXISTS idx_transactions_institution_status ON transactions(institution_id, status);

-- Optimize: Aggregation queries with status filters
CREATE INDEX IF NOT EXISTS idx_transactions_status_completed_at ON transactions(status, completed_at)
    WHERE status IN ('COMPLETED', 'FAILED', 'TIMEOUT');

-- Optimize: Date-based transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_created_date ON transactions(created_at DESC);

-- Optimize: SELECT * FROM transactions WHERE timeout_at < CURRENT_TIMESTAMP AND status NOT IN (...)
CREATE INDEX IF NOT EXISTS idx_transactions_timeout ON transactions(timeout_at ASC, status)
    WHERE status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT', 'REVERSAL_PENDING', 'REVERSAL_SUCCESS', 'REVERSAL_FAILED');

-- Optimize: TSQ pending queries
CREATE INDEX IF NOT EXISTS idx_transactions_tsq_pending ON transactions(tsq_required, tsq_next_attempt_at, status)
    WHERE tsq_required = true AND status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT');

-- Optimize: FTD_SUCCESS needing FTC (for FTC worker)
CREATE INDEX IF NOT EXISTS idx_transactions_ftd_success ON transactions(status, updated_at ASC)
    WHERE status = 'FTD_SUCCESS';

-- Optimize: COUNT(*) FILTER queries for stats (covering index)
CREATE INDEX IF NOT EXISTS idx_transactions_stats_cover ON transactions(created_at, status, amount)
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- ============================================================================
-- SCHEDULED TRANSFERS INDEXES
-- ============================================================================

-- Optimize: UPDATE scheduled_transfers SET status = 'PROCESSING'... WHERE status = 'PENDING'
DROP INDEX IF EXISTS idx_scheduled_transfers_scheduled;
CREATE INDEX idx_scheduled_transfers_pending ON scheduled_transfers(status, scheduled_at)
    WHERE status = 'PENDING';

-- Processing scheduled transfers queries - covering index
CREATE INDEX IF NOT EXISTS idx_scheduled_transfers_process ON scheduled_transfers(status, scheduled_at ASC, id)
    WHERE status IN ('PENDING', 'PROCESSING');

-- ============================================================================
-- RECURRING PAYMENTS INDEXES
-- ============================================================================

-- Optimize: SELECT * FROM recurring_payments WHERE status = 'ACTIVE'...
DROP INDEX IF EXISTS idx_recurring_next_exec;
CREATE INDEX idx_recurring_active_exec ON recurring_payments(status, next_execution_at ASC)
    WHERE status = 'ACTIVE';

-- Covering index for active recurring payments
CREATE INDEX IF NOT EXISTS idx_recurring_active_cover ON recurring_payments(status, next_execution_at, institution_id, id)
    WHERE status = 'ACTIVE';

-- ============================================================================
-- BULK BATCHES INDEXES
-- ============================================================================

-- Optimize: UPDATE bulk_batches SET status = 'PROCESSING'...
DROP INDEX IF EXISTS idx_bulk_batches_status;
CREATE INDEX idx_bulk_batches_pending ON bulk_batches(status, created_at)
    WHERE status IN ('PENDING', 'PROCESSING');

-- ============================================================================
-- CLIENT CALLBACKS INDEXES
-- ============================================================================

-- Optimize: SELECT c.*, i.webhook_secret, t.reference_number FROM client_callbacks c JOIN...
CREATE INDEX IF NOT EXISTS idx_client_callbacks_pending_join ON client_callbacks(status, next_attempt_at, transaction_id, institution_id)
    WHERE status IN ('PENDING', 'FAILED') AND attempts < max_attempts;

-- ============================================================================
-- GIP CALLBACKS INDEXES
-- ============================================================================

-- Optimize: Pending callback processing
CREATE INDEX IF NOT EXISTS idx_gip_callbacks_pending_process ON gip_callbacks(status, received_at)
    WHERE status = 'PENDING';

-- ============================================================================
-- SLA & REPORTING INDEXES
-- ============================================================================

-- Optimize: Performance metrics calculations
CREATE INDEX IF NOT EXISTS idx_transactions_perf_metrics ON transactions(transaction_type, created_at, completed_at)
    WHERE completed_at IS NOT NULL;

-- ============================================================================
-- UPTIME CHECKS INDEXES
-- ============================================================================

-- Optimize: Recent uptime check queries
DROP INDEX IF EXISTS idx_uptime_checks_endpoint;
CREATE INDEX idx_uptime_checks_recent ON uptime_checks(endpoint, check_time DESC);

-- ============================================================================
-- AUDIT LOG INDEXES
-- ============================================================================

-- Optimize: Recent audit queries
CREATE INDEX IF NOT EXISTS idx_audit_entity_time ON audit_log(entity_type, entity_id, created_at DESC);

-- ============================================================================
-- INSTITUTION CREDENTIALS INDEXES
-- ============================================================================

-- Optimize: API key lookup with active status
CREATE INDEX IF NOT EXISTS idx_credentials_active_key ON institution_credentials(api_key, is_active)
    WHERE is_active = true AND revoked_at IS NULL;

-- ============================================================================
-- GIP EVENTS INDEXES
-- ============================================================================

-- Optimize: AVG queries for response times in SLA checks
CREATE INDEX IF NOT EXISTS idx_gip_events_perf ON gip_events(event_type, created_at, duration_ms)
    WHERE duration_ms IS NOT NULL;

-- ============================================================================
-- BULK BATCH ITEMS INDEXES
-- ============================================================================

-- Optimize: pending items processing
CREATE INDEX IF NOT EXISTS idx_bulk_items_pending ON bulk_batch_items(batch_id, status, sequence_number)
    WHERE status = 'PENDING';

-- ============================================================================
-- FRAUD ALERTS INDEXES (additional)
-- ============================================================================

-- Optimize: active alerts by severity
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_active ON fraud_alerts(status, severity, created_at DESC)
    WHERE status IN ('OPEN', 'INVESTIGATING');

-- ============================================================================
-- SYSTEM ALERTS INDEXES
-- ============================================================================

-- Optimize: active system alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_active ON system_alerts(status, severity, created_at DESC)
    WHERE status IN ('ACTIVE', 'ACKNOWLEDGED');

-- ============================================================================
-- STATISTICS (run ANALYZE to update planner statistics)
-- ============================================================================

ANALYZE transactions;
ANALYZE scheduled_transfers;
ANALYZE recurring_payments;
ANALYZE bulk_batches;
ANALYZE bulk_batch_items;
ANALYZE client_callbacks;
ANALYZE gip_callbacks;
ANALYZE gip_events;
ANALYZE uptime_checks;
ANALYZE audit_log;
ANALYZE institution_credentials;
ANALYZE fraud_alerts;
ANALYZE system_alerts;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
