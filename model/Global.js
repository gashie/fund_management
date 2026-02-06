const pool = require("../db/dbConfig");
const { prepareColumns } = require("../utils/global");
const { logger } = require("../logs/winston");

let npradb = {};



npradb.Finder = (tableName, columnsToSelect, conditions) => {
    return new Promise((resolve, reject) => {
        // Build the dynamic SQL query with the dynamic conditions
        const conditionClauses = [];
        const values = [];

        conditions.forEach((conditionObj, index) => {
            if (conditionObj.value === null) {
                conditionClauses.push(`"${conditionObj.column}" IS NULL`);
            } else if (conditionObj.isDateColumn) {
                conditionClauses.push(`"${conditionObj.column}" >= $${index + 1}`);
                values.push(conditionObj.value);
            } else {
                conditionClauses.push(`"${conditionObj.column}" ${conditionObj.operator} $${index + 1}`);
                values.push(conditionObj.value);
            }
        });

        const selectClause = columnsToSelect.length > 0 ? columnsToSelect.map(column => `"${column}"`).join(', ') : '*';

        const whereClause = conditionClauses.length > 0 ? `WHERE ${conditionClauses.join(' AND ')}` : '';

        const sql = `SELECT ${selectClause} FROM "${tableName}" ${whereClause}`;

        pool.query(sql, values, (err, results) => {
            if (err) {
                logger.error(err);
                return reject(err);
            }

            return resolve(results);
        });
    });
};







npradb.Create = (payload, table, returnfield) => {
    let columns = Object.keys(payload)
    let params = Object.values(payload)
    let fields = columns.toString()
    let values = prepareColumns(columns)
    let query = `INSERT INTO ${table} (${fields}) VALUES (${values}) RETURNING *`
    return new Promise((resolve, reject) => {
        pool.query(query, params, (err, results) => {
            if (err) {
                logger.error(err);
                return reject(err);
            }

            return resolve(results);
        });
    });
};




npradb.Update = (values, table, fieldname, fiedlvalue) => {
    let columns = Object.keys(values);
    let params = [fiedlvalue];
    let query = `UPDATE ${table} SET `;
    for (let i = 0; i < columns.length; i++) {
        query = `${query}${columns[i]} = $${params.length + 1},`
        params.push(values[columns[i]]);
    }
    query = `${query.substring(0, query.length - 1)} WHERE ${fieldname} = $1 RETURNING *`

    return new Promise((resolve, reject) => {
        pool.query(query, params, (err, results) => {
            if (err) {
                logger.error(err);
                return reject(err);
            }

            return resolve(results);
        });
    });
};

npradb.Execute = (sql, values, client = null) => {
    return new Promise((resolve, reject) => {
        const queryOptions = {
            text: sql,
            values: values
        };

        const executeQuery = client ? client.query(queryOptions) : pool.query(queryOptions);

        executeQuery
            .then(results => resolve(results))
            .catch(err => {
                logger.error(err);
                reject(err);
            });
    });
};

npradb.CreateWithTransaction = async (payload, table) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN"); // Start transaction

        let columns = Object.keys(payload);
        let params = Object.values(payload);
        let fields = columns.toString();
        let values = prepareColumns(columns);
        let query = `INSERT INTO ${table} (${fields}) VALUES (${values}) RETURNING *`;

        const result = await client.query(query, params);

        await client.query("COMMIT"); // Commit only if everything succeeds
        return result.rows[0];
    } catch (err) {
        await client.query("ROLLBACK"); // Undo changes if there's an error
        logger.error(`❌ Transaction Failed in ${table}:`, err);
        throw new Error(`Transaction Failed: ${err.message}`);
    } finally {
        client.release(); // Always release the client
    }
};

module.exports = npradb