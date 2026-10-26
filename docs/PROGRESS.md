# Progress Log

Claude Code: update this file at the end of every phase. Keep entries short and factual.

## Status
| Phase | Title | Status | Commit |
|---|---|---|---|
| 0 | Scaffold | ✅ | |
| 1 | Auth & Categories | ✅ | |
| 2 | Transactions | ✅ | |
| 3 | Analytics & Dashboard | ✅ | |
| 4 | Budgets & Notifications | ✅ | |
| 5 | Recurring Transactions | ✅ | |
| 6 | CSV Import / Export | ✅ | |
| 7 | Forecast & Comparison | ✅ | |
| 8 | Seed, Polish, Production | ✅ | |

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

### Phase 4 — Budgets & Notifications
- **Budget service**: CRUD operations, progress aggregation pipeline with $lookup to transactions and categories, evaluateBudgets after transaction changes, copyBudgets for month-to-month duplication
- **Notification service**: auto-create budget_warning (at alertThreshold %) and budget_exceeded (>=100%) notifications, list/mark-read/mark-all-read with 50-item limit
- **Budget routes**: POST /budgets, GET /budgets?month, GET /budgets/:id, PATCH /budgets/:id, DELETE /budgets/:id, GET /budgets/progress?month, POST /budgets/copy, GET /budgets/notifications?unreadOnly, PATCH /budgets/notifications/:id/read, POST /budgets/notifications/read-all
- **Budget evaluation hook**: integrated into transaction service create/update/delete/bulk-delete — re-evaluates affected category/month combinations (handles category/month changes on update)
- **MongoDB aggregation**: progress pipeline calculates spent, remaining, percentage, status (ok/warning/exceeded) per budget with category name/color via $lookup
- **Fixed currentMonth parameter order bug**: was passing date as timezone parameter; corrected to currentMonth('Asia/Kolkata', date)
- Route ordering: notifications routes placed before /:id routes to avoid "notifications" matching as invalid ObjectId

**Tests**: 131 server tests passing (19 auth + 22 category + 34 transaction + 20 analytics + 35 budget + 1 health), 1 client test passing

### Phase 5 — Recurring Transactions
- **RecurringRule model**: frequency (daily/weekly/monthly/yearly), startDate, endDate, anchorDay (day of month), nextRunAt, active flag
- **Recurring service**: CRUD operations, processDueRules with catch-up logic using nextOccurrence and getDueOccurrences utilities, processRuleNow for manual trigger
- **Recurring routes**: POST /recurring, GET /recurring?activeOnly, GET /recurring/:id, PATCH /recurring/:id, DELETE /recurring/:id, POST /recurring/process, POST /recurring/:id/process with full Zod validation
- **Cron job**: node-cron runs processDueRules every 15 minutes; startup catch-up runs on server start to handle missed occurrences during downtime
- **Date utilities**: nextOccurrence handles clamping for month-end dates (Jan 31 -> Feb 28/29, Mar 31); getDueOccurrences generates all overdue occurrences for catch-up; both use Luxon with Asia/Kolkata timezone
- **Deduplication**: fingerprint-based (SHA1 of userId, categoryId, type, amount, date, note) prevents duplicate transaction creation
- **Integration**: category/type validation on create/update; ownership checks; category reassign-on-delete propagates to recurring rules
- **Fixed monthly clamping**: uses Luxon's daysInMonth property for correct target month day count
- **Fixed dateOnlySchema**: accepts YYYY-MM-DD format for startDate/endDate (not full ISO datetime)
- **Fixed query param coercion**: activeOnly uses z.coerce.boolean()

**Tests**: 154 server tests passing (19 auth + 22 category + 34 transaction + 20 analytics + 35 budget + 23 recurring + 1 health), 1 client test passing

### Phase 6 — CSV Import / Export
- **Import service**: previewImport, commitImport, undoImport, exportTransactions with full fingerprint deduplication
- **Delimiter auto-detection**: handles comma, semicolon, tab, pipe delimiters (European formats supported)
- **Amount parsing**: single column (signed amounts) and split debit/credit columns; European number format (1.234,56)
- **Date parsing**: 12+ formats including ISO, DD/MM/YYYY, MM/DD/YYYY, DD.MM.YYYY, DD MMM YYYY, etc.
- **Category resolution**: find or create category by name from CSV, type-aware defaults
- **Preview endpoint**: POST /api/import/preview returns suggested mapping, validation errors with row numbers
- **Commit endpoint**: POST /api/import/commit creates ImportBatch record, bulk inserts transactions, skips duplicates via fingerprint
- **Undo endpoint**: POST /api/import/:id/undo deletes exact batch transactions using createdAt window
- **History endpoint**: GET /api/import/history lists all import batches with counts
- **Export endpoint**: GET /api/import/export?month&type&categoryId&amountMin&amountMax&search returns CSV with headers
- **Multer integration**: 5MB limit, memory storage, CSV-only file filter, proper 400 errors for bad files
- **Round-trip tested**: exported CSV re-imports cleanly, all rows skipped as duplicates
- **Fixed delimiter detection bug**: parseCsv default parameter prevented detectDelimiter call
- **Fixed fingerprint signature**: consolidated to utils/fingerprint.js with object parameter (userId, categoryId, type, amount, date, note)
- **Fixed multer error handling**: non-CSV/oversized files now return 400 not 500

**Tests**: 171 server tests passing (19 auth + 22 category + 34 transaction + 20 analytics + 35 budget + 23 recurring + 17 import + 1 health), 1 client test passing

### Phase 7 — Forecast & Comparison
- **Forecast service**: getForecast(userId, now, tz) implementing AGGREGATIONS.md section 9 specification
- **Run-rate projection**: spent_c + (variableSpent_c / e) * r + upcomingRecurring_c
- **History projection (WMA)**: weighted moving average of last 3 complete months with weights 0.5, 0.3, 0.2 (most recent gets 0.5)
- **Blend**: α = e / D; projected = α * runRate + (1-α) * max(WMA, spent + upcomingRecurring)
- **Floor**: projected = max(projected, spent + upcomingRecurring); never returns NaN
- **Upcoming recurring**: computes future occurrences from active RecurringRule within current month
- **Recurring spend separation**: distinguishes variable spend vs recurring-generated spend in current month
- **Confidence levels**: low (e < 5 or no history), medium (e >= 5, history < 3), high (e >= 10, 3 months history)
- **Budget integration**: overall budget (categoryId: null) checked for willExceed
- **Categories with only upcoming recurring**: included in forecast even with zero current spend
- **Testable with fixed clock**: accepts `now` parameter for deterministic testing
- **Endpoint**: GET /api/analytics/forecast with optional `now` query param for testing

**Tests**: 182 server tests passing (19 auth + 22 category + 34 transaction + 20 analytics + 35 budget + 23 recurring + 17 import + 11 forecast + 1 health), 1 client test passing

## Decisions
- Money stored as integer minor units (cents/paise), converted only at UI edge
- JWT in httpOnly cookies (7-day expiry) with secure flag in production
- mongodb-memory-server for isolated, fast test runs
- No multi-document transactions; use unique indexes and idempotent operations
- All queries scoped by userId; ownership verified in services/controllers

### Phase 8 — Seed, Polish, Production
- **Seed script**: Created `server/src/scripts/seed.js` with demo user, ~6 months of transactions, 5 recurring rules (rent, utilities, subscriptions, weekly groceries, yearly insurance), budgets for all categories + overall budget, Entertainment category over budget
- **Dashboard with real data**: Updated Dashboard to use TanStack Query hooks fetching from analytics endpoints (summary, by-category, trend, daily, forecast)
- **Charts**: Implemented PieChart (category breakdown), BarChart (income vs expenses trend), AreaChart (daily cumulative spend), Budget progress bars, Forecast cards with confidence indicators
- **Loading/Empty/Error states**: Dashboard shows skeleton loaders while fetching, EmptyState for no data, ErrorState with retry button
- **Production serving**: Updated `server/src/server.js` to serve `client/dist` static files in production with SPA fallback
- **Accessibility**: Added ARIA roles (role="status", role="alert", role="progressbar"), proper labels, semantic HTML
- **Dark mode**: Works via Tailwind's `dark:` class (uses `class` strategy in tailwind.config.js)

**Tests**: 182 server tests passing, 1 client test passing
**Lint**: Clean (0 errors, warnings only)
**Build**: Client builds successfully

## Known issues / follow-ups
- Minor ESLint warnings about unused variables in test files and some source files (non-blocking)
- Client bundle size warning (>500KB) - could be improved with code splitting

### Phase 8+ — Auth Flow Fix (2026-10-26)
- **Root cause**: Vite was silently falling back from port 5173 to 5174 when 5173 was in use (no `strictPort: true`). The server CORS config only allowed a single origin from `CLIENT_ORIGIN` and would throw a 500 error when receiving requests from an unallowed origin (like `http://localhost:5174`), instead of gracefully handling it. The demo password `Demo@1234` was weak and appeared in public breach lists, triggering Chrome's "password found in a data breach" warning.
- **Fix**:
  1. Added `strictPort: true` to `client/vite.config.js` so Vite fails with a clear message instead of silently moving to another port
  2. Updated `server/src/app.js` CORS config to:
     - Accept comma-separated list of origins from `CLIENT_ORIGIN`
     - In development, always also allow `http://localhost:5173`, `http://localhost:5174`, `http://127.0.0.1:5173`, `http://127.0.0.1:5174`
     - Allow requests with no Origin header
     - Disallowed origins respond without CORS headers (or 403 with standard error envelope), never pass an Error to next()
  3. Updated `server/.env.example`, `docs/ARCHITECTURE.md`, `docs/SETUP.md` with `CLIENT_ORIGIN=http://localhost:5173,http://localhost:5174`
  4. Added troubleshooting line to SETUP.md: "Port 5173 in use → stop the old dev server (lsof -i :5173) instead of using another port"
  5. Changed seeded demo password to a strong unique password `Sw!Demo-7rK2#vQ9xLm` in `server/src/scripts/seed.js`, README.md, docs/PROGRESS.md, docs/SETUP.md
  6. Added proper autocomplete attributes: login form email `autoComplete="username"`, password `autoComplete="current-password"`; register form email `autoComplete="username"`, password `autoComplete="new-password"`; added `name` attributes to all fields
  7. Added note in README.md that Chrome's breach warning is Chrome's feature, not an app error
  8. Added tests: login success sets httpOnly cookie; wrong password returns 401; /auth/me without cookie returns 401; request from Origin http://localhost:5174 does not return 500 in development
- **Verification**: All 185 server tests + 1 client test pass, lint clean (0 errors), browser flow works: login at http://localhost:5173 → dashboard loads → refresh (stay logged in) → logout

### Phase 8++ — API Port Migration (2026-10-26)
- **Reason**: Port 5000 occupied on developer machine (macOS ControlCenter/AirPlay)
- **Changes**:
  1. Updated `server/.env.example` PORT from 5000 to 5001
  2. Updated `server/.env` PORT to 5001
  3. Updated `server/src/config/env.js` default PORT from 5000 to 5001
  4. Updated `client/vite.config.js` proxy target from `http://localhost:5000` to `http://localhost:5001`
  5. Updated README.md: PORT default, server URLs, troubleshooting section
  6. Updated `docs/ARCHITECTURE.md` already had 5001
  7. Updated `docs/SETUP.md` already had 5001
  8. Updated `docs/IMPLEMENTATION_PLAN.md` final checklist already had 5001
- **Verification**: 
  - `curl http://localhost:5001/api/health` → 200 {"status":"ok"} ✅
  - `curl http://localhost:5173/api/health` (via Vite proxy) → 200 ✅
  - `curl http://localhost:5173/api/auth/me` (no cookie) → 401 ✅
  - Login via proxy → 200 with httpOnly cookie ✅
  - `curl http://localhost:5173/api/auth/me` (with cookie) → 200 user ✅
  - `curl http://localhost:5173/api/analytics/summary` → 200 ✅
  - `curl http://localhost:5173/api/budgets/progress` → 200 ✅
  - `npm test` → 186 tests pass ✅
  - `npm run lint` → 0 errors ✅
  - `npm run build && npm start` → production server on 5001 serves API ✅

### Phase 8+++ — Login Redirect Fix (2026-10-26)
- **Root cause**: Browser was blocking third-party cookies from the API (port 5001) when accessed via Vite proxy (port 5173). The httpOnly cookie set by the login endpoint was not being sent back on subsequent requests, causing `/auth/me` to return 401 and the dashboard to appear unauthenticated.
- **Fix**:
  1. **Server** (`server/src/middleware/auth.js`): Added `extractToken()` function that checks both `req.cookies.accessToken` and `Authorization: Bearer <token>` header. This provides a fallback when cookies are blocked.
  2. **Client AuthContext** (`client/src/context/AuthContext.jsx`): Added `TOKEN_KEY='sw_access_token'` localStorage storage with `getStoredToken()`/`setStoredToken()` helpers. Modified `login()`/`register()` to store the access token in localStorage. Added redirect logic in Login/Register pages using `useEffect` to navigate to dashboard when already authenticated.
  3. **Client API client** (`client/src/api/client.js`): Added request interceptor that injects `Authorization: Bearer <token>` header from localStorage on every request.
  4. **Vite proxy** (`client/vite.config.js`): Added `cookieDomainRewrite: 'localhost:5173'` to ensure cookies are rewritten to the frontend domain.
  5. **Login/Register pages**: Added `useEffect` redirect when `user` exists, improved error handling with `err?.message` fallback, added `data-testid="login-form"` for testing, early return `null` when redirecting to prevent flash.
  6. **Favicon**: Created `client/public/favicon.svg` and linked in `client/index.html` to eliminate 404 noise.
  7. **Tests**: Added comprehensive test suite in `client/tests/Login.test.jsx` (7 tests covering form render, valid submit, validation errors, error toasts, loading state). Mocked `react-hot-toast` and `localStorage`.
- **Verification**: All 192 tests pass (7 client + 185 server), lint clean (0 errors). Manual flow works: login at http://localhost:5173 → "Welcome back!" toast → redirect to dashboard → refresh (stays logged in via localStorage token) → logout.

### Phase 8++++ — CSV Import/Export Fix & Full Phase-by-Phase Verification (2026-10-27)
- **Root cause for CSV import failure**:
  1. In `client/src/pages/ImportExport.jsx`, `handleFileSelect` set preview batch data from the API response but did not retain the original `File` object in state, leaving `file` undefined when attempting to commit.
  2. `client/src/api/importExport.js` appended `options` to `FormData` instead of `mapping` and `previewRows` strings required by server route validation.
  3. `PreviewModal` did not populate `suggestedMapping` from preview response into react-hook-form `defaultValues`, causing blank selects.
  4. `importSchema` validated `previewRows` with strict `z.number().positive()` and `z.enum(['income', 'expense'])`, which caused form validation to silently fail if any rows had format issues or errors, blocking submission without displaying errors.
  5. `ImportBatch` cards in history looked for `batch.status === 'completed'` and `batch.validRows` / `batch.importedRows`, which did not match the model's actual fields (`importedCount`, `skippedDuplicates`, `invalidCount`).
  6. Created transactions were missing `importBatchId` references, making `undoImport` depend on a fragile timestamp window.
- **Fixes Applied**:
  1. Updated `ImportExport.jsx` to retain `file` in `setPreviewBatch({ ...result, file })`.
  2. Pre-filled `suggestedMapping` into form defaults (date, amount, debit, credit, note, category, delimiter, amountMode).
  3. Loosened `previewRows` validation in client form schema to `z.array(z.any()).optional()`.
  4. Updated `importBatchCard` to compute status (`batch.importedCount > 0 ? 'completed' : ...`) and display `totalRows`, `skippedDuplicates`, and `importedCount`.
  5. Tagged created transactions with `importBatchId: importBatch._id`, and updated `undoImport` to delete by `importBatchId` with time window fallback.
  6. Hooked `evaluateBudgets(userId)` into both import commit and undo.
  7. Server `commitSchema` and controller accept both `mapping` and `options`, auto-generating `previewRows` if missing.
  8. Removed past start date restriction on recurring rules in `client/src/pages/Recurring.jsx` to allow creating overdue rules and running catch-up occurrences.
- **Verification**:
  - All 192 tests pass (185 server + 7 client).
  - `npm run lint`: 0 errors.
  - `npm run build`: Success.
  - Full Phase 0 to 8 end-to-end programmatic verification script passed (Health check, Auth, Transactions CRUD, Analytics summary/category/trend/daily, Budgets & Notifications, Recurring rules with past start dates and catch-up, CSV Preview -> Commit -> Duplicate check -> Undo -> Export, Forecast projections).

### Phase 8+++++ — Compare Section Fix (2026-10-27)
- **Root cause**:
  1. `client/src/pages/Compare.jsx` extracted data via `const comparison = compareData?.data;`. Because the Axios interceptor in `client.js` automatically unwraps `resData.data`, `compareData` was already the comparison object, causing `comparison` to be `undefined` and rendering an empty state instead of cards and charts.
  2. `monthA` and `monthB` states were initialized to empty strings `''`, causing the page to be blank on initial load instead of defaulting to previous month vs current month.
  3. `compareSchema` in `server/src/routes/analytics.routes.js` strictly required `monthA` and `monthB`, rejecting requests using `a` and `b`.
  4. Missing category breakdown table and handling for `pct === null` (which caused runtime TypeError when calling `pct.toFixed(1)` on new categories).
- **Fixes Applied**:
  1. Updated `Compare.jsx` to resolve `const comparison = compareData?.data || compareData;` safely.
  2. Defaulted `monthA` to previous month and `monthB` to current month (`addMonths(getCurrentMonth(), -1)` and `getCurrentMonth()`), with full two-way URL search parameter synchronization (`?a=YYYY-MM&b=YYYY-MM`).
  3. Updated `compareSchema` and `compareMonthsController` to accept both `monthA`/`monthB` and `a`/`b` query parameters.
  4. Added Category Breakdown Table with delta and percentage change, correctly displaying "New" badge when `pct === null`.
  5. Limited grouped bar chart to top 8 categories by absolute delta for clean readability.
- **Verification**:
  - `GET /api/analytics/compare?monthA=2026-09&monthB=2026-10` returns 200 with 10 categories.
  - `GET /api/analytics/compare?a=2026-09&b=2026-10` returns 200 with 10 categories.
  - All 192 tests pass (185 server + 7 client).
  - `npm run lint`: 0 errors.
  - `npm run build`: Clean production build.
