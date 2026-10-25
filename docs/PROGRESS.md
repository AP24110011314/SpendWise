# Progress Log

Claude Code: update this file at the end of every phase. Keep entries short and factual.

## Status
| Phase | Title | Status | Commit |
|---|---|---|---|
| 0 | Scaffold | ✅ | |
| 1 | Auth & Categories | ✅ | |
| 2 | Transactions | ✅ | |
| 3 | Analytics & Dashboard | ✅ | |
| 4 | Budgets & Notifications | ☐ | |
| 5 | Recurring Transactions | ☐ | |
| 6 | CSV Import / Export | ☐ | |
| 7 | Forecast & Comparison | ☐ | |
| 8 | Seed, Polish, Production | ☐ | |

## Phase notes
### Phase 0 — Scaffold
- Initialized npm workspaces monorepo with `server` and `client` packages
- Set up ESLint flat config + Prettier
- Configured Vitest with mongodb-memory-server for server tests
- Created base Express app with helmet, cors, pino logging, cookie-parser
- Added Mongoose models: User, Category, Transaction, Budget, RecurringRule, ImportBatch
- Created db config with connection logic
- Added env validation with Zod
- Created ApiError utility and error handling middleware
- Created validate middleware for Zod validation of body/query/params

### Phase 1 — Auth & Categories
- **Auth service**: register, login, logout, getMe, updateMe, changePassword with JWT in httpOnly cookies
- **Auth routes**: POST /register, POST /login, POST /logout, GET /me, PATCH /me, PATCH /me/password with Zod validation
- **Rate limiting**: authRateLimit (10/15min), apiRateLimit (200/min) — higher limits in test mode
- **Default categories**: 15 categories seeded on user registration (5 income, 10 expense including Subscriptions)
- **Category service**: CRUD + reassign-on-delete logic for transactions, budgets, recurring rules
- **Category routes**: GET (list with type filter), POST, GET/:id, PATCH/:id, DELETE/:id with full Zod validation
- Fixed duplicate email index warning (removed explicit index() call)
- Fixed test setup to call connectDB() after app creation
- Fixed ApiError code from 'UNAUTHENTICATED' to 'UNAUTHORIZED'
- Fixed register to not return passwordHash
- Fixed validate middleware usage in category routes (params validation)

**Tests**: 42 server tests passing (19 auth + 22 category + 1 health), 1 client test passing

### Phase 2 — Transactions
- **Transaction service**: CRUD operations, list with filters (type, category, date range, amount range, search), pagination, sorting, bulk delete, fingerprint-based deduplication
- **Transaction routes**: POST /, GET / (with query filters), GET /:id, PATCH /:id, DELETE /:id, POST /bulk-delete with full Zod validation
- **Category/type consistency validation**: transactions can only use categories of matching type
- **Ownership checks**: all queries scoped by userId; users cannot access other users' transactions
- **Fingerprint deduplication**: SHA1-based fingerprint prevents duplicate transactions (same date, type, amount, note)
- Fixed auth middleware to set req.userId for service layer
- Fixed amountSchema to use z.coerce.number() for query parameter parsing

**Tests**: 76 server tests passing (19 auth + 22 category + 34 transaction + 1 health), 1 client test passing

### Phase 3 — Analytics & Dashboard
- **Analytics service**: summary, by-category, trend (last N months, zero-filled), daily series with cumulative expenses, month-over-month comparison with delta and percentage
- **Date utilities**: timezone-aware month ranges (Asia/Kolkata default), day-of-month, month shifting, zero-filling helpers using Luxon
- **Analytics routes**: GET /summary, /by-category, /trend, /daily, /compare with full Zod validation and optional month parameters
- **MongoDB aggregation pipelines**: $match by userId and timezone-aware date ranges, $group with $dateToString using timezone, $lookup for category details, zero-filling in JS
- **Fixed ObjectId comparison bug**: categoryId converted to string in aggregation ($toString) for proper Set deduplication in compare function

**Tests**: 96 server tests passing (19 auth + 22 category + 34 transaction + 20 analytics + 1 health), 1 client test passing

## Decisions
- Money stored as integer minor units (cents/paise), converted only at UI edge
- JWT in httpOnly cookies (7-day expiry) with secure flag in production
- mongodb-memory-server for isolated, fast test runs
- No multi-document transactions; use unique indexes and idempotent operations
- All queries scoped by userId; ownership verified in services/controllers

## Known issues / follow-ups
- Minor ESLint warnings about unused `afterEach` in test files (non-blocking)
