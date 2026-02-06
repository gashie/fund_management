-- ============================================================================
-- Migration: Feature Tables
-- Description: Additional tables for security, operational, alerting,
--              reporting, and resilience features
-- ============================================================================

-- ============================================================================
-- SECURITY TABLES
-- ============================================================================

-- Fraud Detection Alerts
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id),
    institution_id UUID REFERENCES institutions(id),
    alert_type VARCHAR(50) NOT NULL, -- VELOCITY, AMOUNT, TIME, PATTERN, DUPLICATE
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, CRITICAL
    description TEXT,
    details JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX idx_fraud_alerts_institution ON fraud_alerts(institution_id);
CREATE INDEX idx_fraud_alerts_created ON fraud_alerts(created_at DESC);

-- API Key Rotation History
CREATE TABLE IF NOT EXISTS api_key_rotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID REFERENCES institution_credentials(id),
    old_key_hash VARCHAR(64),
    new_key_hash VARCHAR(64),
    rotated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    rotated_by VARCHAR(100),
    grace_period_ends_at TIMESTAMPTZ,
    reason VARCHAR(100) -- SCHEDULED, MANUAL, COMPROMISED
);

CREATE INDEX idx_key_rotations_credential ON api_key_rotations(credential_id);

-- Request Signatures Log (for debugging)
CREATE TABLE IF NOT EXISTS request_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID REFERENCES institution_credentials(id),
    request_path VARCHAR(255),
    signature_received VARCHAR(128),
    signature_expected VARCHAR(128),
    timestamp_received BIGINT,
    is_valid BOOLEAN,
    failure_reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_request_signatures_credential ON request_signatures(credential_id);
CREATE INDEX idx_request_signatures_created ON request_signatures(created_at DESC);

-- ============================================================================
-- OPERATIONAL TABLES
-- ============================================================================

-- Scheduled Transfers
CREATE TABLE IF NOT EXISTS scheduled_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    credential_id UUID REFERENCES institution_credentials(id),
    reference_number VARCHAR(50) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,

    -- Transfer details
    amount DECIMAL(15, 2) NOT NULL,
    src_bank_code VARCHAR(10) NOT NULL,
    src_account_number VARCHAR(30) NOT NULL,
    src_account_name VARCHAR(100),
    dest_bank_code VARCHAR(10) NOT NULL,
    dest_account_number VARCHAR(30) NOT NULL,
    dest_account_name VARCHAR(100),
    narration VARCHAR(255),
    callback_url VARCHAR(500),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
    transaction_id UUID REFERENCES transactions(id),
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by VARCHAR(100)
);

CREATE INDEX idx_scheduled_transfers_scheduled ON scheduled_transfers(scheduled_at) WHERE status = 'PENDING';
CREATE INDEX idx_scheduled_transfers_institution ON scheduled_transfers(institution_id);
CREATE INDEX idx_scheduled_transfers_status ON scheduled_transfers(status);

-- Recurring Payments
CREATE TABLE IF NOT EXISTS recurring_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    credential_id UUID REFERENCES institution_credentials(id),
    name VARCHAR(100) NOT NULL,

    -- Transfer details
    amount DECIMAL(15, 2) NOT NULL,
    src_bank_code VARCHAR(10) NOT NULL,
    src_account_number VARCHAR(30) NOT NULL,
    src_account_name VARCHAR(100),
    dest_bank_code VARCHAR(10) NOT NULL,
    dest_account_number VARCHAR(30) NOT NULL,
    dest_account_name VARCHAR(100),
    narration VARCHAR(255),
    callback_url VARCHAR(500),

    -- Schedule
    frequency VARCHAR(20) NOT NULL, -- DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY
    day_of_week INTEGER, -- 0-6 for weekly
    day_of_month INTEGER, -- 1-31 for monthly
    start_date DATE NOT NULL,
    end_date DATE,
    max_occurrences INTEGER,

    -- Tracking
    total_occurrences INTEGER DEFAULT 0,
    total_successful INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    total_amount_transferred DECIMAL(20, 2) DEFAULT 0,
    next_execution_at TIMESTAMPTZ,
    last_execution_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, COMPLETED, CANCELLED

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recurring_next_exec ON recurring_payments(next_execution_at) WHERE status = 'ACTIVE';
CREATE INDEX idx_recurring_institution ON recurring_payments(institution_id);

-- Recurring Payment Executions
CREATE TABLE IF NOT EXISTS recurring_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_payment_id UUID NOT NULL REFERENCES recurring_payments(id),
    occurrence_number INTEGER NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    executed_at TIMESTAMPTZ,
    transaction_id UUID REFERENCES transactions(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED, SKIPPED
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recurring_exec_payment ON recurring_executions(recurring_payment_id);
CREATE INDEX idx_recurring_exec_scheduled ON recurring_executions(scheduled_at) WHERE status = 'PENDING';

-- Transaction Templates
CREATE TABLE IF NOT EXISTS transaction_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Template details
    src_bank_code VARCHAR(10),
    src_account_number VARCHAR(30),
    src_account_name VARCHAR(100),
    dest_bank_code VARCHAR(10),
    dest_account_number VARCHAR(30),
    dest_account_name VARCHAR(100),
    default_amount DECIMAL(15, 2),
    default_narration VARCHAR(255),

    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_institution ON transaction_templates(institution_id);

-- Bulk Transaction Batches
CREATE TABLE IF NOT EXISTS bulk_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    credential_id UUID REFERENCES institution_credentials(id),
    reference_number VARCHAR(50) NOT NULL UNIQUE,

    -- Batch info
    total_count INTEGER NOT NULL,
    total_amount DECIMAL(20, 2) NOT NULL,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    pending_count INTEGER NOT NULL,
    successful_amount DECIMAL(20, 2) DEFAULT 0,
    failed_amount DECIMAL(20, 2) DEFAULT 0,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, PARTIAL, FAILED

    -- Metadata
    source_file VARCHAR(255),
    callback_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_bulk_batches_institution ON bulk_batches(institution_id);
CREATE INDEX idx_bulk_batches_status ON bulk_batches(status);

-- Bulk Batch Items
CREATE TABLE IF NOT EXISTS bulk_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES bulk_batches(id),
    sequence_number INTEGER NOT NULL,

    -- Transfer details
    amount DECIMAL(15, 2) NOT NULL,
    src_bank_code VARCHAR(10) NOT NULL,
    src_account_number VARCHAR(30) NOT NULL,
    dest_bank_code VARCHAR(10) NOT NULL,
    dest_account_number VARCHAR(30) NOT NULL,
    dest_account_name VARCHAR(100),
    narration VARCHAR(255),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, SUCCESS, FAILED
    transaction_id UUID REFERENCES transactions(id),
    error_code VARCHAR(10),
    error_message TEXT,

    -- Timing
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bulk_items_batch ON bulk_batch_items(batch_id);
CREATE INDEX idx_bulk_items_status ON bulk_batch_items(status);

-- Institution Limits
CREATE TABLE IF NOT EXISTS institution_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) UNIQUE,

    -- Limits
    daily_limit DECIMAL(20, 2),
    monthly_limit DECIMAL(20, 2),
    per_transaction_limit DECIMAL(15, 2),

    -- Current usage (reset daily/monthly)
    daily_used DECIMAL(20, 2) DEFAULT 0,
    monthly_used DECIMAL(20, 2) DEFAULT 0,
    daily_reset_at DATE DEFAULT CURRENT_DATE,
    monthly_reset_at DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_institution_limits_institution ON institution_limits(institution_id);

-- ============================================================================
-- ALERTING TABLES
-- ============================================================================

-- System Alerts
CREATE TABLE IF NOT EXISTS system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL, -- FAILURE_RATE, RESPONSE_TIME, PENDING_COUNT, STUCK_TXN, GIP_DOWN, etc.
    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING', -- INFO, WARNING, ERROR, CRITICAL
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,

    -- Notification tracking
    slack_sent BOOLEAN DEFAULT false,
    slack_sent_at TIMESTAMPTZ,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    sms_sent BOOLEAN DEFAULT false,
    sms_sent_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ACKNOWLEDGED, RESOLVED
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_alerts_status ON system_alerts(status);
CREATE INDEX idx_system_alerts_type ON system_alerts(alert_type);
CREATE INDEX idx_system_alerts_created ON system_alerts(created_at DESC);

-- SLA Metrics
CREATE TABLE IF NOT EXISTS sla_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_date DATE NOT NULL,
    metric_hour INTEGER, -- NULL for daily aggregates

    -- NEC Metrics
    nec_total_count INTEGER DEFAULT 0,
    nec_success_count INTEGER DEFAULT 0,
    nec_avg_response_ms INTEGER,
    nec_p95_response_ms INTEGER,
    nec_sla_breaches INTEGER DEFAULT 0,

    -- FT Metrics
    ft_total_count INTEGER DEFAULT 0,
    ft_success_count INTEGER DEFAULT 0,
    ft_avg_response_ms INTEGER,
    ft_p95_response_ms INTEGER,
    ft_sla_breaches INTEGER DEFAULT 0,

    -- Callback Metrics
    callback_total_count INTEGER DEFAULT 0,
    callback_success_count INTEGER DEFAULT 0,
    callback_avg_delivery_ms INTEGER,
    callback_sla_breaches INTEGER DEFAULT 0,

    -- Uptime
    uptime_seconds INTEGER,
    downtime_seconds INTEGER DEFAULT 0,
    uptime_percent DECIMAL(5, 2),

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(metric_date, metric_hour)
);

CREATE INDEX idx_sla_metrics_date ON sla_metrics(metric_date);

-- GIP Uptime Checks
CREATE TABLE IF NOT EXISTS uptime_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint VARCHAR(100) NOT NULL, -- NEC, FTD, FTC, TSQ
    check_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_healthy BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT
);

CREATE INDEX idx_uptime_checks_endpoint ON uptime_checks(endpoint, check_time DESC);

-- Anomaly Detection Log
CREATE TABLE IF NOT EXISTS anomaly_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    anomaly_type VARCHAR(50) NOT NULL, -- VOLUME_SPIKE, FAILURE_SPIKE, UNUSUAL_TIME, UNUSUAL_AMOUNT
    description TEXT,
    expected_value DECIMAL(20, 4),
    actual_value DECIMAL(20, 4),
    deviation_percent DECIMAL(10, 2),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_anomaly_created ON anomaly_detections(created_at DESC);
CREATE INDEX idx_anomaly_institution ON anomaly_detections(institution_id);

-- ============================================================================
-- REPORTING TABLES
-- ============================================================================

-- Settlement Reports
CREATE TABLE IF NOT EXISTS settlement_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    institution_id UUID REFERENCES institutions(id), -- NULL for system-wide

    -- Summary
    total_transactions INTEGER NOT NULL,
    successful_transactions INTEGER NOT NULL,
    failed_transactions INTEGER NOT NULL,
    total_amount DECIMAL(20, 2) NOT NULL,
    successful_amount DECIMAL(20, 2) NOT NULL,
    failed_amount DECIMAL(20, 2) NOT NULL,

    -- Fees
    total_fees DECIMAL(15, 2) DEFAULT 0,

    -- By type
    nec_count INTEGER DEFAULT 0,
    ft_count INTEGER DEFAULT 0,
    reversal_count INTEGER DEFAULT 0,

    -- Status breakdown (JSONB)
    status_breakdown JSONB,
    hourly_breakdown JSONB,

    -- Report file
    report_file_path VARCHAR(500),
    report_format VARCHAR(10), -- csv, pdf, xlsx

    -- Metadata
    generated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    generated_by VARCHAR(100) DEFAULT 'system'
);

CREATE INDEX idx_settlement_date ON settlement_reports(report_date);
CREATE INDEX idx_settlement_institution ON settlement_reports(institution_id);
CREATE UNIQUE INDEX idx_settlement_unique ON settlement_reports(report_date, institution_id)
    WHERE institution_id IS NOT NULL;

-- Fee Configurations
CREATE TABLE IF NOT EXISTS fee_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id), -- NULL for default
    transaction_type VARCHAR(20) NOT NULL, -- NEC, FT, ALL

    -- Fee structure
    fee_type VARCHAR(20) NOT NULL DEFAULT 'PERCENTAGE', -- PERCENTAGE, FIXED, TIERED
    fee_percent DECIMAL(5, 4),
    fee_fixed DECIMAL(10, 2),
    fee_min DECIMAL(10, 2),
    fee_max DECIMAL(10, 2),
    fee_cap DECIMAL(10, 2),

    -- Tiered fees (JSONB array of {min_amount, max_amount, fee_percent, fee_fixed})
    tiers JSONB,

    -- Validity
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fee_config_institution ON fee_configurations(institution_id);
CREATE INDEX idx_fee_config_active ON fee_configurations(is_active, effective_from);

-- Transaction Fees (calculated fees for each transaction)
CREATE TABLE IF NOT EXISTS transaction_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    fee_config_id UUID REFERENCES fee_configurations(id),

    transaction_amount DECIMAL(15, 2) NOT NULL,
    fee_amount DECIMAL(10, 2) NOT NULL,
    fee_type VARCHAR(20) NOT NULL,
    fee_calculation JSONB, -- Details of how fee was calculated

    -- Billing
    is_billed BOOLEAN DEFAULT false,
    billed_at TIMESTAMPTZ,
    invoice_id UUID,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_txn_fees_transaction ON transaction_fees(transaction_id);
CREATE INDEX idx_txn_fees_unbilled ON transaction_fees(is_billed) WHERE is_billed = false;

-- Institution Invoices
CREATE TABLE IF NOT EXISTS institution_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Amounts
    total_transactions INTEGER NOT NULL,
    total_volume DECIMAL(20, 2) NOT NULL,
    total_fees DECIMAL(15, 2) NOT NULL,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, PAID, OVERDUE, CANCELLED
    due_date DATE,
    paid_at TIMESTAMPTZ,
    paid_amount DECIMAL(15, 2),
    payment_reference VARCHAR(100),

    -- Details
    line_items JSONB,
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_institution ON institution_invoices(institution_id);
CREATE INDEX idx_invoices_status ON institution_invoices(status);
CREATE INDEX idx_invoices_due ON institution_invoices(due_date) WHERE status IN ('SENT', 'OVERDUE');

-- ============================================================================
-- RESILIENCE TABLES
-- ============================================================================

-- Circuit Breaker State
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(50) NOT NULL UNIQUE, -- GIP_NEC, GIP_FTD, GIP_FTC, GIP_TSQ
    state VARCHAR(20) NOT NULL DEFAULT 'CLOSED', -- CLOSED, OPEN, HALF_OPEN
    failure_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Request Queue
CREATE TABLE IF NOT EXISTS request_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_type VARCHAR(50) NOT NULL, -- NEC, FT, CALLBACK
    priority INTEGER DEFAULT 5, -- 1 highest, 10 lowest

    -- Request data
    institution_id UUID NOT NULL REFERENCES institutions(id),
    request_data JSONB NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Result
    response_data JSONB,
    error_message TEXT,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    scheduled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_queue_pending ON request_queue(scheduled_at, priority) WHERE status = 'PENDING';
CREATE INDEX idx_queue_status ON request_queue(status);

-- Idempotency Keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key VARCHAR(100) NOT NULL,
    institution_id UUID NOT NULL REFERENCES institutions(id),
    request_path VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL, -- Hash of request body

    -- Response
    response_status INTEGER,
    response_body JSONB,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,

    UNIQUE(idempotency_key, institution_id)
);

CREATE INDEX idx_idempotency_lookup ON idempotency_keys(idempotency_key, institution_id);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- ============================================================================
-- DEVELOPER TABLES
-- ============================================================================

-- Request Logs (detailed API request logging)
CREATE TABLE IF NOT EXISTS request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    credential_id UUID REFERENCES institution_credentials(id),

    -- Request
    request_id VARCHAR(50),
    method VARCHAR(10) NOT NULL,
    path VARCHAR(255) NOT NULL,
    query_params JSONB,
    headers JSONB,
    body JSONB,
    client_ip VARCHAR(45),
    user_agent TEXT,

    -- Response
    status_code INTEGER,
    response_body JSONB,
    response_time_ms INTEGER,

    -- Context
    transaction_id UUID,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_request_logs_institution ON request_logs(institution_id);
CREATE INDEX idx_request_logs_created ON request_logs(created_at DESC);
CREATE INDEX idx_request_logs_path ON request_logs(path);

-- Webhook Test Results
CREATE TABLE IF NOT EXISTS webhook_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    webhook_url VARCHAR(500) NOT NULL,

    -- Test details
    test_payload JSONB NOT NULL,

    -- Result
    status_code INTEGER,
    response_body TEXT,
    response_time_ms INTEGER,
    is_success BOOLEAN,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_tests_institution ON webhook_tests(institution_id);

-- Sandbox Transactions (for testing)
CREATE TABLE IF NOT EXISTS sandbox_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    credential_id UUID REFERENCES institution_credentials(id),

    -- Same structure as transactions but for sandbox
    reference_number VARCHAR(50) NOT NULL,
    session_id VARCHAR(50),
    transaction_type VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    amount DECIMAL(15, 2),
    src_bank_code VARCHAR(10),
    src_account_number VARCHAR(30),
    dest_bank_code VARCHAR(10),
    dest_account_number VARCHAR(30),
    dest_account_name VARCHAR(100),
    narration VARCHAR(255),

    -- Simulated response
    simulated_action_code VARCHAR(10),
    simulated_delay_ms INTEGER,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sandbox_institution ON sandbox_transactions(institution_id);
CREATE INDEX idx_sandbox_reference ON sandbox_transactions(reference_number);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to reset daily limits
CREATE OR REPLACE FUNCTION reset_daily_limits()
RETURNS void AS $$
BEGIN
    UPDATE institution_limits
    SET daily_used = 0,
        daily_reset_at = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE daily_reset_at < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly limits
CREATE OR REPLACE FUNCTION reset_monthly_limits()
RETURNS void AS $$
BEGIN
    UPDATE institution_limits
    SET monthly_used = 0,
        monthly_reset_at = DATE_TRUNC('month', CURRENT_DATE)::DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE monthly_reset_at < DATE_TRUNC('month', CURRENT_DATE)::DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired idempotency keys
CREATE OR REPLACE FUNCTION clean_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate next recurring execution
CREATE OR REPLACE FUNCTION calculate_next_execution(
    p_frequency VARCHAR(20),
    p_day_of_week INTEGER,
    p_day_of_month INTEGER,
    p_from_date TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_next TIMESTAMPTZ;
BEGIN
    CASE p_frequency
        WHEN 'DAILY' THEN
            v_next := p_from_date + INTERVAL '1 day';
        WHEN 'WEEKLY' THEN
            v_next := p_from_date + INTERVAL '1 week';
            IF p_day_of_week IS NOT NULL THEN
                v_next := DATE_TRUNC('week', v_next) + (p_day_of_week || ' days')::INTERVAL;
            END IF;
        WHEN 'BIWEEKLY' THEN
            v_next := p_from_date + INTERVAL '2 weeks';
        WHEN 'MONTHLY' THEN
            v_next := p_from_date + INTERVAL '1 month';
            IF p_day_of_month IS NOT NULL THEN
                v_next := DATE_TRUNC('month', v_next) + ((p_day_of_month - 1) || ' days')::INTERVAL;
            END IF;
        WHEN 'QUARTERLY' THEN
            v_next := p_from_date + INTERVAL '3 months';
        WHEN 'YEARLY' THEN
            v_next := p_from_date + INTERVAL '1 year';
        ELSE
            v_next := p_from_date + INTERVAL '1 month';
    END CASE;

    RETURN v_next;
END;
$$ LANGUAGE plpgsql;

-- Note: Date-based indexes removed due to PostgreSQL immutability requirements
-- The existing idx_transactions_status and other indexes provide adequate performance
