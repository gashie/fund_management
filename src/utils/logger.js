/**
 * Colorful, concise logger for Fund Management System
 * Logs requests, responses, external calls in structured format
 */

const { actCode } = require('../../config/actcodes');

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
// GIP Action Code Mappings (for logging display only)
// NOTE: For business logic, use gip.service.js functions instead
// (Local copy here to avoid circular dependency with gip.service)
// ============================================================================
const GIP_ACTION_CODES = actCode.reduce((map, item) => {
    map[item.code] = item.message;
    return map;
}, {});

// Async codes - request accepted, callback coming
const ASYNC_SUCCESS_CODES = ['001'];

// Success codes
const SUCCESS_CODES = ['000', '300', '480', '385'];

const getActionCodeReason = (code) => GIP_ACTION_CODES[code] || 'Unknown';
const isAsyncSuccess = (code) => ASYNC_SUCCESS_CODES.includes(code);
const isSuccessCode = (code) => SUCCESS_CODES.includes(code);

// ============================================================================
// External API Call Logger (GIP)
// ============================================================================
const gipLogger = {
    /**
     * Log outgoing GIP request with full details
     */
    request: (type, payload) => {
        const arrow = `${colors.bright}${colors.magenta}⇒⇒${colors.reset}`;
        const banks = payload.originBank && payload.destBank
            ? `${payload.originBank}→${payload.destBank}`
            : '-';
        const sess = payload.sessionId || '-';
        const track = payload.trackingNumber || '-';
        const amt = formatAmt(payload.amount);

        // Header line
        console.log(
            `${ts()} ${arrow} ${colors.bgMagenta}${colors.bright} GIP ${type} ${colors.reset} ` +
            `${colors.cyan}${banks}${colors.reset} ` +
            (amt !== '-' ? `${colors.yellow}${amt}${colors.reset}` : '')
        );

        // Details
        console.log(
            `${ts()}    ${colors.gray}├─ Session: ${sess} | Track: ${track}${colors.reset}`
        );

        // Accounts
        const srcAcc = payload.accountToDebit || '-';
        const destAcc = payload.accountToCredit || '-';
        const srcName = payload.nameToDebit || '-';
        const destName = payload.nameToCredit || '-';

        console.log(
            `${ts()}    ${colors.gray}├─ Debit: ${truncate(srcAcc, 12)} (${truncate(srcName, 15)})${colors.reset}`
        );
        console.log(
            `${ts()}    ${colors.gray}├─ Credit: ${truncate(destAcc, 12)} (${truncate(destName, 15)})${colors.reset}`
        );

        // Full payload
        console.log(
            `${ts()}    ${colors.gray}└─ Payload: ${JSON.stringify(payload)}${colors.reset}`
        );
    },

    /**
     * Log GIP response with full details
     */
    response: (type, result, duration) => {
        const code = result.actionCode || result.data?.actionCode || '???';
        const data = result.data || {};

        // Determine status
        const isSuccess = isSuccessCode(code);
        const isAsync = isAsyncSuccess(code);
        const isFail = !isSuccess && !isAsync;

        const codeColor = isFail ? colors.red : (isAsync ? colors.yellow : colors.green);
        const bgColor = isFail ? colors.bgRed : (isAsync ? colors.bgYellow : colors.bgGreen);
        const status = isSuccess ? 'SUCCESS' : (isAsync ? 'PENDING' : 'FAILED');
        const reason = getActionCodeReason(code);

        // Header line
        console.log(
            `${ts()} ${colors.bright}${colors.magenta}⇐⇐${colors.reset} ` +
            `${bgColor}${colors.bright} GIP ${type} ${colors.reset} ` +
            `${codeColor}${code} ${status}${colors.reset} ` +
            `${colors.gray}${duration}ms${colors.reset}`
        );

        // Reason line
        const approval = data.approvalCode || '';
        console.log(
            `${ts()}    ${colors.gray}├─ Reason: ${reason}${approval ? ` | ${approval}` : ''}${colors.reset}`
        );

        // NEC specific - account name
        if (result.accountName) {
            console.log(
                `${ts()}    ${colors.gray}├─ Account Name: ${colors.cyan}${result.accountName}${colors.gray}${colors.reset}`
            );
        }

        // Full response
        if (result.data) {
            console.log(
                `${ts()}    ${colors.gray}└─ Response: ${JSON.stringify(result.data)}${colors.reset}`
            );
        }
    },

    /**
     * Log GIP error (network/timeout errors)
     */
    error: (type, error, duration) => {
        console.log(
            `${ts()} ${colors.bgRed}${colors.bright} GIP ${type} ERROR ${colors.reset} ` +
            `${colors.red}${error.message || error}${colors.reset} ` +
            `${colors.gray}${duration}ms${colors.reset}`
        );
        // Log full error for debugging
        if (error.response?.data) {
            console.log(`${ts()}    ${colors.gray}├─ Response: ${JSON.stringify(error.response.data)}${colors.reset}`);
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
     * Log incoming GIP callback with full details
     */
    incoming: (payload, ip) => {
        const code = payload.actionCode || payload.action_code || '???';
        const fn = payload.functionCode || payload.function_code || '???';
        const fnName = fn === '241' ? 'FTD' : fn === '240' ? 'FTC' : fn === '242' ? 'REV' : fn;
        const session = payload.sessionId || payload.session_id || '-';
        const approval = payload.approvalCode || payload.approval_code || '';

        const isSuccess = code === '000';
        const codeColor = isSuccess ? colors.green : colors.red;
        const status = isSuccess ? 'SUCCESS' : 'FAILED';
        const reason = getActionCodeReason(code);

        console.log(
            `${ts()} ${colors.bright}${colors.yellow}◀◀${colors.reset} ` +
            `${colors.bgYellow}${colors.bright} CALLBACK ${colors.reset} ` +
            `${colors.cyan}${fnName}${colors.reset} ` +
            `${codeColor}${code} ${status}${colors.reset} ` +
            `${colors.gray}from ${ip}${colors.reset}`
        );

        // Second line: session and details
        console.log(
            `${ts()}    ${colors.gray}├─ Session: ${session}${colors.reset}`
        );

        // Third line: reason
        if (approval || reason !== 'Unknown') {
            console.log(
                `${ts()}    ${colors.gray}├─ Reason: ${approval || reason}${colors.reset}`
            );
        }

        // Fourth line: accounts and amount
        const src = payload.accountToDebit || payload.account_to_debit || '-';
        const dest = payload.accountToCredit || payload.account_to_credit || '-';
        const srcBank = payload.originBank || payload.origin_bank || '-';
        const destBank = payload.destBank || payload.dest_bank || '-';
        const amt = formatAmt(payload.amount);

        console.log(
            `${ts()}    ${colors.gray}├─ ${srcBank}:${truncate(src, 10)} → ${destBank}:${truncate(dest, 10)} | ${amt}${colors.reset}`
        );

        // Fifth line: full payload for debugging
        console.log(
            `${ts()}    ${colors.gray}└─ Payload: ${JSON.stringify(payload)}${colors.reset}`
        );
    },

    /**
     * Log callback saved
     */
    saved: (callbackId, transactionId) => {
        console.log(
            `${ts()}    ${colors.green}✓ Saved${colors.reset} ` +
            `${colors.gray}callback:${callbackId} txn:${transactionId || 'UNMATCHED'}${colors.reset}`
        );
    },

    /**
     * Log callback error
     */
    error: (msg, error) => {
        console.log(
            `${ts()}    ${colors.red}✗ ${msg}${colors.reset} ` +
            `${colors.gray}${error?.message || error}${colors.reset}`
        );
    },

    /**
     * Log incoming GIP callback (legacy - for backwards compat)
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
    ASYNC_SUCCESS_CODES,
    SUCCESS_CODES,
    getActionCodeReason,
    isAsyncSuccess,
    isSuccessCode
};
