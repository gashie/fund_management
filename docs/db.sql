CREATE TABLE requests (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    request_type VARCHAR(50) NOT NULL, -- 'NAME_ENQUIRY' or 'FUNDS_TRANSFER'
    src_bank_code VARCHAR(10) NOT NULL,
    dest_bank_code VARCHAR(10) NOT NULL,
    src_account_number VARCHAR(20) NOT NULL,
    src_account_name VARCHAR(100), -- Optional for name enquiry
    dest_account_number VARCHAR(20) NOT NULL,
    dest_account_name VARCHAR(100), -- Optional for name enquiry
    amount NUMERIC(15, 2), -- For funds transfer (optional for name enquiry)
    narration TEXT, -- Funds transfer narration
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    request_timestamp TIMESTAMP NOT NULL,
    callback_url TEXT, -- Optional for name enquiry
    ip_address VARCHAR(45) NOT NULL, -- IPv4 or IPv6
    user_agent TEXT, -- Capture request user agent
    response_code VARCHAR(10), -- Response from powercard or GIP
    response_message TEXT, -- Response message
    session_id VARCHAR(50), -- Unique session tracking
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'FAILED', etc.
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transactions_pkey PRIMARY KEY (id)
);
CREATE TABLE request_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'REQUEST_RECEIVED', 'RESPONSE_RECEIVED', 'PUSH_TO_POWERCARD', etc.
    event_details TEXT, -- JSON or detailed text describing the event
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transaction_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE file_storage (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'TEXT', 'XML', 'CSV', etc.
    file_content BYTEA, -- Stores the file content
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'UPLOADED', 'FAILED'
    upload_attempts INTEGER NOT NULL DEFAULT 0, -- Track retries
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT file_storage_pkey PRIMARY KEY (id)
);
CREATE TABLE approvals (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    approval_type VARCHAR(50) NOT NULL, -- 'FILE_APPROVAL', 'FUNDS_APPROVAL', etc.
    request_id UUID NOT NULL, -- References transactions.id or file_storage.id
    request_type VARCHAR(50) NOT NULL, -- 'TRANSACTION', 'FILE'
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approval_date TIMESTAMP,
    expiration_date TIMESTAMP,
    comments TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT approvals_pkey PRIMARY KEY (id)
);
CREATE TABLE ftp_config (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 21,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    upload_path TEXT NOT NULL, -- Directory to upload files
    is_active BOOLEAN NOT NULL DEFAULT TRUE, -- Enable/disable the configuration
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ftp_config_pkey PRIMARY KEY (id)
);

CREATE TABLE ftp_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES file_storage(id) ON DELETE CASCADE,
    ftp_config_id UUID NOT NULL REFERENCES ftp_config(id),
    status VARCHAR(20) NOT NULL, -- 'SUCCESS', 'FAILED'
    error_message TEXT, -- If failed, capture error
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ftp_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE system_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    log_type VARCHAR(50) NOT NULL, -- 'EVENT', 'AUDIT', 'REQUEST'
    request_id UUID, -- Nullable, links to specific entities
    request_type VARCHAR(50), -- 'TRANSACTION', 'FILE', etc.
    message TEXT NOT NULL, -- Log message
    details JSONB, -- Detailed log (optional JSON format)
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT system_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.api_access
(
    id integer NOT NULL DEFAULT nextval('api_access_id_seq'::regclass),
    api_key character varying(255) COLLATE pg_catalog."default" NOT NULL,
    client_name character varying(255) COLLATE pg_catalog."default",
    allowed_endpoints jsonb DEFAULT '[]'::jsonb,
    rate_limit_per_minute integer DEFAULT 60,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    client_ip inet,
    CONSTRAINT api_access_pkey PRIMARY KEY (id),
    CONSTRAINT api_access_api_key_key UNIQUE (api_key)
)
CREATE TABLE IF NOT EXISTS public.global_config
(
    id integer NOT NULL DEFAULT nextval('global_config_id_seq'::regclass),
    cors_allowed_origins jsonb DEFAULT '[]'::jsonb,
    cors_enabled boolean DEFAULT true,
    rate_limit_global_per_minute integer DEFAULT 1000,
    ip_whitelist jsonb DEFAULT '[]'::jsonb,
    ip_blacklist jsonb DEFAULT '[]'::jsonb,
    enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    allowed_endpoints jsonb DEFAULT '"*"'::jsonb,
    CONSTRAINT global_config_pkey PRIMARY KEY (id)
)
CREATE TABLE IF NOT EXISTS public.job_config
(
    id integer NOT NULL DEFAULT nextval('job_config_id_seq'::regclass),
    max_retries integer DEFAULT 5,
    retry_interval_seconds integer DEFAULT 60,
    callback_url character varying(255) COLLATE pg_catalog."default" NOT NULL,
    email_recipient character varying(255) COLLATE pg_catalog."default",
    enabled boolean DEFAULT true,
    CONSTRAINT job_config_pkey PRIMARY KEY (id)
)

CREATE TABLE IF NOT EXISTS public.job_queue
(
    id integer NOT NULL DEFAULT nextval('job_queue_id_seq'::regclass),
    payload jsonb NOT NULL,
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'PENDING'::character varying,
    retries integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    response_data jsonb,
    error_details text COLLATE pg_catalog."default",
    callback_url text COLLATE pg_catalog."default",
    CONSTRAINT job_queue_pkey PRIMARY KEY (id)
)

CREATE TABLE IF NOT EXISTS public.logs
(
    log_id integer NOT NULL DEFAULT nextval('logs_log_id_seq'::regclass),
    service_name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    function_name character varying(200) COLLATE pg_catalog."default",
    method character varying(10) COLLATE pg_catalog."default" NOT NULL,
    url text COLLATE pg_catalog."default" NOT NULL,
    ip character varying(45) COLLATE pg_catalog."default",
    user_agent text COLLATE pg_catalog."default",
    location character varying(200) COLLATE pg_catalog."default" DEFAULT 'Unknown Location'::character varying,
    sql_action character varying(50) COLLATE pg_catalog."default",
    api_response smallint,
    response_code character varying(50) COLLATE pg_catalog."default",
    response_message text COLLATE pg_catalog."default",
    actor character varying(100) COLLATE pg_catalog."default" DEFAULT 'Unknown'::character varying,
    event character varying(100) COLLATE pg_catalog."default",
    date_started timestamp without time zone NOT NULL,
    date_ended timestamp without time zone NOT NULL,
    sid character varying(100) COLLATE pg_catalog."default",
    user_id character varying(100) COLLATE pg_catalog."default",
    device jsonb,
    device_client jsonb,
    device_info jsonb,
    response_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    response_time character varying(60) COLLATE pg_catalog."default",
    payload jsonb,
    CONSTRAINT logs_pkey PRIMARY KEY (log_id)
)

CREATE OR REPLACE FUNCTION generate_unique_ids(reference_number TEXT)
RETURNS TABLE(session_id BIGINT, tracking_number BIGINT) AS $$
DECLARE
    hash_part BIGINT;
BEGIN
    -- Generate a unique hash based on the reference_number
    hash_part := abs(hashtext(reference_number)); -- Ensures a consistent hash value

    -- Generate the session_id (12 digits) using modulo and offset for fixed length
    session_id := (hash_part % 1000000000000) + 100000000000; -- Ensures 12 digits

    -- Generate the tracking_number (6 digits) using a hash combined with modulo and offset
    tracking_number := (hash_part % 1000000) + 100000; -- Ensures 6 digits

    -- Return the generated session_id and tracking_number
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE callback (
    id                  uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    payload             JSONB NOT NULL,                 -- The entire callback payload
    amount              VARCHAR(100),
    date_time           VARCHAR(100),
    dest_bank           VARCHAR(100),
    narration           VARCHAR(255),
    session_id          VARCHAR(100),
    action_code         VARCHAR(50),
    origin_bank         VARCHAR(100),
    channel_code        VARCHAR(50),
    approval_code       VARCHAR(100),
    function_code       VARCHAR(100),
    name_to_debit       VARCHAR(255),
    name_to_credit      VARCHAR(255),
    tracking_number     VARCHAR(100),
    account_to_debit    VARCHAR(100),
    account_to_credit   VARCHAR(100),
    
    status              VARCHAR(50) DEFAULT 'PENDING',   -- PENDING, PROCESSED, FAILED, etc.
	callback_type       VARCHAR(50) DEFAULT 'INTERNAL',   -- PENDING, PROCESSED, FAILED, etc.
    created_at          TIMESTAMP DEFAULT NOW(),
    processed_at        TIMESTAMP,                      -- Set when the callback is processed
    
    incoming_url        VARCHAR(255),                   -- URL the callback came from
    outgoing_url        VARCHAR(255)                    -- URL we send callback to
);
CREATE TABLE callback (
    id                  uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    payload             JSONB NOT NULL,                 -- The entire callback payload
    amount              VARCHAR(100),
    date_time           VARCHAR(100),
    dest_bank           VARCHAR(100),
    narration           VARCHAR(255),
    session_id          VARCHAR(100),
    action_code         VARCHAR(50),
    origin_bank         VARCHAR(100),
    channel_code        VARCHAR(50),
    approval_code       VARCHAR(100),
    function_code       VARCHAR(100),
    name_to_debit       VARCHAR(255),
    name_to_credit      VARCHAR(255),
    tracking_number     VARCHAR(100),
    account_to_debit    VARCHAR(100),
    account_to_credit   VARCHAR(100),
    
    status              VARCHAR(50) DEFAULT 'PENDING',   -- PENDING, PROCESSED, FAILED, etc.
	callback_type       VARCHAR(50) DEFAULT 'INTERNAL',   -- PENDING, PROCESSED, FAILED, etc.
    created_at          TIMESTAMP DEFAULT NOW(),
    processed_at        TIMESTAMP,                      -- Set when the callback is processed
    
    incoming_url        VARCHAR(255),                   -- URL the callback came from
    outgoing_url        VARCHAR(255)                    -- URL we send callback to
);
CREATE OR REPLACE FUNCTION public.generate_unique_ids()
RETURNS TABLE(session_id BIGINT, tracking_number BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_session_id BIGINT;
    v_tracking_number BIGINT;
BEGIN
    LOOP
        -- Generate a 12-digit session_id and a 6-digit tracking_number using random numbers.
        v_session_id := (abs(random() * 1e12)::BIGINT) + 100000000000;
        v_tracking_number := (abs(random() * 1e6)::BIGINT) + 100000;
        
        -- Check that these values do not already exist in the event table.
        IF NOT EXISTS (
            SELECT 1 
            FROM event e
            WHERE e.session_id = v_session_id::text
               OR e.tracking_number = v_tracking_number::text
        ) THEN
            -- Return the generated unique pair.
            RETURN QUERY SELECT v_session_id, v_tracking_number;
            RETURN;  -- finish the function
        END IF;
    END LOOP;
END;
$$;

ALTER FUNCTION public.generate_unique_ids()
    OWNER TO postgres;
