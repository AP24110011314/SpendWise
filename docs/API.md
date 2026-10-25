# REST API

Base path `/api`. JSON in/out. Auth via httpOnly cookie `sw_token` unless marked public.
Success: `{ "data": ..., "meta": ... }`. Error: `{ "error": { "code", "message", "details" } }`.
Common codes: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `INTERNAL` 500.
**Amounts are integer minor units. Dates are ISO strings. Months are `YYYY-MM`.**
Pagination query: `page` (default 1), `limit` (default 20, max 100). Meta: `{ page, limit, total, totalPages }`.

## Health
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | public, `{ status: 'ok' }` |

## Auth
| Method | Path | Body | Result |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password }` | 201 user; sets cookie; seeds default categories. Email taken → 409 |
| POST | `/auth/login` | `{ email, password }` | user; sets cookie. Bad creds → 401 (same message for unknown email/wrong password) |
| POST | `/auth/logout` | – | clears cookie |
| GET | `/auth/me` | – | current user |
| PATCH | `/auth/me` | `{ name?, currency?, timezone? }` | updated user |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | 204 |

Rate limit: 10 requests / 15 min / IP on register, login.

## Categories
| Method | Path | Notes |
|---|---|---|
| GET | `/categories?type=` | all user categories |
| POST | `/categories` | `{ name, type, color?, icon? }` |
| PATCH | `/categories/:id` | `{ name?, color?, icon? }` (type immutable once it has transactions) |
| DELETE | `/categories/:id?reassignTo=ID` | 409 `CATEGORY_IN_USE` if used and no valid `reassignTo` |

## Transactions
| Method | Path | Notes |
|---|---|---|
| GET | `/transactions` | filters: `type, categoryId, from, to, q, minAmount, maxAmount, recurring=true|false, sort=date|amount, order=asc|desc` (default `date desc`). Returns rows with populated `category {id,name,color,icon}` |
| POST | `/transactions` | `{ type, categoryId, amount, date, note? }` → 201; triggers budget evaluation |
| GET | `/transactions/:id` | |
| PATCH | `/transactions/:id` | partial; re-evaluates budgets for old and new category/month |
| DELETE | `/transactions/:id` | |
| POST | `/transactions/bulk-delete` | `{ ids: [..] }` (max 200) → `{ deleted }` |

## Recurring rules
| Method | Path | Notes |
|---|---|---|
| GET | `/recurring` | rules with category, plus `nextRunAt` |
| POST | `/recurring` | `{ type, categoryId, amount, note?, frequency, startDate, endDate? }`; sets `anchorDay`, `nextRunAt = startDate`. If startDate is in the past, the catch-up runs immediately on the next processing call (the service also calls processing for this rule right after creation) |
| PATCH | `/recurring/:id` | `{ amount?, note?, categoryId?, endDate?, active? }` (frequency/startDate immutable) |
| DELETE | `/recurring/:id` | |
| POST | `/recurring/process` | runs `processDueRules(now)` for the current user only → `{ generated, rules }` |

## Budgets
| Method | Path | Notes |
|---|---|---|
| GET | `/budgets?month=YYYY-MM` | budgets for month |
| POST | `/budgets` | `{ month, categoryId|null, limit, alertThreshold? }`; duplicate → 409 |
| PATCH | `/budgets/:id` | `{ limit?, alertThreshold? }`; re-evaluates alerts |
| DELETE | `/budgets/:id` | |
| GET | `/budgets/progress?month=YYYY-MM` | `[{ budgetId, categoryId|null, categoryName, color, limit, spent, remaining, pct, alertThreshold, status }]` status: `ok` (<threshold), `warning` (≥threshold and ≤100), `exceeded` (>100) |
| POST | `/budgets/copy` | `{ fromMonth, toMonth }` → `{ created, skipped }` |

## Notifications
| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?unread=true&limit=20` | with `meta.unreadCount` |
| PATCH | `/notifications/:id/read` | |
| POST | `/notifications/read-all` | |

## Analytics (all accept optional `month` defaulting to the current month in the user's timezone)
| Method | Path | Result |
|---|---|---|
| GET | `/analytics/summary?month=` | `{ month, income, expense, net, savingsRate, txCount, previous: { income, expense, net }, change: { income, expense, net } }` (change = percent vs previous month, `null` when previous is 0) |
| GET | `/analytics/by-category?month=|from=&to=&type=expense` | `[{ categoryId, name, color, total, count, pct }]` sorted desc |
| GET | `/analytics/trend?months=6&end=YYYY-MM` | `[{ month, income, expense, net }]` with zero-filled gaps, oldest first |
| GET | `/analytics/daily?month=` | `[{ date, expense, income, cumulativeExpense }]` for every day of the month (zero-filled) |
| GET | `/analytics/compare?a=YYYY-MM&b=YYYY-MM` | `{ a: {month,income,expense,net}, b: {...}, categories: [{ categoryId, name, color, a, b, delta, pct }], totals: {...} }` where `delta = b - a` and `pct` is `null` if `a == 0` |
| GET | `/analytics/forecast?month=` | forecast object defined in AGGREGATIONS.md (current month only; past months return 400) |

## Import / Export
| Method | Path | Notes |
|---|---|---|
| POST | `/import/preview` | multipart `file` (.csv, ≤ 5 MB, ≤ 5000 rows). Returns `{ headers, sampleRows (first 10), totalRows, suggestedMapping, delimiter }` |
| POST | `/import/commit` | multipart `file` + field `options` (JSON string): `{ mapping: { date, description, amount?, debit?, credit?, type?, category? }, dateFormat, amountMode: 'signed'|'split'|'typeColumn', invertSign?: boolean, defaultCategoryId (expense), defaultIncomeCategoryId, createMissingCategories: boolean, skipDuplicates: true }` → `{ batchId, totalRows, imported, skippedDuplicates, invalid, errors[] }` |
| GET | `/import/batches` | list batches |
| DELETE | `/import/batches/:id` | undo → `{ deleted }` |
| GET | `/export/transactions.csv` | same filters as list; streamed `text/csv` with `Content-Disposition: attachment; filename="spendwise-YYYY-MM-DD.csv"`; columns `date,type,category,amount,note,recurring` where `amount` is decimal in major units |

## Validation notes
- `amount`: integer 1 – 100_000_000_000.
- `date`: valid ISO date; future dates allowed up to 1 year ahead.
- `limit` of budget: integer ≥ 1.
- All `:id` params validated as ObjectId; foreign ids (category) must belong to the user else 404.
