/**
 * Config Check

 * NEW FILE - save as src/config/check.js
 *
 * Set CONFIG_STRICT=true to make these warnings stop the app instead of just printing.
 */

// Values that ship with the code. If any of these are still in use, nobody set them.
const KNOWN_DEFAULTS = [
    { path: 'db.password', value: 'admin', env: 'DATABASE_PASSWORD' },
    { path: 'jwt.secret', value: 'your-secret-key', env: 'JWT_SECRET' },
    { path: 'security.encryptionKey', value: 'default-encryption-key-change-me', env: 'ENCRYPTION_KEY' }
];

const read = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

const line = (text) => console.log(`\x1b[33m[CONFIG]\x1b[0m ${text}`);
const bad = (text) => console.log(`\x1b[31m[CONFIG]\x1b[0m ${text}`);

/**
 * Check the settings and report. Returns the list of problems found.
 */
const checkConfig = (config, envFile, envLoaded) => {
    const problems = [];

    if (!envLoaded) {
        problems.push(`No settings file found at ${envFile} - every value below is a built-in default`);
    }

    for (const item of KNOWN_DEFAULTS) {
        if (read(config, item.path) === item.value) {
            problems.push(`${item.env} is still the built-in default - set it in ${envFile}`);
        }
    }

    if (!config.gip.callbackAllowedIps || config.gip.callbackAllowedIps.length === 0) {
        problems.push('GTECH_CALLBACK_IPS is empty - the callback endpoint accepts calls from anywhere');
    }

    // Always print what we are actually running with. Cheap, and it ends a lot of guessing.
    line(`settings file : ${envLoaded ? envFile : 'NONE LOADED'}`);
    line(`environment   : ${config.nodeEnv}`);
    line(`database      : ${config.db.database} on ${config.db.host}:${config.db.port}`);
    line(`GTECH url     : ${config.gip.baseUrl}`);
    line(`auto reversal : ${config.features.autoReversal ? 'ON' : 'off'}`);

    if (problems.length > 0) {
        bad(`${problems.length} problem(s):`);
        problems.forEach(p => bad(`  - ${p}`));

        if (process.env.CONFIG_STRICT === 'true') {
            bad('CONFIG_STRICT is on. Stopping.');
            process.exit(1);
        }
    }

    return problems;
};

module.exports = { checkConfig, KNOWN_DEFAULTS };
