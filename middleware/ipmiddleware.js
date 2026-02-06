const { Pool } = require('pg');
const NodeCache = require('node-cache');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'bulk_pension',
    password: 'admin',
    port: 5432
});

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // Cache with 5-minute TTL

// Function to load access control and global configuration into cache
const loadAccessControlToCache = async () => {
    console.log('Refreshing IP access control cache...');
    const apiAccessData = await pool.query('SELECT client_ip, api_key, allowed_endpoints, enabled FROM api_access WHERE enabled = TRUE');
    const globalConfigData = await pool.query('SELECT * FROM global_config WHERE enabled = TRUE LIMIT 1');

    const accessMap = {};
    apiAccessData.rows.forEach((row) => {
        accessMap[row.client_ip] = {
            api_key: row.api_key,
            allowed_endpoints: row.allowed_endpoints || "*",
            enabled: row.enabled
        };
    });

    const globalConfig = globalConfigData.rows[0] || {
        ip_whitelist: [],
        ip_blacklist: [],
        allowed_endpoints: "*"
    };

    cache.set('apiAccess', accessMap);
    cache.set('globalConfig', globalConfig);
};

// Middleware for IP-based access control
const ipAccessMiddleware = async (req, res, next) => {
    const clientIp = normalizeIp(req.ip);
    
    console.log(clientIp);
    
    const apiAccess = cache.get('apiAccess');
    const globalConfig = cache.get('globalConfig');

    if (!apiAccess || !globalConfig) {
        await loadAccessControlToCache();
    }

    // Check global IP restrictions
    const { ip_whitelist, ip_blacklist, allowed_endpoints: globalAllowedEndpoints } = cache.get('globalConfig');
    if (ip_blacklist.includes(clientIp)) {
        return res.status(403).json({ error: 'Access denied: IP blacklisted globally' });
    }

    console.log(ip_whitelist);
    
    if (ip_whitelist.length > 0 && !ip_whitelist.includes(clientIp)) {
        return res.status(403).json({ error: 'Access denied: IP not whitelisted globally' });
    }

    // Check API-specific IP access
    const clientAccess = apiAccess[clientIp];

    if (!clientAccess || !clientAccess.enabled) {
        return res.status(403).json({ error: 'Access denied: IP not authorized' });
    }

    // Check endpoint restrictions
    console.log(clientAccess.allowed_endpoints);
    
    const allowedEndpoints = clientAccess.allowed_endpoints === "*" ? globalAllowedEndpoints : clientAccess.allowed_endpoints;

    if (allowedEndpoints !== "*" && !allowedEndpoints.includes(req.path)) {
        return res.status(403).json({ error: 'Access denied: Endpoint not allowed' });
    }

    next();
};

// Initial cache load
loadAccessControlToCache();

// Periodic cache refresh
setInterval(loadAccessControlToCache, 5 * 60 * 1000); // Refresh cache every 5 minutes

const normalizeIp = (ip) => (ip === '::1' ? '127.0.0.1' : ip);




module.exports = ipAccessMiddleware;
