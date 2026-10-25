# SpendWise — Product Requirements

## 1. Goal
A dashboard where one person records income and expenses, sets monthly budgets, gets alerted before overspending, and understands habits through charts, comparisons, and a month-end forecast.

## 2. Users
Single-user accounts (no sharing). Primary persona: a student or young professional who wants a fast, clear view of where money goes.

## 3. Priorities
MUST = required for completion. SHOULD = build if time allows after all MUSTs.

## 4. Functional requirements

### Auth & profile
- FR-A1 (MUST) Register with name, email, password (min 8 chars); login; logout; session via httpOnly cookie JWT (7 days).
- FR-A2 (MUST) Profile settings: name, currency (ISO code, default INR), timezone (IANA, default Asia/Kolkata).
- FR-A3 (MUST) On registration, seed default categories (see DATABASE.md).

### Categories
- FR-C1 (MUST) CRUD categories with name, type (income|expense), color, icon. Name unique per user+type.
- FR-C2 (MUST) Deleting a category with transactions requires `reassignTo` another category of the same type.

### Transactions
- FR-T1 (MUST) Create, edit, delete income/expense with amount, date, category, note.
- FR-T2 (MUST) List with pagination, sorting, and filters: type, category, date range, text search on note, amount range.
- FR-T3 (SHOULD) Bulk delete selected rows.

### Recurring transactions
- FR-R1 (MUST) Create rules (daily, weekly, monthly, yearly) with start date, optional end date, amount, category, note; pause/resume; edit; delete.
- FR-R2 (MUST) A scheduled job generates due transactions automatically, catches up after downtime, and never creates duplicates.
- FR-R3 (MUST) Generated transactions are visibly marked as recurring and link back to their rule.
- FR-R4 (MUST) Monthly rules anchored on day 29–31 clamp to the last day of shorter months without drifting.

### Budgets & alerts
- FR-B1 (MUST) Set a monthly limit per expense category, plus an optional overall monthly budget. Each has an alert threshold (default 80%).
- FR-B2 (MUST) Budget progress view: spent, remaining, percent, status (ok | warning | exceeded).
- FR-B3 (MUST) In-app notifications created when spending crosses the threshold and when it exceeds the limit — at most once per budget per type per month.
- FR-B4 (MUST) Notifications bell with unread count; mark read / mark all read.
- FR-B5 (SHOULD) Copy last month's budgets into a new month.

### Analytics
- FR-D1 (MUST) Dashboard cards: income, expenses, net savings, savings rate, projected month-end spend, each with change versus previous month.
- FR-D2 (MUST) Charts: category share donut, 6-month income vs expense trend, budget vs actual bars, daily cumulative spend line for the selected month.
- FR-D3 (MUST) Monthly comparison page: pick two months, see per-category delta and percent change, plus totals.
- FR-D4 (MUST) Spending forecast: projected month-end total and per category, with confidence label, using the algorithm in AGGREGATIONS.md.

### CSV
- FR-I1 (MUST) Import CSV: upload → preview with auto-detected columns → mapping UI → commit. Support single signed amount column or separate debit/credit columns, multiple date formats, unknown categories (map to default or auto-create).
- FR-I2 (MUST) Duplicate detection against existing data; skipped rows reported with reasons; invalid rows reported with row numbers.
- FR-I3 (MUST) Each import is a batch that can be undone (deletes everything it created).
- FR-I4 (MUST) Export filtered transactions as CSV (streamed).

## 5. Non-functional requirements
- NFR-1 Dashboard endpoints respond in < 300 ms with 50k transactions for one user (indexes required).
- NFR-2 Security: bcrypt (cost 12), helmet, rate limiting on auth routes, input validation, regex-escaped search, CORS limited to the client origin, httpOnly + SameSite=Lax cookie (Secure in production).
- NFR-3 Responsive UI (mobile ≥ 360px), keyboard accessible forms, labels on all inputs, charts have text alternatives/tooltips.
- NFR-4 No Docker; runs with Node + MongoDB only.
- NFR-5 Meaningful tests for services, pipelines, and API routes (see TESTING.md).

## 6. Out of scope
Multi-currency conversion, bank sync, shared/household accounts, email/push notifications, receipt OCR, mobile apps, ML-based forecasting.

## 7. Acceptance summary
A new user can register, see default categories, add transactions, set budgets, receive an alert, import a CSV and undo it, create a recurring rule that generates transactions, and see correct dashboard numbers, comparison, and forecast — all verified by the checklist in IMPLEMENTATION_PLAN.md.
