# Fund Management System

GIP (Gateway Interbank Protocol) Fund Transfer API for interbank transactions.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment config
cp config/config.env.example config/config.env
# Edit config/config.env with your settings
```

### Database Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE fund_management;"

# Run migrations
psql -U postgres -d fund_management -f migrations/001_improved_schema.sql
psql -U postgres -d fund_management -f migrations/002_feature_tables.sql
```

### Running the Application

```bash
# Development (with hot reload)
npm run dev

# Production
npm start

# Run workers only (separate process)
npm run workers
```

## Project Structure

```
FundManagement/
├── src/                    # NEW Clean Architecture
│   ├── config/index.js     # App configuration
│   ├── models/             # Database operations ONLY
│   │   ├── db.js           # Pool & query helper
│   │   ├── institution.model.js
│   │   ├── transaction.model.js
│   │   ├── callback.model.js
│   │   ├── event.model.js
│   │   └── participant.model.js
│   ├── services/           # Business logic
│   │   ├── institution.service.js
│   │   ├── transaction.service.js
│   │   ├── callback.service.js
│   │   ├── gip.service.js
│   │   └── features/       # Optional feature services
│   ├── controllers/        # HTTP only, NO queries
│   ├── middleware/         # Auth, validation, features
│   ├── routes/index.js     # API routes
│   ├── workers/            # Background jobs
│   ├── app.js              # Express app
│   └── server.js           # Entry point
├── migrations/             # Database migrations
├── postman/                # API collection
└── config/config.env       # Environment variables
```

## Environment Configuration

Create `config/config.env`:

```env
# Server
PORT=3002
NODE_ENV=development

# Database
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=fund_management
DB_HOST=localhost
DATABASE_PORT=5432

# GIP Endpoints
GIP_BASE_URL=http://172.21.8.21:9000/SwitchGIP/WSGIP
GIP_CALLBACK_URL=http://your-server:3002/api/callback/gip
GIP_TIMEOUT=30000

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Feature Flags (optional)
FEATURE_FRAUD_DETECTION=true
FEATURE_BULK_TRANSACTIONS=true
FEATURE_SCHEDULED_TRANSFERS=true
# See src/config/index.js for all feature flags
```

## API Endpoints

### Core Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/nec` | Name Enquiry (NEC) |
| POST | `/api/ft` | Funds Transfer (FT) |
| POST | `/api/tsq` | Transaction Status Query |
| POST | `/api/callback/gip` | GIP Callback Handler |

### Institution Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/institutions` | Create institution |
| GET | `/api/institutions` | List institutions |
| POST | `/api/institutions/:id/credentials` | Generate API key |

### Transaction Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions |
| GET | `/api/transactions/:id` | Get transaction details |
| GET | `/api/stats` | Transaction statistics |

## Transaction Flow

```
Client Request
     │
     ▼
┌─────────────┐
│     NEC     │ ◄── Name Enquiry (sync, returns account name)
└─────────────┘
     │ success
     ▼
┌─────────────┐
│     FTD     │ ◄── Funds Transfer Debit (async)
└─────────────┘
     │ callback
     ▼
┌─────────────┐
│     FTC     │ ◄── Funds Transfer Credit (async)
└─────────────┘
     │ callback
     ▼
┌─────────────┐
│  COMPLETED  │ ──► Client Callback
└─────────────┘

If FTC fails:
┌─────────────┐
│  REVERSAL   │ ◄── Mandatory reversal of FTD
└─────────────┘
```

## Authentication

All API requests require authentication via API key:

```bash
curl -X POST http://localhost:3002/api/nec \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"srcBankCode":"300307","destBankCode":"300315",...}'
```

## GIP Payload Formats

### Function Codes
- **NEC**: 230
- **FTD**: 241
- **FTC**: 240
- **TSQ**: 111

### Field Mappings

| Field | NEC | FTD | FTC | Reversal |
|-------|-----|-----|-----|----------|
| originBank | src | src | **dest** | dest |
| destBank | dest | dest | **src** | src |
| accountToDebit | dest | **src** | src | dest |
| accountToCredit | src | **dest** | dest | src |
| amount | "000000000000" | 12-digit | 12-digit | 12-digit |

### Amount Format
12 digits, right-padded with zeros. Example: `200.00` → `"000000020000"`

### DateTime Format
`YYMMDDHHmmss`. Example: `"250708131045"`

### Session ID / Tracking Number
- Session ID: 12 digits
- Tracking Number: 6 digits

## Postman Collection

Import the collection from `postman/Fund_Management_API.postman_collection.json`:

1. Open Postman
2. Click Import → Upload Files
3. Select `postman/Fund_Management_API.postman_collection.json`
4. Also import the environment: `postman/Fund_Management_Local.postman_environment.json`

## Workers

Background workers process:
- **FTC Worker**: Processes FTD success → initiates FTC
- **TSQ Worker**: Transaction status queries for inconclusive responses
- **Reversal Worker**: Processes FTC failures → initiates reversals
- **Callback Worker**: Processes incoming GIP callbacks
- **Client Callback Worker**: Sends callbacks to client webhooks
- **Timeout Worker**: Marks timed-out transactions

Workers start automatically with the server. To run separately:
```bash
START_WORKERS=false npm start  # API only
npm run workers                # Workers only
```

## Feature Flags

Features can be enabled/disabled via environment variables:

| Feature | Env Variable | Default |
|---------|-------------|---------|
| Fraud Detection | `FEATURE_FRAUD_DETECTION` | true |
| Bulk Transactions | `FEATURE_BULK_TRANSACTIONS` | true |
| Scheduled Transfers | `FEATURE_SCHEDULED_TRANSFERS` | true |
| Circuit Breaker | `FEATURE_CIRCUIT_BREAKER` | false |
| Sandbox Mode | `FEATURE_SANDBOX_MODE` | false |

See `src/config/index.js` for all feature flags.

## Separating from Old Codebase

The old codebase exists in the root directory. The new clean architecture is in `src/`.

**To use only the new architecture:**

1. Update `package.json` scripts to point to `src/`:
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "workers": "START_WORKERS=only node src/server.js"
  }
}
```

2. The old files can be archived or deleted once migration is complete:
   - `server.js`, `app.js` (root)
   - `controllers/`, `repositories/`, `services/` (root)
   - `job/`, `workers/` (root, not `src/workers`)
   - `routes/`, `middleware/`, `model/` (root)

## Troubleshooting

### Database Connection Failed
- Check PostgreSQL is running
- Verify credentials in `config/config.env`
- Ensure database exists: `psql -c "\l" | grep fund_management`

### GIP Connection Failed
- Verify `GIP_BASE_URL` is correct
- Check network connectivity to GIP server
- Review firewall rules

### Workers Not Processing
- Check database has pending transactions
- Verify worker logs for errors
- Ensure `START_WORKERS` is not set to `false`

## License

ISC
