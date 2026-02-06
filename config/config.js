const dotenv = require('dotenv');

const environment = process.env.NODE_ENV || "production"

// Load environment variables
dotenv.config({ path: './config/config.env' });

const config = {
  dbType: process.env.DB_TYPE || "postgres", // Use environment variable or default to postgres
  version: process.env.VERSION || "/api/",
  service_name: process.env.SERVICE_NAME || "gip",
  GateRepo: "gateway",
  gipNedUrl: environment === 'development' ? 'http://localhost:3004/ned':process.env.GIP_TEST_URL,
  gipNecUrl: environment === 'development' ? 'http://localhost:3004/nec':process.env.GIP_TEST_URL,
  gipFtdUrl: environment === 'development' ? 'http://localhost:3004/ftd':process.env.GIP_TEST_URL,
  gipFtcUrl: environment === 'development' ? 'http://localhost:3004/ftc':process.env.GIP_TEST_URL,
  gipTsqUrl: environment === 'development' ? 'http://localhost:3004/tsq':process.env.GIP_TEST_URL,
  NEC_CODE: 230,
  FTD_CODE: 241,
  FTC_CODE: 240,
  CHANNEL_CODE: 100,
  CALLBACK_URL: "http://172.21.8.21:3002/api/gip/debit/v1/callback",
  // Add other configurations as needed
};

module.exports = config;
