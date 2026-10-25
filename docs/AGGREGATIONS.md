# Aggregations, Recurring Logic, Alerts, Forecast, CSV

## 0. Shared helpers (`utils/dates.js`, Luxon)
```js
monthRange(month, tz)  // -> { start: Date(UTC), end: Date(UTC) }  start inclusive, end exclusive
  // DateTime.fromFormat(month, 'yyyy-MM', { zone: tz }).startOf('month') ; end = start.plus({ months: 1 })
currentMonth(tz, now)  // 'YYYY-MM' in user's tz
daysInMonth(month, tz)
shiftMonth(month, n)
```
Always cast ids: `const uid = new mongoose.Types.ObjectId(userId);`

## 1. Summary (income/expense for one month)
```js
Transaction.aggregate([
  { $match: { userId: uid, date: { $gte: start, $lt: end } } },
  { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
])
```
Run for the month and the previous month; compute net, savingsRate = `net / income` (0 when income is 0), and percent changes.

## 2. Spending by category
```js
[
  { $match: { userId: uid, type: 'expense', date: { $gte: start, $lt: end } } },
  { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
  { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
  { $unwind: '$cat' },
  { $project: { _id: 0, categoryId: '$_id', name: '$cat.name', color: '$cat.color', total: 1, count: 1 } },
  { $sort: { total: -1 } }
]
```
`pct = total / sumOfTotals * 100` computed in the service (rounded to 1 decimal).

## 3. Monthly trend (last N months, zero-filled)
```js
[
  { $match: { userId: uid, date: { $gte: rangeStart, $lt: rangeEnd } } },
  { $group: {
      _id: { m: { $dateToString: { format: '%Y-%m', date: '$date', timezone: tz } }, type: '$type' },
      total: { $sum: '$amount' } } },
  { $sort: { '_id.m': 1 } }
]
```
Service builds the full list of N month keys with `shiftMonth` and fills missing with 0.

## 4. Daily series with cumulative spend
```js
[
  { $match: { userId: uid, date: { $gte: start, $lt: end } } },
  { $group: {
      _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: tz } }, type: '$type' },
      total: { $sum: '$amount' } } }
]
```
Service zero-fills every day of the month and computes the running `cumulativeExpense` in JS.

## 5. Month-over-month comparison
Run pipeline #2 (without `$sort`) for months `a` and `b`, plus income/expense totals. Merge by `categoryId` (union of categories; missing = 0). `delta = b - a`; `pct = a === 0 ? null : delta / a * 100`. Sort categories by `abs(delta)` desc.

## 6. Budget progress (single pipeline using `$lookup` with sub-pipeline)
```js
Budget.aggregate([
  { $match: { userId: uid, month } },
  { $lookup: {
      from: 'transactions',
      let: { cid: '$categoryId' },
      pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ['$userId', uid] }, { $eq: ['$type', 'expense'] },
          { $gte: ['$date', start] }, { $lt: ['$date', end] },
          { $or: [ { $eq: ['$$cid', null] }, { $eq: ['$categoryId', '$$cid'] } ] }
        ] } } },
        { $group: { _id: null, spent: { $sum: '$amount' } } }
      ],
      as: 'spend' } },
  { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'cat' } },
  { $addFields: {
      spent: { $ifNull: [{ $first: '$spend.spent' }, 0] },
      categoryName: { $ifNull: [{ $first: '$cat.name' }, 'Overall'] },
      color: { $ifNull: [{ $first: '$cat.color' }, '#64748b'] } } },
  { $project: { spend: 0, cat: 0 } }
])
```
Then compute `remaining = limit - spent`, `pct = spent / limit * 100`, `status`.
If the `$expr` form performs poorly in tests with 50k docs, fall back to one `$group` by category and merge in JS — keep the same output shape.

## 7. Budget alert evaluation (`budgetService.evaluate`)
```
evaluate(userId, { categoryId, date }, now):
  month = month key of `date` in user tz
  budgets = Budget.find({ userId, month, categoryId: { $in: [categoryId, null] } })
  for each budget:
     spent = spend for that budget (category or overall) in that month
     pct = spent / limit * 100
     if pct > 100         → createNotification('budget_exceeded')
     else if pct >= threshold → createNotification('budget_warning')
```
- Notification creation catches duplicate-key (code 11000) and ignores it → at most once per budget/type/month.
- Exceeded implies warning has effectively been passed; creating both is allowed (different `type`).
- Message examples: `"Food & Dining has reached 85% of its ₹10,000 budget for 2026-10."`, `"You have exceeded your overall budget for 2026-10 (112%)."`
- Called after: transaction create/update/delete (old and new keys), recurring generation, import commit (once per affected category+month, not per row), budget create/update.
- Only expenses trigger evaluation. Deleting a transaction never deletes notifications.

## 8. Recurring rules
### Next occurrence
```js
nextOccurrence(current, frequency, anchorDay, tz):
  daily   → current + 1 day
  weekly  → current + 7 days
  monthly → add 1 month to `current` in tz, then set day = min(anchorDay, daysInThatMonth)
  yearly  → add 1 year, same clamping (handles Feb 29)
```
Compute from the **previous scheduled occurrence plus the anchor**, never from "today", so there is no drift (e.g. Jan 31 → Feb 28 → Mar 31).

### `processDueRules(now, { userId? })`
```
rules = RecurringRule.find({ active: true, nextRunAt: { $lte: now }, ...(userId && { userId }) })
for rule of rules:
   guard = 0
   while rule.nextRunAt <= now and (!rule.endDate or rule.nextRunAt <= rule.endDate) and guard++ < 366:
       try Transaction.create({ ...rule fields, date: rule.nextRunAt, recurringRuleId, occurrenceDate: rule.nextRunAt })
       catch duplicate-key (11000) → ignore (already generated)
       rule.nextRunAt = nextOccurrence(rule.nextRunAt, ...)
   if rule.endDate and rule.nextRunAt > rule.endDate → active = false
   save rule (lastRunAt = now)
   evaluate budgets once per affected (category, month)
return { generated, rules: rules.length }
```
Idempotent: the unique partial index on `{ recurringRuleId, occurrenceDate }` guarantees no duplicates even if two runs overlap or the server restarts mid-way.

### Cron
`node-cron` schedule from `RECURRING_CRON` (default `5 0 * * *`). On server boot, also run `processDueRules(new Date())` once to catch up after downtime. Wrap in try/catch and log failures; never crash the process.

## 9. Spending forecast (`forecastService.getForecast(userId, now)`)
Only for the current month. Let `D = daysInMonth`, `e = day of month today (1..D)` (days elapsed, inclusive of today), `r = D - e` remaining days.

Per expense category `c`:
1. `spent_c` = expenses so far this month.
2. `recurringSpent_c` = portion of `spent_c` coming from recurring-generated rows (`recurringRuleId != null`); `variableSpent_c = spent_c - recurringSpent_c`.
3. `upcomingRecurring_c` = sum over active rules for category `c` of every occurrence with `now < occurrence <= endOfMonth` (use `nextOccurrence` iteratively, respecting `endDate`).
4. **Run-rate projection:** `runRate_c = spent_c + (variableSpent_c / e) * r + upcomingRecurring_c`.
5. **History projection (WMA):** take the last up to 3 *complete* months of totals `m1` (most recent), `m2`, `m3`. Weights `0.5, 0.3, 0.2`, renormalized over the months that exist: `wma_c = Σ(w_i * m_i) / Σ(w_i)`. `hasHistory` = at least 1 complete month with spend.
6. **Blend:** `α = e / D`.
   - If `hasHistory`: `projected_c = α * runRate_c + (1 - α) * max(wma_c, spent_c + upcomingRecurring_c)`
   - Else: `projected_c = runRate_c`.
7. **Floor:** `projected_c = max(projected_c, spent_c + upcomingRecurring_c)`. Round to integer minor units.

Totals: `projectedTotal = Σ projected_c`. Also return `spentSoFar`, `upcomingRecurringTotal`, `previousMonthTotal`, and `overallBudget` if present with `willExceed = projectedTotal > limit`.

Confidence: `low` when `e < 5` or no history; `medium` when `e >= 5` and history months < 3; `high` when `e >= 10` and 3 months of history.

Response:
```json
{
  "month": "2026-10", "daysElapsed": 15, "daysInMonth": 31,
  "spentSoFar": 1250000, "projectedTotal": 2780000, "upcomingRecurringTotal": 450000,
  "previousMonthTotal": 2600000, "confidence": "medium",
  "budget": { "limit": 3000000, "willExceed": false },
  "categories": [ { "categoryId": "...", "name": "Groceries", "color": "#22c55e", "spent": 320000, "projected": 710000 } ]
}
```
Edge cases: day 1 with no data → all zeros and `confidence: "low"`; categories with only upcoming recurring still appear; never return NaN (guard divisions).

## 10. CSV import details
1. **Parse** with `csv-parse` (`columns: true, skip_empty_lines: true, trim: true, bom: true`); auto-detect delimiter among `, ; \t`. Reject > 5000 rows or > 5 MB with a clear error.
2. **Suggest mapping** by header name heuristics: date (`date|txn date|transaction date|posted`), description (`description|note|narration|memo|details|payee|merchant`), amount (`amount|value`), debit (`debit|withdrawal|dr`), credit (`credit|deposit|cr`), type, category.
3. **Amount modes**
   - `signed`: negative = expense, positive = income (or inverted with `invertSign`).
   - `split`: debit column → expense, credit column → income.
   - `typeColumn`: a column containing words like `expense/income/debit/credit/dr/cr`.
   - Strip currency symbols, thousands separators, parentheses negatives `(120.50)`; convert to minor units with `Math.round(parseFloat * 100)` after cleaning (use string parsing, not float arithmetic on user text where possible).
4. **Dates**: supported formats `yyyy-MM-dd`, `dd/MM/yyyy`, `MM/dd/yyyy`, `dd-MM-yyyy`, `dd MMM yyyy`, parsed with Luxon in the user's tz at noon local time to avoid day-shift bugs. Invalid → row error.
5. **Categories**: if a category column is mapped, match case-insensitively by name+type; unknown → create (if `createMissingCategories`) else use default category. If no category column → default categories.
6. **Duplicates**: compute `fingerprint = sha1(`${localDate}|${type}|${amount}|${normalizedNote}`)` where `normalizedNote = note.toLowerCase().replace(/\s+/g,' ').trim()`. Load existing fingerprints for the user in the file's date range into a `Map<fingerprint, count>`. While iterating rows, keep a per-file counter: a row is a duplicate only if `existingCount(fingerprint) >= occurrenceInFile(fingerprint)`. This preserves two genuine identical purchases in one file while skipping re-imports of the same file.
7. **Commit**: create the `ImportBatch`, `insertMany` valid rows in chunks of 500 with `ordered: false` and `importBatchId`, update counts, evaluate budgets once per affected (category, month), return summary. Undo = `deleteMany({ userId, importBatchId })` + delete batch.
8. **Export**: `Transaction.find(filter).cursor()` piped through a CSV stringifier; first write the UTF-8 BOM and header; amounts as decimals with 2 places; escape fields (guard against CSV injection by prefixing cells starting with `= + - @` with a single quote in `note`).
