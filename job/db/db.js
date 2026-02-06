

/**
 * Helper function to sleep for a given number of milliseconds.
 * Useful for throttling loops or retry logic.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const { prepareColumns } = require("../../utils/global");
const { logger } = require("../../logs/winston");
const pool = require("./pool");

const npradb = {};

/**
 * -----------
 * TRANSACTION HELPERS
 * -----------
 * These helpers let you manage transactions manually.
 *  - beginTransaction() acquires a client and starts a transaction
 *  - commitTransaction() commits and releases the client
 *  - rollbackTransaction() rolls back and releases the client
 *
 * Optionally, you can add a "transaction" wrapper function if you want.
 */


/**
 * Begin Transaction
 */
npradb.beginTransaction = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    return client;
  } catch (err) {
    client.release();
    logger.error("Error beginning transaction:", err);
    throw err;
  }
};

/**
 * Commit Transaction
 */
npradb.commitTransaction = async (client) => {
  try {
    await client.query("COMMIT");
  } catch (err) {
    logger.error("Error committing transaction:", err);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Rollback Transaction
 */
npradb.rollbackTransaction = async (client) => {
  try {
    await client.query("ROLLBACK");
  } catch (err) {
    logger.error("Error rolling back transaction:", err);
    throw err;
  } finally {
    client.release();
  }
};


// Acquire a client and start a transaction
npradb.beginTransaction = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    return client;
  } catch (err) {
    client.release();
    logger.error("Error beginning transaction:", err);
    throw err;
  }
};

// Commit and release the client
npradb.commitTransaction = async (client) => {
  try {
    await client.query("COMMIT");
  } catch (err) {
    logger.error("Error committing transaction:", err);
    throw err;
  } finally {
    client.release();
  }
};

// Roll back and release the client
npradb.rollbackTransaction = async (client) => {
  try {
    await client.query("ROLLBACK");
  } catch (err) {
    logger.error("Error rolling back transaction:", err);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * -----------
 * FINDER
 * -----------
 * Dynamically selects from a table based on conditions.
 * columnsToSelect is an array of column names, or empty for all columns.
 * conditions is an array of objects like:
 *   { column: 'status', operator: '=', value: 'PENDING', isDateColumn: false }
 *
 * @param {string} tableName
 * @param {string[]} columnsToSelect
 * @param {Array} conditions
 * @param {object} client [optional] - an existing DB client (for transactions)
 * @returns {Promise<object[]>} rows
 */
npradb.Finder = async (tableName, columnsToSelect, conditions, client = null) => {
  const usedClient = client || pool; // Use transaction client if provided

  const conditionClauses = [];
  const values = [];

  conditions.forEach((conditionObj, index) => {
    if (conditionObj.value === null) {
      conditionClauses.push(`"${conditionObj.column}" IS NULL`);
    } else if (conditionObj.isDateColumn) {
      // Example of date comparison, adapt as needed
      conditionClauses.push(`"${conditionObj.column}" >= $${index + 1}`);
      values.push(conditionObj.value);
    } else {
      conditionClauses.push(`"${conditionObj.column}" ${conditionObj.operator} $${index + 1}`);
      values.push(conditionObj.value);
    }
  });

  const selectClause = columnsToSelect.length > 0
    ? columnsToSelect.map(column => `"${column}"`).join(", ")
    : "*";
  const whereClause = conditionClauses.length > 0
    ? `WHERE ${conditionClauses.join(" AND ")}`
    : "";

  const sql = `SELECT ${selectClause} FROM "${tableName}" ${whereClause}`;

  try {
    const result = await usedClient.query(sql, values);
    return result.rows;
  } catch (err) {
    logger.error(err);
    throw err;
  }
};

/**
 * -----------
 * CREATE
 * -----------
 * Dynamically inserts a record into the specified table.
 * payload is an object { column1: value1, column2: value2, ... }
 * returnfield is optional if you need a specific returning column (or you can always return all).
 *
 * @param {object} payload
 * @param {string} table
 * @param {string} [returnfield] - unused in this snippet, but left for your usage
 * @param {object} client [optional] - transaction client
 * @returns {Promise<object>} newly inserted row
 */
npradb.Create = async (payload, table, returnfield, client = null) => {
  const usedClient = client || pool;

  const columns = Object.keys(payload);
  const params = Object.values(payload);
  const fields = columns.map((col) => `"${col}"`).join(", ");
  const placeholders = prepareColumns(columns); // e.g. $1, $2, $3...
  // Return all columns for now; if you want only specific field, adapt query
  const query = `INSERT INTO "${table}" (${fields}) VALUES (${placeholders}) RETURNING *`;

  try {
    const result = await usedClient.query(query, params);
    return result.rows[0];
  } catch (err) {
    logger.error(err);
    throw err;
  }
};

/**
 * -----------
 * UPDATE
 * -----------
 * Dynamically updates a record in the specified table based on a single field condition.
 * values is an object { column1: value1, column2: value2, ... }
 * fieldname is the condition column to match (e.g., "id")
 * fieldvalue is the condition value
 *
 * @param {object} values
 * @param {string} table
 * @param {string} fieldname - condition column
 * @param {any} fieldvalue - condition value
 * @param {object} client [optional] - transaction client
 * @returns {Promise<object>} updated row
 */
npradb.Update = async (values, table, fieldname, fieldvalue, client = null) => {
  const usedClient = client || pool;

  const columns = Object.keys(values);
  const params = [];
  let query = `UPDATE "${table}" SET `;

  columns.forEach((col, i) => {
    query += `"${col}" = $${i + 1},`;
    params.push(values[col]);
  });
  // Remove trailing comma
  query = query.slice(0, -1);

  // Condition
  // The last param is the fieldvalue for the WHERE clause
  params.push(fieldvalue);
  query += ` WHERE "${fieldname}" = $${params.length} RETURNING *`;

  try {
    const result = await usedClient.query(query, params);
    return result.rows[0];
  } catch (err) {
    logger.error(err);
    throw err;
  }
};


npradb.uniqueIdNoParam = () => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT * FROM generate_unique_ids ()`,

      [],
      (err, results) => {
        if (err) {
          logger.error(err);
          return reject(err);
        }

        return resolve(results);
      }
    );
  });
};
module.exports = npradb;




// module.exports = {
//     sleep,

// }