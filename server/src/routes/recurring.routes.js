import { Router } from 'express';
import { z } from 'zod';
import {
  createRecurringRuleController,
  listRecurringRulesController,
  getRecurringRuleController,
  updateRecurringRuleController,
  deleteRecurringRuleController,
  processDueRulesController,
  processRuleNowController,
} from '../controllers/recurring.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdSchema, dateSchema, dateOnlySchema, amountSchema, idParamSchema } from '../middleware/validate.js';

const router = Router();

// All recurring routes require authentication
router.use(authMiddleware);

// Validation schemas
const createRecurringSchema = z.object({
  body: z.object({
    categoryId: objectIdSchema,
    type: z.enum(['income', 'expense']),
    amount: amountSchema,
    note: z.string().max(200).optional().default(''),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema.nullable().optional(),
    anchorDay: z.number().int().min(1).max(31),
  }),
  query: z.object({}),
  params: z.object({}),
});

const listRecurringSchema = z.object({
  body: z.object({}),
  query: z.object({
    activeOnly: z.coerce.boolean().optional().default(false),
  }),
  params: z.object({}),
});

const getRecurringSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: idParamSchema,
});

const updateRecurringSchema = z.object({
  body: z.object({
    categoryId: objectIdSchema.optional(),
    type: z.enum(['income', 'expense']).optional(),
    amount: amountSchema.optional(),
    note: z.string().max(200).optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional(),
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.nullable().optional(),
    anchorDay: z.number().int().min(1).max(31).optional(),
    active: z.boolean().optional(),
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' }),
  query: z.object({}),
  params: idParamSchema,
});

const deleteRecurringSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: idParamSchema,
});

const processRuleNowSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: idParamSchema,
});

const processDueSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: z.object({}),
});

// Recurring rule CRUD
router.post('/', validate(createRecurringSchema), createRecurringRuleController);
router.get('/', validate(listRecurringSchema), listRecurringRulesController);
router.get('/:id', validate(getRecurringSchema), getRecurringRuleController);
router.patch('/:id', validate(updateRecurringSchema), updateRecurringRuleController);
router.delete('/:id', validate(deleteRecurringSchema), deleteRecurringRuleController);

// Processing endpoints
router.post('/process', validate(processDueSchema), processDueRulesController);
router.post('/:id/process', validate(processRuleNowSchema), processRuleNowController);

export default router;