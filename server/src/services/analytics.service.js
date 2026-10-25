import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import { Category } from '../models/Category.js';
import { Budget } from '../models/Budget.js';
import { monthRange, currentMonth, daysInMonth, shiftMonth, getLastNMonths, startOfDay, endOfDay } from '../utils/dates.js';

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