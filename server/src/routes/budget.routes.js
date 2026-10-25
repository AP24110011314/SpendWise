import { Router } from 'express';
import { z } from 'zod';
import {
  getProgressController,
  createBudgetController,
  listBudgetsController,
  getBudgetController,
  updateBudgetController,
  deleteBudgetController,
  copyBudgetsController,
  listNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
} from '../controllers/budget.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { monthSchema, idParamSchema } from '../middleware/validate.js';

const router = Router();

// All budget routes require authentication
router.use(authMiddleware);

// Validation schemas
const progressSchema = z.object({
  body: z.object({}),
  query: z.object({
    month: monthSchema.optional(),
  }),
  params: z.object({}),
});

const createBudgetSchema = z.object({
  body: z.object({
    categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
    month: monthSchema,
    limit: z.number().int().positive(),
    alertThreshold: z.number().int().min(1).max(100).optional().default(80),
  }),
  query: z.object({}),
  params: z.object({}),
});

const listBudgetsSchema = z.object({
  body: z.object({}),
  query: z.object({
    month: monthSchema.optional(),
  }),
  params: z.object({}),
});

const getBudgetSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: idParamSchema,
});

const updateBudgetSchema = z.object({
  body: z.object({
    categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
    limit: z.number().int().positive().optional(),
    alertThreshold: z.number().int().min(1).max(100).optional(),
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' }),
  query: z.object({}),
  params: idParamSchema,
});

const deleteBudgetSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: idParamSchema,
});

const copyBudgetsSchema = z.object({
  body: z.object({
    fromMonth: monthSchema,
    toMonth: monthSchema,
  }),
  query: z.object({}),
  params: z.object({}),
});

const notificationsSchema = z.object({
  body: z.object({}),
  query: z.object({
    unreadOnly: z.boolean().optional(),
  }).passthrough(),
  params: z.object({}),
});

const markNotificationReadSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: idParamSchema,
});

const markAllNotificationsReadSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: z.object({}),
});

// Budget CRUD
router.get('/progress', validate(progressSchema), getProgressController);
router.post('/', validate(createBudgetSchema), createBudgetController);
router.get('/', validate(listBudgetsSchema), listBudgetsController);

// Notifications (must come before /:id routes to avoid conflicts)
router.get('/notifications', listNotificationsController);
router.patch('/notifications/:id/read', validate(markNotificationReadSchema), markNotificationReadController);
router.post('/notifications/read-all', validate(markAllNotificationsReadSchema), markAllNotificationsReadController);

// Budget CRUD with :id params
router.get('/:id', validate(getBudgetSchema), getBudgetController);
router.patch('/:id', validate(updateBudgetSchema), updateBudgetController);
router.delete('/:id', validate(deleteBudgetSchema), deleteBudgetController);

// Copy budgets
router.post('/copy', validate(copyBudgetsSchema), copyBudgetsController);

export default router;