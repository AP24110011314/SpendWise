import {
  getBudgetProgress,
  createBudget,
  listBudgets,
  getBudget,
  updateBudget,
  deleteBudget,
  copyBudgets,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/budget.service.js';
import { ApiError } from '../utils/ApiError.js';
import { currentMonth } from '../utils/dates.js';

/**
 * GET /api/budgets/progress?month=YYYY-MM
 */
export async function getProgressController(req, res, next) {
  try {
    const { month } = req.query;
    const progress = await getBudgetProgress(req.userId, month || currentMonth());
    res.json({ data: progress, progress });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/budgets
 */
export async function createBudgetController(req, res, next) {
  try {
    const budget = await createBudget(req.userId, req.body);
    res.status(201).json({ data: budget, budget });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/budgets?month=YYYY-MM
 */
export async function listBudgetsController(req, res, next) {
  try {
    const { month } = req.query;
    const budgets = await listBudgets(req.userId, month);
    res.json({ data: budgets, budgets });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/budgets/:id
 */
export async function getBudgetController(req, res, next) {
  try {
    const budget = await getBudget(req.userId, req.params.id);
    res.json({ data: budget, budget });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/budgets/:id
 */
export async function updateBudgetController(req, res, next) {
  try {
    const budget = await updateBudget(req.userId, req.params.id, req.body);
    res.json({ data: budget, budget });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/budgets/:id
 */
export async function deleteBudgetController(req, res, next) {
  try {
    await deleteBudget(req.userId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/budgets/copy
 */
export async function copyBudgetsController(req, res, next) {
  try {
    const { fromMonth, toMonth } = req.body;
    if (!fromMonth || !toMonth) {
      throw ApiError.badRequest('fromMonth and toMonth are required');
    }
    const budgets = await copyBudgets(req.userId, fromMonth, toMonth);
    res.json({ data: budgets, budgets });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/budgets/notifications?unreadOnly=true
 */
export async function listNotificationsController(req, res, next) {
  try {
    const { unreadOnly } = req.query;
    const notifications = await listNotifications(req.userId, { unreadOnly: unreadOnly === 'true' });
    res.json({ data: notifications, notifications });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/budgets/notifications/:id/read
 */
export async function markNotificationReadController(req, res, next) {
  try {
    const notification = await markNotificationRead(req.userId, req.params.id);
    res.json({ data: notification, notification });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/budgets/notifications/read-all
 */
export async function markAllNotificationsReadController(req, res, next) {
  try {
    await markAllNotificationsRead(req.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}