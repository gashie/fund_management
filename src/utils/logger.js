/**
 * Colorful, concise logger for Fund Management System
 * Logs requests, responses, external calls in structured format
 */

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m'
};

// Status code color
const statusColor = (code) => {
    if (code >= 500) return colors.red;
    if (code >= 400) return colors.yellow;
    if (code >= 300) return colors.cyan;
    if (code >= 200) return colors.green;
    return colors.white;
};

// Method color
const methodColor = (method) => {
    const map = {
        GET: colors.green,
        POST: colors.blue,
        PUT: colors.yellow,
        DELETE: colors.red,
        PATCH: colors.magenta
    };
    return map[method] || colors.white;
};

// Timestamp (HH:mm:ss)
const ts = () => {
    const now = new Date();
    return `${colors.gray}${now.toTimeString().slice(0, 8)}${colors.reset}`;
};

// Truncate string
const truncate = (str, len = 50) => {
    if (!str) return '-';
    const s = String(str);
    return s.length > len ? s.slice(0, len) + '...' : s;
};

// Format amount nicely
const formatAmt = (amt) => {
    if (!amt || amt === '000000000000') return '-';
    const num = parseInt(amt) / 100;
    return `GHS ${num.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;
};

// Create base logger
const createLogger = (prefix = '', color = colors.cyan) => ({
    info: (msg, data) => {
        const extra = data ? ` ${colors.gray}${JSON.stringify(data)}${colors.reset}` : '';
        console.log(`${ts()} ${color}${prefix}${colors.reset} ${msg}${extra}`);
    },
    success: (msg, data) => {
        const extra = data ? ` ${colors.gray}${JSON.stringify(data)}${colors.reset}` : '';
        console.log(`${ts()} ${colors.green}${prefix}${colors.reset} ${msg}${extra}`);
    },
    warn: (msg, data) => {
        const extra = data ? ` ${colors.gray}${JSON.stringify(data)}${colors.reset}` : '';
        console.log(`${ts()} ${colors.yellow}${prefix}${colors.reset} ${colors.yellow}${msg}${colors.reset}${extra}`);
    },
    error: (msg, err) => {
        const errorMsg = err?.message || (typeof err === 'string' ? err : '');
        console.log(`${ts()} ${colors.red}${prefix}${colors.reset} ${colors.red}${msg}${colors.reset}${errorMsg ? ` - ${errorMsg}` : ''}`);
    },
    debug: (msg, data) => {
        if (process.env.NODE_ENV === 'development') {
            const extra = data ? ` ${JSON.stringify(data)}` : '';
            console.log(`${ts()} ${colors.gray}${prefix} ${msg}${extra}${colors.reset}`);
        }
    }
});

// ============================================================================
// HTTP Request Logger
// ============================================================================
const httpLogger = {
    /**
     * Log incoming request
     * Format: HH:mm:ss ← POST /api/nec 192.168.1.1 [INST-CODE] ref:ABC123
     */
    request: (req) => {
        const method = req.method;
        const path = req.originalUrl || req.url;
        const ip = req.ip?.replace('::ffff:', '') || req.connection?.remoteAddress || '-';
        const inst = req.institution?.institutionCode || req.headers['x-api-key']?.slice(0, 8) || '-';
        const ref = req.body?.referenceNumber || req.body?.reference_number || '';

        const refStr = ref ? ` ${colors.cyan}ref:${truncate(ref, 20)}${colors.reset}` : '';

        console.log(
            `${ts()} ${colors.bright}${colors.blue}←${colors.reset} ` +
            `${methodColor(method)}${method.padEnd(6)}${colors.reset} ` +
            `${colors.white}${truncate(path, 30)}${colors.reset} ` +
            `${colors.gray}${ip}${colors.reset} ` +
            `${colors.yellow}[${inst}]${colors.reset}` +
            refStr
        );
    },

    /**
     * Log outgoing response
     * Format: HH:mm:ss → 200 POST /api/nec 45ms
     */
    response: (req, res, duration) => {
        const method = req.method;
        const path = req.originalUrl || req.url;
        const status = res.statusCode;
        const sColor = statusColor(status);

        console.log(
            `${ts()} ${colors.bright}${colors.green}→${colors.reset} ` +
            `${sColor}${status}${colors.reset} ` +
            `${methodColor(method)}${method.padEnd(6)}${colors.reset} ` +
            `${colors.white}${truncate(path, 30)}${colors.reset} ` +
            `${colors.gray}${duration}ms${colors.reset}`
        );
    },

    /**
     * Log request with body details (for important endpoints)
     */
    requestDetail: (req) => {
        const b = req.body || {};
        const details = [];

        if (b.srcBankCode) details.push(`${b.srcBankCode}→${b.destBankCode || '?'}`);
        if (b.destAccountNumber) details.push(`acc:${truncate(b.destAccountNumber, 10)}`);
        if (b.amount) details.push(`amt:${formatAmt(b.amount)}`);

        if (details.length) {
            console.log(`${ts()}    ${colors.gray}├─ ${details.join(' | ')}${colors.reset}`);
        }
    }
};

// ============================================================================
// GIP Action Code Mappings (GhIPSS)
// ============================================================================
const GIP_ACTION_CODES = {
    '000': 'Success',
    '001': 'Invalid/Missing field',
    '003': 'Invalid amount',
    '005': 'Do not honor',
    '012': 'Invalid transaction',
    '013': 'Invalid amount',
    '014': 'Invalid account number',
    '030': 'Format error',
    '051': 'Insufficient funds',
    '054': 'Expired card',
    '055': 'Incorrect PIN',
    '056': 'No card record',
    '057': 'Transaction not permitted',
    '058': 'Terminal not permitted',
    '061': 'Exceeds limit',
    '065': 'Exceeds frequency limit',
    '068': 'Timeout - late response',
    '075': 'PIN tries exceeded',
    '091': 'Issuer unavailable',
    '092': 'Destination not found',
    '094': 'Duplicate transaction',
    '096': 'System malfunction',
    '381': 'Not at receiving institution',
    '909': 'System error',
    '912': 'Issuer unavailable',
    '990': 'Being processed',
    '999': 'Validation error'
};

const getActionCodeReason = (code) => GIP_ACTION_CODES[code] || 'Unknown error';

// ============================================================================
// External API Call Logger (GIP)
// ============================================================================
const gipLogger = {
    /**
     * Log outgoing GIP request
     * Format: HH:mm:ss ⇒ GIP NEC 300307→300304 sess:ABC123
     */
    request: (type, payload) => {
        const arrow = `${colors.bright}${colors.magenta}⇒${colors.reset}`;
        const banks = payload.originBank && payload.destBank
            ? `${payload.originBank}→${payload.destBank}`
            : '-';
        const sess = payload.sessionId ? `sess:${truncate(payload.sessionId, 12)}` : '';
        const amt = payload.amount !== '000000000000' ? formatAmt(payload.amount) : '';

        console.log(
            `${ts()} ${arrow} ${colors.magenta}GIP${colors.reset} ` +
            `${colors.bright}${type.padEnd(4)}${colors.reset} ` +
            `${colors.cyan}${banks}${colors.reset} ` +
            `${colors.gray}${sess}${colors.reset}` +
            (amt ? ` ${colors.yellow}${amt}${colors.reset}` : '')
        );
    },

    /**
     * Log GIP response
     * Format: HH:mm:ss ⇐ GIP NEC 000 SUCCESS 125ms
     * For failures: shows reason why
     */
    response: (type, result, duration) => {
        const arrow = `${colors.bright}${colors.magenta}⇐${colors.reset}`;
        const code = result.actionCode || result.data?.actionCode || '???';
        const codeColor = code === '000' ? colors.green : colors.red;
        const status = code === '000' ? 'OK' : 'FAIL';

        // Get reason for the code
        const reason = getActionCodeReason(code);

        // Extra info based on response type
        let extra = '';
        if (result.accountName) {
            extra = ` ${colors.gray}name:${truncate(result.accountName, 15)}${colors.reset}`;
        } else if (code !== '000') {
            // Show reason for failures
            extra = ` ${colors.red}[${reason}]${colors.reset}`;
            // Show additional details from GIP response if available
            const data = result.data || {};
            if (data.statusCode) extra += ` ${colors.gray}status:${data.statusCode}${colors.reset}`;
            if (data.errorMessage) extra += ` ${colors.gray}${truncate(data.errorMessage, 30)}${colors.reset}`;
            if (data.message) extra += ` ${colors.gray}${truncate(data.message, 30)}${colors.reset}`;
        }

        console.log(
            `${ts()} ${arrow} ${colors.magenta}GIP${colors.reset} ` +
            `${colors.bright}${type.padEnd(4)}${colors.reset} ` +
            `${codeColor}${code}${colors.reset} ` +
            `${codeColor}${status}${colors.reset} ` +
            `${colors.gray}${duration}ms${colors.reset}` +
            extra
        );

        // For failures, log full response on next line for debugging
        if (code !== '000' && result.data) {
            console.log(`${ts()}    ${colors.gray}└─ Response: ${JSON.stringify(result.data)}${colors.reset}`);
        }
    },

    /**
     * Log GIP error (network/timeout errors)
     */
    error: (type, error, duration) => {
        console.log(
            `${ts()} ${colors.red}⇐ GIP ${type} ERROR${colors.reset} ` +
            `${colors.red}${error.message || error}${colors.reset} ` +
            `${colors.gray}${duration}ms${colors.reset}`
        );
        // Log full error for debugging
        if (error.response?.data) {
            console.log(`${ts()}    ${colors.gray}└─ Response: ${JSON.stringify(error.response.data)}${colors.reset}`);
        }
        if (error.code) {
            console.log(`${ts()}    ${colors.gray}└─ Error code: ${error.code}${colors.reset}`);
        }
    }
};

// ============================================================================
// Transaction Logger
// ============================================================================
const txnLogger = {
    /**
     * Log transaction state change
     */
    status: (txnId, fromStatus, toStatus) => {
        const id = truncate(txnId, 12);
        console.log(
            `${ts()} ${colors.cyan}TXN${colors.reset} ` +
            `${colors.gray}${id}${colors.reset} ` +
            `${colors.yellow}${fromStatus || 'NEW'}${colors.reset} → ` +
            `${colors.green}${toStatus}${colors.reset}`
        );
    },

    /**
     * Log transaction created
     */
    created: (txn) => {
        const id = truncate(txn.id, 12);
        const ref = truncate(txn.reference_number || txn.referenceNumber, 15);
        const type = txn.transaction_type || txn.transactionType;

        console.log(
            `${ts()} ${colors.green}TXN${colors.reset} ` +
            `${colors.bright}NEW${colors.reset} ` +
            `${colors.cyan}${type}${colors.reset} ` +
            `${colors.gray}id:${id} ref:${ref}${colors.reset}`
        );
    }
};

// ============================================================================
// Callback Logger
// ============================================================================
const callbackLogger = {
    /**
     * Log incoming GIP callback
     */
    received: (sessionId, actionCode, functionCode) => {
        const code = actionCode || '???';
        const codeColor = code === '000' ? colors.green : colors.red;
        const fn = functionCode === '241' ? 'FTD' : functionCode === '240' ? 'FTC' : functionCode;

        console.log(
            `${ts()} ${colors.bright}${colors.yellow}◀${colors.reset} ` +
            `${colors.yellow}CALLBACK${colors.reset} ` +
            `${colors.cyan}${fn}${colors.reset} ` +
            `${codeColor}${code}${colors.reset} ` +
            `${colors.gray}sess:${truncate(sessionId, 12)}${colors.reset}`
        );
    },

    /**
     * Log outgoing client callback
     */
    sending: (url, status) => {
        console.log(
            `${ts()} ${colors.bright}${colors.yellow}▶${colors.reset} ` +
            `${colors.yellow}WEBHOOK${colors.reset} ` +
            `${colors.gray}${truncate(url, 40)}${colors.reset} ` +
            `${colors.cyan}${status}${colors.reset}`
        );
    }
};

// ============================================================================
// Worker Logger
// ============================================================================
const workerLogger = (name) => {
    const color = {
        'FTC': colors.blue,
        'TSQ': colors.cyan,
        'CALLBACK': colors.yellow,
        'CLEANUP': colors.gray,
        'MONITORING': colors.magenta
    }[name] || colors.cyan;

    return {
        ...createLogger(`[${name}]`, color),
        task: (msg, count) => {
            if (count > 0) {
                console.log(`${ts()} ${color}[${name}]${colors.reset} ${msg} ${colors.bright}(${count})${colors.reset}`);
            }
        }
    };
};

// Default loggers
const logger = createLogger('APP', colors.blue);
const system = createLogger('SYS', colors.magenta);
const db = createLogger('DB', colors.magenta);

module.exports = {
    colors,
    logger,
    system,
    db,
    createLogger,
    workerLogger,
    httpLogger,
    gipLogger,
    txnLogger,
    callbackLogger,
    // Utilities
    truncate,
    formatAmt,
    statusColor,
    methodColor,
    // GIP codes
    GIP_ACTION_CODES,
    getActionCodeReason
};
