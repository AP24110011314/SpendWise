import { Router } from 'express';
import { z } from 'zod';
import {
  createTransactionController,
  listTransactionsController,
  getTransactionController,
  updateTransactionController,
  deleteTransactionController,
  bulkDeleteTransactionsController,
} from '../controllers/transaction.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdSchema, dateSchema, amountSchema, monthSchema } from '../middleware/validate.js';

const router = Router();

const createTransactionSchema = z.object({
  body: z.object({
    categoryId: objectIdSchema,
    type: z.enum(['income', 'expense']),
    amount: amountSchema,
    date: dateSchema,
    note: z.string().max(200).optional().default(''),
  }),
  query: z.object({}),
  params: z.object({}),
});

const listTransactionsSchema = z.object({
  body: z.object({}),
  query: z.object({
    type: z.enum(['income', 'expense']).optional(),
    categoryId: objectIdSchema.optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
    minAmount: amountSchema.optional(),
    maxAmount: amountSchema.optional(),
    search: z.string().max(100).optional(),
    sortBy: z.enum(['date', 'amount', 'createdAt', 'updatedAt']).optional().default('date'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
  params: z.object({}),
});

const getTransactionSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: z.object({
    id: objectIdSchema,
  }),
});

const updateTransactionSchema = z.object({
  body: z.object({
    categoryId: objectIdSchema.optional(),
    type: z.enum(['income', 'expense']).optional(),
    amount: amountSchema.optional(),
    date: dateSchema.optional(),
    note: z.string().max(200).optional(),
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' }),
  query: z.object({}),
  params: z.object({
    id: objectIdSchema,
  }),
});

const deleteTransactionSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: z.object({
    id: objectIdSchema,
  }),
});

const bulkDeleteSchema = z.object({
  body: z.object({
    ids: z.array(objectIdSchema).min(1, 'At least one ID required').max(100, 'Too many IDs'),
  }),
  query: z.object({}),
  params: z.object({}),
});

// All transaction routes require authentication
router.use(authMiddleware);

router.post('/', validate(createTransactionSchema), createTransactionController);
router.get('/', validate(listTransactionsSchema), listTransactionsController);
router.get('/:id', validate(getTransactionSchema), getTransactionController);
router.patch('/:id', validate(updateTransactionSchema), updateTransactionController);
router.delete('/:id', validate(deleteTransactionSchema), deleteTransactionController);
router.post('/bulk-delete', validate(bulkDeleteSchema), bulkDeleteTransactionsController);

export default router;