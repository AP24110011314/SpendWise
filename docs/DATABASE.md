# Database (MongoDB + Mongoose)

All schemas use `{ timestamps: true }`. `userId` is `ObjectId` ref `User`. Amounts are positive integers in minor units; direction is given by `type`.

## User
```js
{
  name: String (required, trim, 1-80),
  email: String (required, unique, lowercase, trim),
  passwordHash: String (required, select: false),
  currency: String (default 'INR', uppercase, 3 letters),
  timezone: String (default 'Asia/Kolkata', validated with Intl.DateTimeFormat)
}
```
Index: `{ email: 1 } unique`.

## Category
```js
{
  userId, name: String (1-40), type: 'income' | 'expense',
  color: String (hex, default by palette), icon: String (lucide icon name, default 'tag'),
  isDefault: Boolean (default false)
}
```
Indexes: `{ userId: 1, type: 1, name: 1 } unique` (case-insensitive collation `{ locale: 'en', strength: 2 }`).

Default categories seeded at registration:
- Expense: Food & Dining, Groceries, Transport, Rent & Housing, Utilities, Health, Shopping, Entertainment, Education, Travel, Subscriptions, Other
- Income: Salary, Freelance, Gifts, Investments, Other Income

## Transaction
```js
{
  userId,
  categoryId: ObjectId ref Category (required),
  type: 'income' | 'expense' (required),
  amount: Number, integer, min 1 (required),        // minor units
  date: Date (required),                            // UTC instant
  note: String (trim, max 200, default ''),
  recurringRuleId: ObjectId | null,
  occurrenceDate: Date | null,                      // the scheduled occurrence this row was generated for
  importBatchId: ObjectId | null,
  fingerprint: String                               // sha1 of `${YYYY-MM-DD in user tz}|${type}|${amount}|${normalizedNote}`
}
```
Indexes:
- `{ userId: 1, date: -1 }`
- `{ userId: 1, type: 1, date: -1 }`
- `{ userId: 1, categoryId: 1, date: -1 }`
- `{ userId: 1, importBatchId: 1 }` (sparse via partialFilterExpression `{ importBatchId: { $type: 'objectId' } }`)
- `{ userId: 1, fingerprint: 1 }`
- `{ recurringRuleId: 1, occurrenceDate: 1 }` **unique**, `partialFilterExpression: { recurringRuleId: { $type: 'objectId' } }` → makes recurring generation idempotent.
- Optional text search is done with escaped, case-insensitive regex on `note` scoped to the user (fine at this scale).

Validation in service layer: category belongs to user and `category.type === type`.

## RecurringRule
```js
{
  userId, categoryId, type, amount (int), note,
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
  startDate: Date (required),
  endDate: Date | null,
  anchorDay: Number,          // day-of-month from startDate (in user tz), used for monthly/yearly clamping
  nextRunAt: Date (required), // next occurrence not yet generated
  lastRunAt: Date | null,
  active: Boolean (default true)
}
```
Indexes: `{ active: 1, nextRunAt: 1 }`, `{ userId: 1 }`.

## Budget
```js
{
  userId,
  categoryId: ObjectId | null,   // null = overall monthly budget across all expense categories
  month: String 'YYYY-MM' (regex validated),
  limit: Number integer >= 1,
  alertThreshold: Number 1-100 (default 80)
}
```
Index: `{ userId: 1, month: 1, categoryId: 1 }` unique (null counts as a value, so only one overall budget per month).

## Notification
```js
{
  userId,
  type: 'budget_warning' | 'budget_exceeded',
  budgetId: ObjectId,
  month: 'YYYY-MM',
  message: String,
  readAt: Date | null
}
```
Indexes: `{ userId: 1, readAt: 1, createdAt: -1 }`, and **unique** `{ userId: 1, budgetId: 1, type: 1, month: 1 }` so alerts fire at most once per budget/type/month (catch duplicate-key errors silently).

## ImportBatch
```js
{
  userId, filename: String, totalRows: Number, importedCount: Number,
  skippedDuplicates: Number, invalidCount: Number,
  errors: [{ row: Number, reason: String }]   // capped at 200 entries
}
```
Index: `{ userId: 1, createdAt: -1 }`.

## Referential rules (enforced in services)
- Deleting a category with transactions/recurring rules/budgets requires `reassignTo`; reassign updates all three, deleting a budget that would collide on the unique index.
- Deleting a recurring rule keeps previously generated transactions (they keep `recurringRuleId` for history).
- Deleting an import batch deletes its transactions and the batch record.
- Deleting a user (not exposed in UI) would cascade manually; not required.
