import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import { Transaction } from '../models/Transaction.js';
import { Category } from '../models/Category.js';
import { Budget } from '../models/Budget.js';
import { RecurringRule } from '../models/RecurringRule.js';
import { monthRange, currentMonth, daysInMonth, shiftMonth, getLastNMonths, dayOfMonth, getCurrentMonthRange, getDueOccurrences } from '../utils/dates.js';

/**
 * Get summary for a month (income, expense, net, savings rate)
 */
export async function getSummary(userId, month, tz = 'Asia/Kolkata') {
  const uid = new mongoose.Types.ObjectId(userId);
  const monthKey = month || currentMonth(tz);
  const { start, end } = monthRange(monthKey, tz);

  const results = await Transaction.aggregate([
    { $match: { userId: uid, date: { $gte: start, $lt: end } } },
    { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const r of results) {
    if (r._id === 'income') {
      income = r.total;
      incomeCount = r.count;
    } else if (r._id === 'expense') {
      expense = r.total;
      expenseCount = r.count;
    }
  }

  const net = income - expense;
  const savingsRate = income > 0 ? Math.round((net / income) * 1000) / 10 : 0; // 1 decimal place

  return {
    month: monthKey,
    income,
    expense,
    net,
    savingsRate,
    incomeCount,
    expenseCount,
  };
}

/**
 * Get spending by category for a month
 */
export async function getByCategory(userId, month, tz = 'Asia/Kolkata') {
  const uid = new mongoose.Types.ObjectId(userId);
  const monthKey = month || currentMonth(tz);
  const { start, end } = monthRange(monthKey, tz);

  const results = await Transaction.aggregate([
    { $match: { userId: uid, type: 'expense', date: { $gte: start, $lt: end } } },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $unwind: '$cat' },
    { $project: { _id: 0, categoryId: '$_id', name: '$cat.name', color: '$cat.color', total: 1, count: 1 } },
    { $sort: { total: -1 } }
  ]);

  const sumOfTotals = results.reduce((sum, r) => sum + r.total, 0);

  return results.map(r => ({
    ...r,
    pct: sumOfTotals > 0 ? Math.round((r.total / sumOfTotals) * 1000) / 10 : 0,
  }));
}

/**
 * Get monthly trend for last N months (zero-filled)
 */
export async function getTrend(userId, months = 6, tz = 'Asia/Kolkata', referenceMonth = null) {
  const uid = new mongoose.Types.ObjectId(userId);
  const currentMonthKey = referenceMonth || currentMonth(tz);
  const monthKeys = getLastNMonths(currentMonthKey, months);
  const oldestMonth = monthKeys[0];
  const { start: rangeStart } = monthRange(oldestMonth, tz);
  const { end: rangeEnd } = monthRange(currentMonthKey, tz);

  const results = await Transaction.aggregate([
    { $match: { userId: uid, date: { $gte: rangeStart, $lt: rangeEnd } } },
    { $group: {
        _id: {
          m: { $dateToString: { format: '%Y-%m', date: '$date', timezone: tz } },
          type: '$type'
        },
        total: { $sum: '$amount' }
      }
    },
    { $sort: { '_id.m': 1 } }
  ]);

  // Build zero-filled result
  const trend = [];
  for (const monthKey of monthKeys) {
    const incomeResult = results.find(r => r._id.m === monthKey && r._id.type === 'income');
    const expenseResult = results.find(r => r._id.m === monthKey && r._id.type === 'expense');

    trend.push({
      month: monthKey,
      income: incomeResult?.total || 0,
      expense: expenseResult?.total || 0,
      net: (incomeResult?.total || 0) - (expenseResult?.total || 0),
    });
  }

  return trend;
}

/**
 * Get daily series for a month with cumulative expenses
 */
export async function getDaily(userId, month, tz = 'Asia/Kolkata') {
  const uid = new mongoose.Types.ObjectId(userId);
  const monthKey = month || currentMonth(tz);
  const { start, end } = monthRange(monthKey, tz);
  const daysInMonthCount = daysInMonth(monthKey, tz);

  const results = await Transaction.aggregate([
    { $match: { userId: uid, date: { $gte: start, $lt: end } } },
    { $group: {
        _id: {
          d: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: tz } },
          type: '$type'
        },
        total: { $sum: '$amount' }
      }
    }
  ]);

  // Build zero-filled daily data with cumulative expenses
  const daily = [];
  let cumulativeExpense = 0;

  for (let day = 1; day <= daysInMonthCount; day++) {
    const dayStr = `${monthKey}-${day.toString().padStart(2, '0')}`;

    const incomeResult = results.find(r => r._id.d === dayStr && r._id.type === 'income');
    const expenseResult = results.find(r => r._id.d === dayStr && r._id.type === 'expense');

    const income = incomeResult?.total || 0;
    const expense = expenseResult?.total || 0;
    cumulativeExpense += expense;

    daily.push({
      date: dayStr,
      income,
      expense,
      net: income - expense,
      cumulativeExpense,
    });
  }

  return daily;
}

/**
 * Compare two months (category breakdown + totals)
 */
export async function compareMonths(userId, monthA, monthB, tz = 'Asia/Kolkata') {
  const uid = new mongoose.Types.ObjectId(userId);

  // Get category breakdown for both months
  const [catA, catB] = await Promise.all([
    getByCategoryRaw(userId, monthA, tz),
    getByCategoryRaw(userId, monthB, tz),
  ]);

  // Merge by categoryId (union of categories)
  const allCategoryIds = new Set([...catA.map(c => c.categoryId), ...catB.map(c => c.categoryId)]);

  // Get totals for both months
  const [summaryA, summaryB] = await Promise.all([
    getSummary(userId, monthA, tz),
    getSummary(userId, monthB, tz),
  ]);

  const categories = [];
  for (const catId of allCategoryIds) {
    const a = catA.find(c => c.categoryId === catId) || { total: 0, count: 0, name: '', color: '#64748b' };
    const b = catB.find(c => c.categoryId === catId) || { total: 0, count: 0, name: '', color: '#64748b' };

    const delta = b.total - a.total;
    const pct = a.total === 0 ? null : Math.round((delta / a.total) * 1000) / 10;

    categories.push({
      categoryId: catId,
      name: a.name || b.name,
      color: a.color || b.color,
      monthA: a.total,
      monthB: b.total,
      delta,
      pct,
    });
  }

  // Sort by absolute delta descending
  categories.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  return {
    monthA,
    monthB,
    incomeA: summaryA.income,
    incomeB: summaryB.income,
    expenseA: summaryA.expense,
    expenseB: summaryB.expense,
    netA: summaryA.net,
    netB: summaryB.net,
    categories,
  };
}

/**
 * Raw category data without percentage calculation (used by compare)
 */
async function getByCategoryRaw(userId, month, tz) {
  const uid = new mongoose.Types.ObjectId(userId);
  const monthKey = month || currentMonth(tz);
  const { start, end } = monthRange(monthKey, tz);

  const result = await Transaction.aggregate([
    { $match: { userId: uid, type: 'expense', date: { $gte: start, $lt: end } } },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $unwind: '$cat' },
    { $project: { _id: 0, categoryId: { $toString: '$_id' }, name: '$cat.name', color: '$cat.color', total: 1, count: 1 } }
  ]);

  return result;
}

/**
 * Get spending forecast for the current month
 * Based on AGGREGATIONS.md section 9
 */
export async function getForecast(userId, now = new Date(), tz = 'Asia/Kolkata') {
  const uid = new mongoose.Types.ObjectId(userId);

  // Get current month range
  const { start, end, monthKey } = getCurrentMonthRange(tz, now);
  const D = daysInMonth(monthKey, tz);
  const e = dayOfMonth(now, tz); // days elapsed (1-indexed, inclusive of today)
  const r = D - e; // remaining days

  // Get all expense transactions for current month
  const currentMonthTxs = await Transaction.aggregate([
    { $match: { userId: uid, type: 'expense', date: { $gte: start, $lt: end } } },
    { $group: {
        _id: '$categoryId',
        spent: { $sum: '$amount' },
        recurringSpent: {
          $sum: { $cond: [{ $ne: ['$recurringRuleId', null] }, '$amount', 0] }
        },
        count: { $sum: 1 }
      }
    },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
    { $project: {
        _id: 0,
        categoryId: { $toString: '$_id' },
        name: '$cat.name',
        color: '$cat.color',
        spent: 1,
        recurringSpent: 1,
        count: 1
      }
    }
  ]);

  // Get all active recurring rules for expense categories
  const activeRules = await RecurringRule.find({
    userId: uid,
    type: 'expense',
    active: true,
    nextRunAt: { $lte: end } // only rules that could fire this month
  }).lean();

  // Calculate upcoming recurring for each category
  const upcomingRecurringByCategory = {};
  for (const rule of activeRules) {
    const catId = rule.categoryId.toString();
    const occurrences = getDueOccurrences(rule, end, tz);
    // Filter to only occurrences after now and within current month
    const futureOccurrences = occurrences.filter(occ => {
      const occDt = DateTime.fromJSDate(occ, { zone: tz }).startOf('day');
      const nowDt = DateTime.fromJSDate(now, { zone: tz }).startOf('day');
      const endDt = DateTime.fromJSDate(end, { zone: tz }).startOf('day');
      return occDt > nowDt && occDt < endDt;
    });
    const upcomingTotal = futureOccurrences.length * rule.amount;
    upcomingRecurringByCategory[catId] = (upcomingRecurringByCategory[catId] || 0) + upcomingTotal;
  }

  // Get historical data for WMA (last 3 complete months)
  const completeMonths = getLastNMonths(shiftMonth(monthKey, -1), 3); // previous 3 complete months
  const oldestCompleteMonth = completeMonths[0];
  const { start: histStart } = monthRange(oldestCompleteMonth, tz);
  const { end: histEnd } = monthRange(completeMonths[completeMonths.length - 1], tz);

  const historicalData = await Transaction.aggregate([
    { $match: { userId: uid, type: 'expense', date: { $gte: histStart, $lt: histEnd } } },
    { $group: {
        _id: {
          m: { $dateToString: { format: '%Y-%m', date: '$date', timezone: tz } },
          categoryId: '$categoryId'
        },
        total: { $sum: '$amount' }
      }
    }
  ]);

  // Build historical totals by category
  const historicalByCategory = {};
  for (const row of historicalData) {
    const catId = row._id.categoryId.toString();
    const month = row._id.m;
    if (!historicalByCategory[catId]) {
      historicalByCategory[catId] = {};
    }
    historicalByCategory[catId][month] = row.total;
  }

  // Get previous month total for reference
  const prevMonthKey = shiftMonth(monthKey, -1);
  const { start: prevStart, end: prevEnd } = monthRange(prevMonthKey, tz);
  const prevMonthTotalResult = await Transaction.aggregate([
    { $match: { userId: uid, type: 'expense', date: { $gte: prevStart, $lt: prevEnd } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const previousMonthTotal = prevMonthTotalResult[0]?.total || 0;

  // Get overall budget for current month (categoryId: null)
  const overallBudgetDoc = await Budget.findOne({ userId: uid, month: monthKey, categoryId: null }).lean();
  const overallBudgetLimit = overallBudgetDoc?.limit || null;

  // Build forecast for each category - include categories with current transactions OR upcoming recurring
  const categories = [];
  let projectedTotal = 0;
  let spentSoFar = 0;
  let upcomingRecurringTotal = 0;
  let maxHistoryMonths = 0;

  // Get all category IDs that have either current transactions or upcoming recurring
  const currentMonthCatIds = new Set(currentMonthTxs.map(c => c.categoryId));
  const recurringCatIds = new Set(Object.keys(upcomingRecurringByCategory));
  const allCatIds = new Set([...currentMonthCatIds, ...recurringCatIds]);

  // Create a map for quick lookup of current month transaction data
  const currentMonthTxMap = new Map(currentMonthTxs.map(c => [c.categoryId, c]));

  for (const catId of allCatIds) {
    const currentTx = currentMonthTxMap.get(catId);
    const spent_c = currentTx?.spent || 0;
    const recurringSpent_c = currentTx?.recurringSpent || 0;
    const variableSpent_c = spent_c - recurringSpent_c;
    const upcomingRecurring_c = upcomingRecurringByCategory[catId] || 0;

    // Get category info (from current month txs or from Category model)
    let catName = currentTx?.name || 'Unknown';
    let catColor = currentTx?.color || '#64748b';
    if (!currentTx) {
      // Category has upcoming recurring but no current transactions - fetch category info
      const cat = await Category.findById(catId).lean();
      if (cat) {
        catName = cat.name;
        catColor = cat.color;
      }
    }

    spentSoFar += spent_c;
    upcomingRecurringTotal += upcomingRecurring_c;

    // Run-rate projection
    const runRate_c = e > 0
      ? Math.round(spent_c + (variableSpent_c / e) * r + upcomingRecurring_c)
      : spent_c + upcomingRecurring_c;

    // History projection (WMA)
    const history = historicalByCategory[catId] || {};
    const monthsWithHistory = completeMonths.filter(m => history[m] !== undefined);
    const hasHistory = monthsWithHistory.length > 0;

    // Track max history months across all categories for confidence
    maxHistoryMonths = Math.max(maxHistoryMonths, monthsWithHistory.length);

    let wma_c = 0;
    if (hasHistory) {
      const weights = [0.5, 0.3, 0.2];
      let weightedSum = 0;
      let weightSum = 0;
      // monthsWithHistory is oldest to newest; weights should apply newest=0.5, then 0.3, 0.2
      for (let i = 0; i < monthsWithHistory.length; i++) {
        const month = monthsWithHistory[i];
        // Reverse index: most recent (last in array) gets weights[0]=0.5
        const weightIdx = monthsWithHistory.length - 1 - i;
        weightedSum += weights[weightIdx] * history[month];
        weightSum += weights[weightIdx];
      }
      wma_c = Math.round(weightedSum / weightSum);
    }

    // Blend
    const alpha = D > 0 ? e / D : 0;
    let projected_c;
    if (hasHistory) {
      const floorValue = spent_c + upcomingRecurring_c;
      const wmaFloor = Math.max(wma_c, floorValue);
      projected_c = Math.round(alpha * runRate_c + (1 - alpha) * wmaFloor);
    } else {
      projected_c = runRate_c;
    }

    // Floor
    projected_c = Math.max(projected_c, spent_c + upcomingRecurring_c);

    projectedTotal += projected_c;

    categories.push({
      categoryId: catId,
      name: catName,
      color: catColor,
      spent: spent_c,
      projected: projected_c,
    });
  }

  // Confidence
  let confidence = 'low';
  if (e >= 10 && maxHistoryMonths >= 3) {
    confidence = 'high';
  } else if (e >= 5 && maxHistoryMonths >= 1) {
    confidence = 'medium';
  }

  // Budget check
  const budget = overallBudgetLimit ? {
    limit: overallBudgetLimit,
    willExceed: projectedTotal > overallBudgetLimit
  } : null;

  return {
    month: monthKey,
    daysElapsed: e,
    daysInMonth: D,
    spentSoFar,
    projectedTotal,
    upcomingRecurringTotal,
    previousMonthTotal,
    confidence,
    budget,
    categories,
  };
}