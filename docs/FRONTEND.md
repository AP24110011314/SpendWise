# Frontend Specification

React 18 + Vite + Tailwind + TanStack Query + Recharts. Clean, calm, data-first design. Responsive from 360px. Dark mode is optional (SHOULD), implemented with Tailwind `dark:` classes and a toggle in Settings.

## 1. Routing (`routes.jsx`)
| Path | Page | Auth |
|---|---|---|
| `/login`, `/register` | Login, Register | public (redirect to `/` if logged in) |
| `/` | Dashboard | protected |
| `/transactions` | Transactions | protected |
| `/categories` | Categories | protected |
| `/budgets` | Budgets | protected |
| `/recurring` | Recurring | protected |
| `/compare` | Compare months | protected |
| `/import-export` | ImportExport | protected |
| `/settings` | Settings | protected |
| `*` | NotFound | – |

`ProtectedRoute` calls `GET /auth/me` through `AuthContext`; show a full-page spinner while loading; redirect to `/login` on 401.

## 2. App shell
- Sidebar (desktop) / bottom nav or drawer (mobile): Dashboard, Transactions, Budgets, Recurring, Compare, Import/Export, Categories, Settings.
- Topbar: global **MonthPicker** (prev/next arrows + dropdown; stored in URL query `?month=` and shared by Dashboard, Budgets), **NotificationBell** (unread badge, dropdown list, mark read/all), **Add transaction** button (opens modal anywhere), user menu (logout).

## 3. API layer
`api/client.js`: axios instance `baseURL: import.meta.env.VITE_API_BASE`, `withCredentials: true`; response interceptor unwraps `data`, normalizes errors to `{ code, message, details }`, and on 401 (not from `/auth/me` or login) clears auth state and redirects to `/login`.
Each resource has a hook file with `useQuery`/`useMutation`. Mutations invalidate related keys: transactions → `['transactions']`, `['analytics']`, `['budgets']`, `['notifications']`.
Query keys: `['transactions', filters]`, `['analytics', 'summary', month]`, etc.

## 4. Money and dates (`lib/money.js`, `lib/dates.js`)
- `formatMoney(minor, currency)` → `Intl.NumberFormat(undefined, { style: 'currency', currency })` on `minor / 100`.
- `parseMoneyInput(str)` → integer minor units (string-based: split on `.`, pad/trim to 2 decimals, reject invalid). Never store floats.
- Amount input: numeric with decimals, shows currency symbol, validates > 0.
- Dates shown as `dd MMM yyyy`; inputs use `<input type="date">`; send as ISO at local noon to avoid timezone shifts.

## 5. Pages

### Dashboard
- Row of 5 stat cards: Income, Expenses, Net savings, Savings rate, Projected month-end spend (from forecast, with confidence badge). Each shows change vs previous month with ▲/▼ and color (expense up = red, income up = green).
- Grid of charts:
  1. **CategoryDonut** (Recharts `PieChart` with `innerRadius`): category share, legend with amounts and %, center label total.
  2. **TrendChart** (`ComposedChart` or `BarChart`): 6-month income vs expense bars + net line.
  3. **BudgetBars** (`BarChart` horizontal): per budget, spent vs limit; bar color by status (green/amber/red). Empty state links to Budgets.
  4. **DailyCumulativeLine** (`AreaChart`): cumulative spend through the month; if forecast available, dashed line to projected total.
- **Recent transactions** (last 8) and **Top categories** list.
- Forecast card: projected total, vs budget (if any), per-category projections table (top 5), confidence explanation tooltip.

### Transactions
- Filter bar: type tabs (All/Income/Expense), category multi-select (single select acceptable), date range, search box (debounced 300 ms), amount range, recurring toggle. Filters synced to URL.
- Table (cards on mobile): date, note, category chip (color dot), amount (+green / −red), recurring badge, row actions edit/delete (ConfirmDialog). Sort by date/amount. Pagination controls. Selection checkboxes + bulk delete (SHOULD).
- Add/Edit via `TransactionForm` modal: type toggle, amount, category (filtered by type), date, note. react-hook-form + zod, inline errors, optimistic close on success with toast.

### Categories
- Two lists (Expense, Income) with color swatch and icon; add/edit modal with color palette picker and icon picker (a fixed set of ~24 lucide icons); delete flow asks for reassignment target if in use.

### Budgets
- Month selector (global). Table/cards: category, limit, spent, remaining, progress bar (color by status), threshold marker. Add/Edit modal (category select excluding ones already budgeted this month, plus "Overall" option; limit; threshold slider 50–100). "Copy from previous month" button. Overall budget card on top.

### Recurring
- List rules: category, amount, frequency, next run, status toggle (active/paused), edit, delete. "Run due now" button (calls `/recurring/process`) with toast `Generated N transactions`. Form: type, category, amount, note, frequency, start date, optional end date. Show helper text for monthly clamping.

### Compare
- Two MonthPickers (A, B; defaults: previous month vs current). Summary tiles for income/expense/net with deltas. **Grouped bar chart** of per-category A vs B (top 8 by absolute delta) and a table with delta and percent (green/red semantics: expense decrease = good). Handle `pct === null` as "new".

### ImportExport
- **Import wizard** (stepper): 1 Upload (drag-and-drop + file picker) → 2 Preview & map (table of first 10 rows, dropdowns per field pre-filled by `suggestedMapping`, amount mode radio, date format select, invert sign checkbox, default categories, "create missing categories" checkbox) → 3 Result summary (imported / duplicates skipped / invalid with expandable row errors) with **Undo import** button.
- **Import history** table with batch date, file name, counts, Undo.
- **Export** card: apply the same filters (type, category, date range) and download via a plain `<a href>` to the export URL (cookie auth works for same-origin).

### Settings
- Profile (name), currency select, timezone select (`Intl.supportedValuesOf('timeZone')`), change password, theme toggle (optional), logout.

## 6. UX requirements
- Every list/chart: skeleton or spinner while loading, `EmptyState` with a call to action, `ErrorState` with retry.
- Toasts for success and errors (react-hot-toast). Destructive actions always use `ConfirmDialog`.
- Forms disable submit while pending and show server validation errors mapped to fields (`error.details`).
- Charts: consistent palette from category colors; tooltips show formatted money; `aria-label` summarizing the chart; do not rely on color alone for budget status (add icons/text).
- Accessibility: semantic landmarks, focus trap in modals, ESC closes, visible focus ring, labels bound to inputs, 4.5:1 contrast.
- Performance: route-level code splitting with `React.lazy`; Recharts only loaded on pages that need it.

## 7. Component contracts (props, minimal)
- `MonthPicker({ value, onChange })`
- `CategoryDonut({ data, currency })`, `TrendChart({ data, currency })`, `BudgetBars({ data, currency })`, `DailyCumulativeLine({ data, projectedTotal, currency })`
- `TransactionForm({ initial, onSubmit, onCancel })`
- `ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel })`
