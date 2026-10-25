# Implementation Plan

Work phase by phase. Do not start a phase until the previous phase's acceptance criteria pass. After each phase: tests green, lint clean, `docs/PROGRESS.md` updated, one Conventional Commit.

## Phase 0 — Scaffold
**Do**
- `git init` (if needed), root `package.json` with workspaces `server`, `client`; `.gitignore` (node_modules, .env, dist, coverage), `.editorconfig`, Prettier, ESLint flat config.
- Server: Express app skeleton, env validation (zod), Mongo connection, pino logger, `GET /api/health`, error/notFound middleware, `ApiError`, `asyncHandler`, `validate` middleware. `app.js` exports the app; `server.js` boots.
- Client: Vite + React + Tailwind + Router + TanStack Query + axios client; AppShell with placeholder routes; Vite proxy.
- Vitest configured for both workspaces with one passing smoke test each (`/api/health`, App renders).
- README with setup (no Docker), `.env.example` files.
**Accept**: `npm install`, `npm run dev` shows the app and `/api/health` through the proxy; `npm test` and `npm run lint` pass.

## Phase 1 — Auth & Categories
**Do**: User model, register/login/logout/me/patch me/change-password, JWT cookie middleware, rate limits, default category seeding, Category model + CRUD with reassign-on-delete. Client: Login/Register pages, AuthContext, ProtectedRoute, Settings (profile/currency/timezone/password), Categories page.
**Accept**: can register → lands on dashboard shell with default categories; wrong password returns 401; categories CRUD works and deleting a used category forces reassignment; tests for auth and categories pass.

## Phase 2 — Transactions
**Do**: Transaction model + indexes + fingerprint util, CRUD, list with all filters/sort/pagination, bulk delete, ownership checks, category/type consistency validation. Client: Transactions page (filters synced to URL), TransactionForm modal, global Add button, money/date libs.
**Accept**: create/edit/delete/filter/paginate in the browser; amounts display correctly in the user's currency; cannot read or modify another user's data (integration test with two users).

## Phase 3 — Analytics & Dashboard
**Do**: `analyticsService` (summary, by-category, trend, daily, compare), routes, zero-filling, timezone-aware month ranges. Client: Dashboard cards and four charts, MonthPicker with URL sync.
**Accept**: numbers on the dashboard match a manual sum of the seeded/entered data; month boundaries correct in `Asia/Kolkata` (a transaction at 23:30 local on the last day belongs to that month); pipeline tests pass; queries use the indexes (check with `explain()` in a test or a note in PROGRESS).

## Phase 4 — Budgets & Notifications
**Do**: Budget and Notification models, budget CRUD, progress pipeline, `budgetService.evaluate` hooked into transaction create/update/delete, copy-budgets endpoint, notifications API. Client: Budgets page, BudgetBars on dashboard, NotificationBell.
**Accept**: crossing the threshold creates exactly one warning; exceeding creates exactly one exceeded; repeated expenses do not duplicate; editing a transaction's category re-evaluates both budgets; tests pass.

## Phase 5 — Recurring Transactions
**Do**: RecurringRule model, `nextOccurrence` util (with clamping), `processDueRules`, cron job + boot catch-up, CRUD routes, `POST /recurring/process`. Client: Recurring page and form, recurring badge in the transactions list.
**Accept**: a monthly rule starting Jan 31 yields Jan 31, Feb 28, Mar 31…; running processing twice creates no duplicates; a rule that is 3 months overdue creates 3 transactions on one run; paused and ended rules don't generate; tests pass.

## Phase 6 — CSV Import / Export
**Do**: multer upload (memory, 5 MB), parsing, delimiter detection, mapping suggestions, preview, commit with the three amount modes, date formats, category handling, fingerprint dedupe, batches + undo, streamed export. Client: Import wizard, history, export controls. Provide `server/tests/fixtures/*.csv` (bank-style signed, split debit/credit, semicolon-delimited, bad rows).
**Accept**: importing the sample twice skips all rows the second time; undo removes exactly the batch's rows; invalid rows reported with row numbers; exported CSV re-imports cleanly; tests pass.

## Phase 7 — Forecast & Comparison
**Do**: `forecastService` exactly as specified in AGGREGATIONS.md section 9, forecast endpoint, forecast card + dashed projection on the daily chart, Compare page.
**Accept**: unit tests with fixed `now` reproduce hand-computed values (see TESTING.md); no NaN for empty data; compare page deltas and `pct: null` handling correct.

## Phase 8 — Seed, Polish, Production
**Do**: `npm run seed` (demo user, ~6 months of data incl. recurring rules, budgets, one over-budget category); loading/empty/error states everywhere; accessibility pass; optional dark mode; production serving of `client/dist` from Express; final README; remove dead code.
**Accept**: run the final checklist below.

## Final verification checklist
1. Fresh clone → `npm install` → copy env files → `npm run seed` → `npm run dev` works with only Node and MongoDB.
2. `npm test`, `npm run lint`, `npm run build && npm start` all succeed; app served from `http://localhost:5000`.
3. Login as demo user: dashboard shows all cards and four charts with non-empty data; forecast card shows a projection with a confidence label.
4. Add an expense that pushes a category past 80% → bell shows a warning; push past 100% → exceeded; adding more does not duplicate alerts.
5. Create a monthly recurring rule with a past start date → click "Run due now" → transactions appear marked recurring; click again → no new rows.
6. Import the sample CSV → preview and mapping work → imported; import again → all duplicates skipped; undo → rows gone.
7. Export with filters → CSV opens in a spreadsheet with correct decimals.
8. Compare two months → deltas match manual calculation.
9. Search the repo: no `Dockerfile`, `docker-compose`, or the word "docker" (case-insensitive) outside CLAUDE.md/prompt rules.
10. Two different users cannot see each other's data (covered by tests).
