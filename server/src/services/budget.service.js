import mongoose from 'mongoose';
import { Budget } from '../models/Budget.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { monthRange, currentMonth } from '../utils/dates.js';

/**
 * Get budget progress for a month using aggregation pipeline
 */
export async function getBudgetProgress(userId, month, tz = 'Asia/Kolkata') {
  const uid = new mongoose.Types.ObjectId(userId);
  const { start, end } = monthRange(month, tz);

  const results = await Budget.aggregate([
    { $match: { userId: uid, month } },
    {
      $lookup: {
        from: 'transactions',
        let: { cid: '$categoryId', uid: '$userId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$userId', '$$uid'] },
                  { $eq: ['$type', 'expense'] },
                  { $gte: ['$date', start] },
                  { $lt: ['$date', end] },
                  {
                    $or: [
                      { $eq: ['$$cid', null] },
                      { $eq: ['$categoryId', '$$cid'] }
                    ]
                  }
                ]
              }
            }
          },
          { $group: { _id: null, spent: { $sum: '$amount' } } }
        ],
        as: 'spend'
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'cat'
      }
    },
    {
      $addFields: {
        spent: { $ifNull: [{ $first: '$spend.spent' }, 0] },
        categoryName: { $ifNull: [{ $first: '$cat.name' }, 'Overall'] },
        color: { $ifNull: [{ $first: '$cat.color' }, '#64748b'] }
      }
    },
    {
      $project: { spend: 0, cat: 0 }
    }
  ]);

  return results.map(b => ({
    ...b,
    _id: b._id.toString(),
    userId: b.userId.toString(),
    categoryId: b.categoryId?.toString() || null,
    remaining: b.limit - b.spent,
    pct: b.limit > 0 ? Math.round((b.spent / b.limit) * 1000) / 10 : 0,
    status: b.spent >= b.limit ? 'exceeded' : (b.spent >= (b.limit * b.alertThreshold / 100) ? 'warning' : 'ok')
  }));
}

/**
 * Create a new budget
 */
export async function createBudget(userId, data) {
  const { categoryId, month, limit, alertThreshold } = data;

  // Validate category ownership if categoryId provided
  if (categoryId) {
    const category = await Category.findOne({ _id: categoryId, userId });
    if (!category) {
      throw ApiError.notFound('Category not found');
    }
  }

  // Check if budget already exists for this category/month
  const existing = await Budget.findOne({ userId, month, categoryId: categoryId || null });
  if (existing) {
    throw ApiError.conflict('Budget already exists for this category and month');
  }

  const budget = await Budget.create({
    userId,
    categoryId: categoryId || null,
    month,
    limit,
    alertThreshold: alertThreshold || 80,
  });

  return budget;
}

/**
 * List budgets for a month
 */
export async function listBudgets(userId, month) {
  const query = { userId };
  if (month) query.month = month;

  const budgets = await Budget.find(query).sort({ month: -1, categoryId: 1 }).lean();
  return budgets.map(b => ({
    ...b,
    _id: b._id.toString(),
    userId: b.userId.toString(),
    categoryId: b.categoryId?.toString() || null,
  }));
}

/**
 * Get a single budget
 */
export async function getBudget(userId, budgetId) {
  const budget = await Budget.findOne({ _id: budgetId, userId });
  if (!budget) {
    throw ApiError.notFound('Budget not found');
  }
  return budget;
}

/**
 * Update a budget
 */
export async function updateBudget(userId, budgetId, data) {
  const budget = await Budget.findOne({ _id: budgetId, userId });
  if (!budget) {
    throw ApiError.notFound('Budget not found');
  }

  const { categoryId, limit, alertThreshold } = data;

  // Validate category ownership if categoryId provided
  if (categoryId) {
    const category = await Category.findOne({ _id: categoryId, userId });
    if (!category) {
      throw ApiError.notFound('Category not found');
    }
  }

  if (categoryId !== undefined) budget.categoryId = categoryId || null;
  if (limit !== undefined) budget.limit = limit;
  if (alertThreshold !== undefined) budget.alertThreshold = alertThreshold;

  await budget.save();
  return budget;
}

/**
 * Delete a budget
 */
export async function deleteBudget(userId, budgetId) {
  const budget = await Budget.findOneAndDelete({ _id: budgetId, userId });
  if (!budget) {
    throw ApiError.notFound('Budget not found');
  }
  return { success: true };
}

/**
 * Copy budgets from one month to another
 */
export async function copyBudgets(userId, fromMonth, toMonth) {
  const budgets = await Budget.find({ userId, month: fromMonth });
  if (budgets.length === 0) {
    throw ApiError.notFound('No budgets found for source month');
  }

  const results = [];
  for (const budget of budgets) {
    // Check if budget already exists in target month
    const existing = await Budget.findOne({ userId, month: toMonth, categoryId: budget.categoryId });
    if (existing) {
      continue; // Skip if already exists
    }

    const newBudget = await Budget.create({
      userId,
      categoryId: budget.categoryId,
      month: toMonth,
      limit: budget.limit,
      alertThreshold: budget.alertThreshold,
    });
    results.push(newBudget);
  }

  return results;
}

/**
 * Evaluate budgets for a category/month after transaction changes
 */
export async function evaluateBudgets(userId, categoryId, month, tz = 'Asia/Kolkata') {
  // Find budgets that apply to this category/month
  // This includes the specific category budget and the overall budget (categoryId: null)
  const budgets = await Budget.find({
    userId,
    month,
    categoryId: { $in: [categoryId, null] }
  });

  const notifications = [];

  for (const budget of budgets) {
    // Calculate spent for this budget
    const { start, end } = monthRange(month, tz);
    const matchCategory = budget.categoryId ? { $eq: ['$categoryId', budget.categoryId] } : { $eq: ['$categoryId', budget.categoryId] };

    // For category-specific budget, match exact category
    // For overall budget (categoryId: null), match all expenses
    let spentResult;
    if (budget.categoryId) {
      spentResult = await Transaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), type: 'expense', categoryId: budget.categoryId, date: { $gte: start, $lt: end } } },
        { $group: { _id: null, spent: { $sum: '$amount' } } }
      ]);
    } else {
      spentResult = await Transaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), type: 'expense', date: { $gte: start, $lt: end } } },
        { $group: { _id: null, spent: { $sum: '$amount' } } }
      ]);
    }

    const spent = spentResult[0]?.spent || 0;
    const pct = budget.limit > 0 ? Math.round((spent / budget.limit) * 1000) / 10 : 0;

    let notificationType = null;
    if (pct >= 100) {
      notificationType = 'budget_exceeded';
    } else if (pct >= budget.alertThreshold) {
      notificationType = 'budget_warning';
    }

    if (notificationType) {
      // Check if notification already exists for this budget/type/month
      const existing = await Notification.findOne({
        userId,
        budgetId: budget._id,
        type: notificationType,
        month
      });

      if (!existing) {
        const categoryName = budget.categoryId
          ? (await Category.findById(budget.categoryId))?.name || 'Unknown'
          : 'Overall';

        let message;
        if (notificationType === 'budget_exceeded') {
          message = `You have exceeded your ${categoryName} budget for ${month} (${pct}%).`;
        } else {
          message = `${categoryName} has reached ${pct}% of its budget for ${month}.`;
        }

        try {
          const notification = await Notification.create({
            userId,
            type: notificationType,
            budgetId: budget._id,
            month,
            message,
          });
          notifications.push(notification);
        } catch (err) {
          // Ignore duplicate key errors (11000) - notification already exists
          if (err.code !== 11000) throw err;
        }
      }
    }
  }

  return notifications;
}

/**
 * Get all notifications for a user
 */
export async function listNotifications(userId, { unreadOnly = false } = {}) {
  const query = { userId };
  if (unreadOnly) query.readAt = null;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return notifications.map(n => ({
    ...n,
    _id: n._id.toString(),
    userId: n.userId.toString(),
    budgetId: n.budgetId.toString(),
  }));
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(userId, notificationId) {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId, readAt: null },
    { readAt: new Date() },
    { new: true }
  );
  if (!notification) {
    throw ApiError.notFound('Notification not found or already read');
  }
  return notification;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId) {
  await Notification.updateMany(
    { userId, readAt: null },
    { readAt: new Date() }
  );
  return { success: true };
}