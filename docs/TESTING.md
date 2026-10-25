# Testing Strategy

## Tooling
- Server: **Vitest**, **supertest**, **mongodb-memory-server** (downloads and runs a real mongod binary locally — no Docker). Single in-memory server per test run; wipe collections in `beforeEach`.
- Client: **Vitest + React Testing Library + jsdom**, `msw` for API mocking (optional).
- Scripts: `npm test` runs both; `npm test -w server -- --coverage` for coverage.
- Time control: pass `now` into services; use `vi.useFakeTimers()` only when unavoidable.

## Server test helpers (`server/tests/helpers`)
- `createUser(overrides)` → user + auth cookie via the real register endpoint.
- `agentFor(user)` → supertest agent with the cookie.
- `makeTx(userId, { type, categoryId, amount, date })` factory.
- Fixed clock constant, e.g. `NOW = new Date('2026-10-15T08:00:00.000Z')`.

## Required test cases

### Auth & security
- Register hashes password (never returned), duplicate email → 409, login wrong password → 401 with generic message, protected route without cookie → 401, cookie is httpOnly.
- User A cannot read/update/delete user B's transactions, categories, budgets, rules, batches (404).
- Validation: bad ObjectId, negative amount, non-integer amount, bad month string → 400 `VALIDATION_ERROR`.
- Regex special chars in `q` do not break or inject (e.g. `.*(`).

### Categories
- Defaults seeded; unique per user+type (case-insensitive); delete in-use without `reassignTo` → 409; with `reassignTo` moves transactions, rules, budgets.

### Transactions
- CRUD; type must match category type; filters (type, category, range, q, amount range, recurring); sorting; pagination meta; bulk delete only deletes own docs.

### Analytics (pipelines)
- Summary totals and previous-month change including `null` when previous is 0.
- By-category percentages sum to ≈100; `$lookup` names/colors present.
- Trend zero-fills missing months and orders oldest → newest.
- Daily series length equals days in month; cumulative is monotonic.
- Timezone: with user tz `Asia/Kolkata`, a transaction at `2026-09-30T19:00:00Z` (00:30 on Oct 1 local) is counted in **October**.
- Compare: union of categories, `delta`, `pct === null` when A is 0.
- Performance sanity: seed 20k transactions, assert summary and trend complete under ~300 ms (log, don't make CI flaky — use generous threshold).

### Budgets & notifications
- Progress status boundaries: 79% ok, 80% warning, 100% warning, 101% exceeded (threshold 80).
- `evaluate` creates exactly one warning, then one exceeded; repeating does not duplicate (unique index).
- Overall budget (`categoryId: null`) counts all expense categories.
- Editing a transaction to another category re-evaluates both categories; income transactions never alert.
- Copy budgets skips existing; duplicate budget → 409.

### Recurring
- `nextOccurrence` table tests: daily, weekly, monthly anchor 31 (Jan→Feb 28/29→Mar 31), anchor 29 in non-leap Feb, yearly Feb 29, tz boundary.
- `processDueRules`: generates one; three-months overdue generates three; running twice creates no duplicates (and the unique index is the backstop — simulate by inserting first); paused skipped; `endDate` stops and deactivates; budgets evaluated after generation.
- Cron registration does not run when `ENABLE_CRON=false` (so tests stay deterministic).

### Forecast (deterministic, hand-computed)
Scenario with `NOW = 2026-10-15` (e=15, D=31, r=16), one category "Groceries":
- Variable spend so far 30,000 minor units, no recurring, history: Sep 60,000; Aug 50,000; Jul 40,000.
- `runRate = 30000 + (30000/15)*16 = 62000`.
- `wma = (0.5*60000 + 0.3*50000 + 0.2*40000)/1.0 = 53000`.
- `α = 15/31 ≈ 0.48387`; `projected = α*62000 + (1-α)*max(53000, 30000) = 30000.0 + 27355.5 ≈ 57355` (assert within ±1 after rounding).
Other cases: no history → equals run-rate; upcoming recurring added; floor applied; day 1 with no data → zeros, `confidence: 'low'`; past month → 400; never NaN.

### CSV
- Preview returns headers, 10 sample rows, suggested mapping; delimiter detection for `;`.
- Commit modes: signed, split debit/credit, type column; `invertSign`; parentheses negatives; currency symbols and thousand separators; date formats (`dd/MM/yyyy` vs `MM/dd/yyyy`).
- Invalid rows collected with row numbers and do not abort valid rows.
- Dedupe: re-import skips all; file with two identical genuine rows imports both the first time and skips both the second time.
- Create-missing-categories on/off.
- Undo deletes only that batch's rows. File > 5 MB or > 5000 rows rejected.
- Export: header, decimal amounts, BOM, formula-injection prefixing, filters applied, streaming for 10k rows.

### Client
- `parseMoneyInput` and `formatMoney` unit tests (`"12.5"`→1250, `"12.345"` rejected or truncated per spec, `"abc"` invalid).
- TransactionForm validation and submit payload (minor units).
- ProtectedRoute redirects when unauthenticated.
- BudgetBars/CategoryDonut render with empty and populated data without crashing.

## CI-friendly rules
Tests must not depend on a running external MongoDB, network access, wall-clock time, or execution order.
