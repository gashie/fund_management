-- ============================================================================
-- FUND MANAGEMENT SYSTEM - IMPROVED DATABASE SCHEMA
-- Version: 1.0.0
-- Date: 2026-02-05
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. INSTITUTIONS & API CREDENTIALS
-- ============================================================================

-- Drop existing table if exists (for clean migration)
DROP TABLE IF EXISTS institutions CASCADE;
DROP TABLE IF EXISTS institution_credentials CASCADE;
DROP TABLE IF EXISTS institution_rate_limits CASCADE;

-- Institutions table - stores client organizations
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_code VARCHAR(20) UNIQUE NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50),
    bank_code VARCHAR(10),  -- GIP participant code if applicable
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    webhook_url TEXT,  -- Default callback URL for this institution
    webhook_secret VARCHAR(255),  -- For webhook signature verification
    ip_whitelist JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_sandbox BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Institution API credentials
CREATE TABLE institution_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    api_key VARCHAR(64) UNIQUE NOT NULL,  -- Public key for identification
    api_secret VARCHAR(128) NOT NULL,  -- Secret key (stored hashed)
    api_secret_hash VARCHAR(255) NOT NULL,  -- bcrypt hash of secret
    name VARCHAR(100),  -- Friendly name for this credential set
    permissions JSONB DEFAULT '["nec", "ftd", "tsq"]'::jsonb,  -- Allowed operations
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,
    expires_at TIMESTAMP WITH TIME ZONE,  -- Optional expiry
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Rate limiting tracking
CREATE TABLE institution_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES institution_credentials(id) ON DELETE CASCADE,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_type VARCHAR(20) NOT NULL,  -- 'minute' or 'day'
    request_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(credential_id, window_start, window_type)
);

-- ============================================================================
-- 2. TRANSACTIONS - PROPER STATE MACHINE
-- ============================================================================

-- Transaction status enum
DROP TYPE IF EXISTS transaction_status CASCADE;
CREATE TYPE transaction_status AS ENUM (
    'INITIATED',      -- Request received, not yet processed
    'NEC_PENDING',    -- Name enquiry in progress
    'NEC_SUCCESS',    -- Name enquiry successful
    'NEC_FAILED',     -- Name enquiry failed
    'FTD_PENDING',    -- FTD sent, waiting for callback
    'FTD_TSQ',        -- FTD needs TSQ verification
    'FTD_SUCCESS',    -- FTD callback received - success
    'FTD_FAILED',     -- FTD callback received - failed
    'FTC_PENDING',    -- FTC sent, waiting for callback
    'FTC_TSQ',        -- FTC needs TSQ verification
    'FTC_SUCCESS',    -- FTC callback received - success
    'FTC_FAILED',     -- FTC callback received - failed
    'REVERSAL_PENDING', -- Reversal in progress
    'REVERSAL_SUCCESS', -- Reversal completed
    'REVERSAL_FAILED',  -- Reversal failed (CRITICAL - needs manual intervention)
    'COMPLETED',      -- Transaction fully completed
    'FAILED',         -- Transaction failed (no reversal needed)
    'TIMEOUT'         -- Transaction timed out
);

-- Main transactions table
DROP TABLE IF EXISTS transactions CASCADE;
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    credential_id UUID REFERENCES institution_credentials(id),

    -- Request identifiers
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    session_id VARCHAR(20) NOT NULL,
    tracking_number VARCHAR(10) NOT NULL,

    -- Transaction details
    transaction_type VARCHAR(20) NOT NULL,  -- 'NEC', 'FT'
    amount NUMERIC(15,2) DEFAULT 0,
    amount_formatted VARCHAR(20),  -- GIP format (12 digits)
    currency VARCHAR(3) DEFAULT 'GHS',

    -- Source account
    src_bank_code VARCHAR(10) NOT NULL,
    src_account_number VARCHAR(20) NOT NULL,
    src_account_name VARCHAR(255),

    -- Destination account
    dest_bank_code VARCHAR(10) NOT NULL,
    dest_account_number VARCHAR(20) NOT NULL,
    dest_account_name VARCHAR(255),

    -- Narration
    narration TEXT,

    -- Status tracking
    status transaction_status DEFAULT 'INITIATED',
    status_message TEXT,

    -- GIP response codes
    nec_action_code VARCHAR(10),
    ftd_action_code VARCHAR(10),
    ftc_action_code VARCHAR(10),
    reversal_action_code VARCHAR(10),

    -- Callback tracking
    client_callback_url TEXT,
    client_callback_sent BOOLEAN DEFAULT false,
    client_callback_sent_at TIMESTAMP WITH TIME ZONE,
    client_callback_response JSONB,

    -- TSQ tracking
    tsq_required BOOLEAN DEFAULT false,
    tsq_attempts INTEGER DEFAULT 0,
    tsq_last_attempt_at TIMESTAMP WITH TIME ZONE,
    tsq_next_attempt_at TIMESTAMP WITH TIME ZONE,

    -- Reversal tracking
    reversal_required BOOLEAN DEFAULT false,
    reversal_attempts INTEGER DEFAULT 0,
    reversal_session_id VARCHAR(20),
    reversal_tracking_number VARCHAR(10),

    -- Timeout tracking
    timeout_at TIMESTAMP WITH TIME ZONE,  -- When this transaction should timeout

    -- Request metadata
    client_ip VARCHAR(45),
    user_agent TEXT,
    request_timestamp TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Indexes for common queries
    CONSTRAINT valid_amount CHECK (amount >= 0)
);

CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_institution ON transactions(institution_id);
CREATE INDEX idx_transactions_reference ON transactions(reference_number);
CREATE INDEX idx_transactions_session ON transactions(session_id);
CREATE INDEX idx_transactions_tsq ON transactions(tsq_required, tsq_next_attempt_at) WHERE tsq_required = true;
CREATE INDEX idx_transactions_reversal ON transactions(reversal_required) WHERE reversal_required = true;
CREATE INDEX idx_transactions_timeout ON transactions(timeout_at) WHERE status NOT IN ('COMPLETED', 'FAILED', 'TIMEOUT');
CREATE INDEX idx_transactions_callback ON transactions(client_callback_sent) WHERE client_callback_sent = false;

-- ============================================================================
-- 3. GIP EVENTS - INDIVIDUAL API CALLS
-- ============================================================================

DROP TYPE IF EXISTS gip_event_type CASCADE;
CREATE TYPE gip_event_type AS ENUM (
    'NEC_REQUEST',
    'NEC_RESPONSE',
    'FTD_REQUEST',
    'FTD_CALLBACK',
    'FTD_TSQ_REQUEST',
    'FTD_TSQ_RESPONSE',
    'FTC_REQUEST',
    'FTC_CALLBACK',
    'FTC_TSQ_REQUEST',
    'FTC_TSQ_RESPONSE',
    'REVERSAL_REQUEST',
    'REVERSAL_CALLBACK',
    'REVERSAL_TSQ_REQUEST',
    'REVERSAL_TSQ_RESPONSE'
);

DROP TABLE IF EXISTS gip_events CASCADE;
CREATE TABLE gip_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

    event_type gip_event_type NOT NULL,
    event_sequence INTEGER NOT NULL,  -- Order of events for this transaction

    -- GIP identifiers for this specific call
    session_id VARCHAR(20),
    tracking_number VARCHAR(10),
    function_code VARCHAR(10),

    -- Request/Response data
    request_payload JSONB,
    response_payload JSONB,

    -- GIP response details
    action_code VARCHAR(10),
    approval_code VARCHAR(20),
    response_message TEXT,

    -- Timing
    request_sent_at TIMESTAMP WITH TIME ZONE,
    response_received_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, SUCCESS, FAILED, TIMEOUT
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(transaction_id, event_sequence)
);

CREATE INDEX idx_gip_events_transaction ON gip_events(transaction_id);
CREATE INDEX idx_gip_events_type ON gip_events(event_type);
CREATE INDEX idx_gip_events_session ON gip_events(session_id);

-- ============================================================================
-- 4. CALLBACKS - INCOMING FROM GIP
-- ============================================================================

DROP TABLE IF EXISTS gip_callbacks CASCADE;
CREATE TABLE gip_callbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to transaction/event
    transaction_id UUID REFERENCES transactions(id),
    gip_event_id UUID REFERENCES gip_events(id),

    -- Callback identification
    session_id VARCHAR(20) NOT NULL,
    tracking_number VARCHAR(10),
    function_code VARCHAR(10) NOT NULL,  -- 240=FTC, 241=FTD - CRITICAL for routing

    -- Callback data
    action_code VARCHAR(10),
    approval_code VARCHAR(20),
    amount VARCHAR(20),
    date_time VARCHAR(20),
    origin_bank VARCHAR(10),
    dest_bank VARCHAR(10),
    account_to_debit VARCHAR(20),
    account_to_credit VARCHAR(20),
    name_to_debit VARCHAR(255),
    name_to_credit VARCHAR(255),
    channel_code VARCHAR(10),
    narration TEXT,

    -- Raw payload
    raw_payload JSONB NOT NULL,

    -- Processing status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PROCESSED, IGNORED, ERROR
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,

    -- Metadata
    received_from_ip VARCHAR(45),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gip_callbacks_session ON gip_callbacks(session_id);
CREATE INDEX idx_gip_callbacks_function ON gip_callbacks(function_code);
CREATE INDEX idx_gip_callbacks_status ON gip_callbacks(status) WHERE status = 'PENDING';
CREATE INDEX idx_gip_callbacks_transaction ON gip_callbacks(transaction_id);

-- ============================================================================
-- 5. CLIENT CALLBACKS - OUTGOING TO INSTITUTIONS
-- ============================================================================

DROP TABLE IF EXISTS client_callbacks CASCADE;
CREATE TABLE client_callbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    institution_id UUID NOT NULL REFERENCES institutions(id),

    -- Callback details
    callback_url TEXT NOT NULL,
    callback_payload JSONB NOT NULL,

    -- Delivery tracking
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, SENT, DELIVERED, FAILED
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    next_attempt_at TIMESTAMP WITH TIME ZONE,

    -- Response from client
    response_status_code INTEGER,
    response_body TEXT,
    response_received_at TIMESTAMP WITH TIME ZONE,

    -- Error tracking
    last_error TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_callbacks_status ON client_callbacks(status, next_attempt_at)
    WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_client_callbacks_transaction ON client_callbacks(transaction_id);

-- ============================================================================
-- 6. TSQ QUEUE - FOR STATUS QUERIES
-- ============================================================================

DROP TABLE IF EXISTS tsq_queue CASCADE;
CREATE TABLE tsq_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),

    -- TSQ target
    tsq_type VARCHAR(20) NOT NULL,  -- 'FTD', 'FTC', 'REVERSAL'
    target_session_id VARCHAR(20) NOT NULL,
    target_tracking_number VARCHAR(10) NOT NULL,

    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Attempt tracking
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    last_action_code VARCHAR(10),
    last_status_code VARCHAR(10),

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PROCESSING, RESOLVED, MAX_ATTEMPTS
    resolution VARCHAR(20),  -- 'SUCCESS', 'FAILED', 'INCONCLUSIVE'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tsq_queue_status ON tsq_queue(status, scheduled_for)
    WHERE status = 'PENDING';
CREATE INDEX idx_tsq_queue_transaction ON tsq_queue(transaction_id);

-- ============================================================================
-- 7. JOB QUEUE - IMPROVED
-- ============================================================================

DROP TYPE IF EXISTS job_type CASCADE;
CREATE TYPE job_type AS ENUM (
    'PROCESS_GIP_CALLBACK',
    'SEND_CLIENT_CALLBACK',
    'RUN_TSQ',
    'PROCESS_REVERSAL',
    'CHECK_TIMEOUT'
);

DROP TABLE IF EXISTS jobs CASCADE;
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_type job_type NOT NULL,
    priority INTEGER DEFAULT 0,  -- Higher = more important

    -- Job data
    payload JSONB NOT NULL,

    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    locked_until TIMESTAMP WITH TIME ZONE,
    locked_by VARCHAR(100),

    -- Attempt tracking
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, PROCESSING, COMPLETED, FAILED, DEAD

    -- Results
    result JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_queue ON jobs(status, scheduled_for, priority DESC)
    WHERE status = 'PENDING';
CREATE INDEX idx_jobs_locked ON jobs(locked_until)
    WHERE status = 'PROCESSING';

-- ============================================================================
-- 8. AUDIT LOG - COMPREHENSIVE TRACKING
-- ============================================================================

DROP TABLE IF EXISTS audit_log CASCADE;
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What changed
    entity_type VARCHAR(50) NOT NULL,  -- 'transaction', 'institution', etc.
    entity_id UUID NOT NULL,

    -- Change details
    action VARCHAR(50) NOT NULL,  -- 'status_change', 'callback_received', etc.
    old_value JSONB,
    new_value JSONB,

    -- Context
    triggered_by VARCHAR(100),  -- 'api', 'worker', 'manual'
    triggered_by_id UUID,  -- credential_id or worker_id

    -- Additional info
    details JSONB,
    ip_address VARCHAR(45),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_time ON audit_log(created_at DESC);

-- ============================================================================
-- 9. PARTICIPANTS - GIP BANK CODES
-- ============================================================================

DROP TABLE IF EXISTS participants CASCADE;
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_code VARCHAR(10) UNIQUE NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50),
    swift_code VARCHAR(11),
    is_active BOOLEAN DEFAULT true,
    supports_nec BOOLEAN DEFAULT true,
    supports_ft BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 10. CONFIGURATION
-- ============================================================================

DROP TABLE IF EXISTS system_config CASCADE;
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100)
);

-- Insert default configurations
INSERT INTO system_config (key, value, description) VALUES
('tsq', '{
    "enabled": true,
    "initial_delay_minutes": 1,
    "interval_minutes": 5,
    "max_attempts": 3,
    "inconclusive_codes": ["909", "912", "990"]
}'::jsonb, 'TSQ worker configuration'),

('callback', '{
    "max_attempts": 5,
    "initial_delay_seconds": 5,
    "backoff_multiplier": 2,
    "max_delay_seconds": 3600
}'::jsonb, 'Client callback retry configuration'),

('timeout', '{
    "nec_seconds": 30,
    "ftd_callback_minutes": 30,
    "ftc_callback_minutes": 30,
    "transaction_hours": 24
}'::jsonb, 'Transaction timeout configuration'),

('reversal', '{
    "enabled": true,
    "auto_on_ftc_failure": true,
    "max_attempts": 3
}'::jsonb, 'Reversal configuration');

-- ============================================================================
-- 11. FUNCTIONS
-- ============================================================================

-- Function to generate unique session_id and tracking_number
CREATE OR REPLACE FUNCTION generate_transaction_ids()
RETURNS TABLE(session_id VARCHAR(20), tracking_number VARCHAR(10))
LANGUAGE plpgsql AS $$
DECLARE
    v_session_id VARCHAR(20);
    v_tracking_number VARCHAR(10);
BEGIN
    LOOP
        v_session_id := lpad(floor(random() * 900000000000 + 100000000000)::text, 12, '0');
        v_tracking_number := lpad(floor(random() * 900000 + 100000)::text, 6, '0');

        IF NOT EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.session_id = v_session_id
               OR t.tracking_number = v_tracking_number
        ) THEN
            RETURN QUERY SELECT v_session_id, v_tracking_number;
            RETURN;
        END IF;
    END LOOP;
END;
$$;

-- Function to update transaction status with audit
CREATE OR REPLACE FUNCTION update_transaction_status(
    p_transaction_id UUID,
    p_new_status transaction_status,
    p_status_message TEXT DEFAULT NULL,
    p_triggered_by VARCHAR(100) DEFAULT 'system'
)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_old_status transaction_status;
BEGIN
    SELECT status INTO v_old_status FROM transactions WHERE id = p_transaction_id;

    UPDATE transactions
    SET status = p_new_status,
        status_message = COALESCE(p_status_message, status_message),
        updated_at = CURRENT_TIMESTAMP,
        completed_at = CASE WHEN p_new_status IN ('COMPLETED', 'FAILED', 'TIMEOUT') THEN CURRENT_TIMESTAMP ELSE completed_at END
    WHERE id = p_transaction_id;

    INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, triggered_by)
    VALUES ('transaction', p_transaction_id, 'status_change',
            jsonb_build_object('status', v_old_status),
            jsonb_build_object('status', p_new_status, 'message', p_status_message),
            p_triggered_by);
END;
$$;

-- Function to format amount for GIP (12-digit padded)
CREATE OR REPLACE FUNCTION format_gip_amount(p_amount NUMERIC)
RETURNS VARCHAR(20)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN lpad(floor(p_amount * 100)::text, 12, '0');
END;
$$;

-- ============================================================================
-- 12. VIEWS FOR REPORTING
-- ============================================================================

-- Transaction summary view
CREATE OR REPLACE VIEW v_transaction_summary AS
SELECT
    t.id,
    t.reference_number,
    t.session_id,
    i.institution_name,
    t.transaction_type,
    t.amount,
    t.src_bank_code,
    t.dest_bank_code,
    t.status,
    t.nec_action_code,
    t.ftd_action_code,
    t.ftc_action_code,
    t.tsq_attempts,
    t.reversal_required,
    t.client_callback_sent,
    t.created_at,
    t.completed_at,
    EXTRACT(EPOCH FROM (COALESCE(t.completed_at, CURRENT_TIMESTAMP) - t.created_at)) as duration_seconds
FROM transactions t
JOIN institutions i ON t.institution_id = i.id;

-- Daily statistics view
CREATE OR REPLACE VIEW v_daily_stats AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as successful,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
    COUNT(*) FILTER (WHERE status = 'TIMEOUT') as timeout,
    COUNT(*) FILTER (WHERE reversal_required) as reversals,
    SUM(amount) FILTER (WHERE status = 'COMPLETED') as total_amount_success,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_duration_seconds
FROM transactions
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Pending transactions requiring attention
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

-- ============================================================================
-- 13. TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_institutions_updated_at
    BEFORE UPDATE ON institutions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
