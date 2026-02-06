
const NodeCache = require('node-cache');
const { getItemById } = require('../helper/dynamic');

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // Cache with 5-minute TTL

// Function to load access control and global configuration into cache
const loadAccessControlToCache = async () => {
    console.log('Refreshing IP access control cache...');
    const tableName = "api_access ";
    const columnsToSelect = ["client_ip", "api_key", "allowed_endpoints", "enabled"]; // Use string values for column names
    const conditions = [{ column: "enabled", operator: "=", value: true }];
    let apiAccessData = await getItemById(tableName, columnsToSelect, conditions);

    const tableName2 = "global_config";
    const columnsToSelect2 = []; // Use string values for column names
    const conditions2 = [{ column: "enabled", operator: "=", value: true }];
    let globalConfigData = await getItemById(tableName2, columnsToSelect2, conditions2);

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
    const clientIp = req.ip;
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

    if (ip_whitelist.length > 0 && !ip_whitelist.includes(clientIp)) {
        return res.status(403).json({ error: 'Access denied: IP not whitelisted globally' });
    }

    // Check API-specific IP access
    const clientAccess = apiAccess[clientIp];

    if (!clientAccess || !clientAccess.enabled) {
        return res.status(403).json({ error: 'Access denied: IP not authorized' });
    }

    // Check endpoint restrictions
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

module.exports = ipAccessMiddleware;
