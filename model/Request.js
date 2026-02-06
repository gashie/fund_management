const pool = require("../db/dbConfig");
const { logger } = require("../logs/winston");

let npradb = {};

npradb.uniqueIds = (reference_number) => {
  return new Promise((resolve, reject) => {
    pool.query(
      `SELECT * FROM generate_unique_ids ($1)`,

      [reference_number],
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
module.exports = npradb