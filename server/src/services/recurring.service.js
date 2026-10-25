import mongoose from 'mongoose';
import { RecurringRule } from '../models/RecurringRule.js';
import { Transaction } from '../models/Transaction.js';
import { Category } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { generateFingerprint } from '../models/Transaction.js';
import { currentMonth, monthRange, nextOccurrence, getDueOccurrences } from '../utils/dates.js';

/**
 * Validate category ownership and type consistency
 */
async function validateCategoryOwnership(userId, categoryId, expectedType) {
  const category = await Category.findOne({ _id: categoryId, userId });
  if (!category) {
    throw ApiError.notFound('Category not found');
  }
  if (category.type !== expectedType) {
    throw ApiError.badRequest(`Category type must be ${expectedType}`);
  }
  return category;
}

/**
 * Create a recurring rule
 */
export async function createRecurringRule(userId, data) {
  const { categoryId, type, amount, note, frequency, startDate, endDate, anchorDay } = data;

  await validateCategoryOwnership(userId, categoryId, type);

  // Calculate initial nextRunAt based on startDate and anchorDay
  const startDt = new Date(startDate);
  const nextRunAt = nextOccurrence(
    { frequency, startDate: startDt, anchorDay, endDate: endDate ? new Date(endDate) : null },
    startDt
  );

  if (!nextRunAt) {
    throw ApiError.badRequest('Invalid recurring rule configuration');
  }

  const rule = await RecurringRule.create({
    userId,
    categoryId,
    type,
    amount,
    note: note || '',
    frequency,
    startDate: startDt,
    endDate: endDate ? new Date(endDate) : null,
    anchorDay,
    nextRunAt,
  });

  return rule;
}

/**
 * List recurring rules
 */
export async function listRecurringRules(userId, { activeOnly = false } = {}) {
  const query = { userId };
  if (activeOnly) query.active = true;

  const rules = await RecurringRule.find(query)
    .sort({ createdAt: -1 })
    .populate('categoryId', 'name color')
    .lean();

  return rules.map(r => ({
    ...r,
    _id: r._id.toString(),
    userId: r.userId.toString(),
    categoryId: r.categoryId._id.toString(),
    categoryName: r.categoryId.name,
    categoryColor: r.categoryId.color,
    nextRunAt: r.nextRunAt.toISOString(),
    startDate: r.startDate.toISOString().split('T')[0],
    endDate: r.endDate ? r.endDate.toISOString().split('T')[0] : null,
    lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
  }));
}

/**
 * Get a single recurring rule
 */
export async function getRecurringRule(userId, ruleId) {
  const rule = await RecurringRule.findOne({ _id: ruleId, userId })
    .populate('categoryId', 'name color')
    .lean();

  if (!rule) {
    throw ApiError.notFound('Recurring rule not found');
  }

  return {
    ...rule,
    _id: rule._id.toString(),
    userId: rule.userId.toString(),
    categoryId: rule.categoryId._id.toString(),
    categoryName: rule.categoryId.name,
    categoryColor: rule.categoryId.color,
    nextRunAt: rule.nextRunAt.toISOString(),
    startDate: rule.startDate.toISOString().split('T')[0],
    endDate: rule.endDate ? rule.endDate.toISOString().split('T')[0] : null,
    lastRunAt: rule.lastRunAt ? rule.lastRunAt.toISOString() : null,
  };
}

/**
 * Update a recurring rule
 */
export async function updateRecurringRule(userId, ruleId, data) {
  const rule = await RecurringRule.findOne({ _id: ruleId, userId });
  if (!rule) {
    throw ApiError.notFound('Recurring rule not found');
  }

  const { categoryId, type, amount, note, frequency, startDate, endDate, anchorDay, active } = data;

  // Validate category if changed
  if (categoryId || type) {
    const newCategoryId = categoryId || rule.categoryId;
    const newType = type || rule.type;
    await validateCategoryOwnership(userId, newCategoryId, newType);
  }

  // Update fields
  if (categoryId !== undefined) rule.categoryId = categoryId;
  if (type !== undefined) rule.type = type;
  if (amount !== undefined) rule.amount = amount;
  if (note !== undefined) rule.note = note || '';
  if (frequency !== undefined) rule.frequency = frequency;
  if (startDate !== undefined) rule.startDate = new Date(startDate);
  if (endDate !== undefined) rule.endDate = endDate ? new Date(endDate) : null;
  if (anchorDay !== undefined) rule.anchorDay = anchorDay;
  if (active !== undefined) rule.active = active;

  // Recalculate nextRunAt if relevant fields changed
  if (frequency !== undefined || startDate !== undefined || endDate !== undefined || anchorDay !== undefined || active !== undefined) {
    const baseDate = rule.nextRunAt || rule.startDate;
    const newNextRunAt = nextOccurrence(
      {
        frequency: rule.frequency,
        startDate: rule.startDate,
        anchorDay: rule.anchorDay,
        endDate: rule.endDate,
      },
      baseDate
    );
    rule.nextRunAt = newNextRunAt;
  }

  await rule.save();
  return rule;
}

/**
 * Delete a recurring rule
 */
export async function deleteRecurringRule(userId, ruleId) {
  const rule = await RecurringRule.findOneAndDelete({ _id: ruleId, userId });
  if (!rule) {
    throw ApiError.notFound('Recurring rule not found');
  }
  return { success: true };
}

/**
 * Process due recurring rules and create transactions
 * Returns { processedCount, createdCount, skippedCount, errors }
 */
export async function processDueRules(userId, now = new Date(), tz = 'Asia/Kolkata') {
  const results = {
    processedCount: 0,
    createdCount: 0,
    skippedCount: 0,
    errors: [],
  };

  // Find active rules where nextRunAt <= now
  const dueRules = await RecurringRule.find({
    userId,
    active: true,
    nextRunAt: { $lte: now },
  });

  for (const rule of dueRules) {
    results.processedCount++;

    try {
      // Get all due occurrences (handles catch-up for overdue rules)
      const occurrences = getDueOccurrences(rule, now, tz);

      for (const occurrenceDate of occurrences) {
        // Check for existing transaction with same fingerprint to avoid duplicates
        const fingerprint = generateFingerprint(
          userId,
          occurrenceDate,
          rule.type,
          rule.amount,
          rule.note || ''
        );

        const existing = await Transaction.findOne({ userId, fingerprint });
        if (existing) {
          results.skippedCount++;
          continue;
        }

        // Create the transaction
        await Transaction.create({
          userId,
          categoryId: rule.categoryId,
          type: rule.type,
          amount: rule.amount,
          date: occurrenceDate,
          note: rule.note || '',
          fingerprint,
          recurringRuleId: rule._id,
          occurrenceDate,
        });

        results.createdCount++;
      }

      // Update rule's nextRunAt and lastRunAt
      const lastOccurrence = occurrences[occurrences.length - 1];
      if (lastOccurrence) {
        rule.lastRunAt = lastOccurrence;
        const nextRunAt = nextOccurrence(
          {
            frequency: rule.frequency,
            startDate: rule.startDate,
            anchorDay: rule.anchorDay,
            endDate: rule.endDate,
          },
          lastOccurrence,
          tz
        );
        rule.nextRunAt = nextRunAt;

        // If no next run (past endDate), deactivate
        if (!nextRunAt) {
          rule.active = false;
        }

        await rule.save();
      }
    } catch (err) {
      results.errors.push({ ruleId: rule._id.toString(), message: err.message });
    }
  }

  return results;
}

/**
 * Manually trigger processing for a specific rule (for testing/admin)
 */
export async function processRuleNow(userId, ruleId, now = new Date(), tz = 'Asia/Kolkata') {
  const rule = await RecurringRule.findOne({ _id: ruleId, userId });
  if (!rule) {
    throw ApiError.notFound('Recurring rule not found');
  }

  if (!rule.active) {
    throw ApiError.badRequest('Rule is not active');
  }

  // Temporarily set nextRunAt to now to force processing
  const originalNextRunAt = rule.nextRunAt;
  rule.nextRunAt = now;
  await rule.save();

  try {
    const results = await processDueRules(userId, now, tz);
    return results;
  } finally {
    // Rule is already updated by processDueRules
  }
}