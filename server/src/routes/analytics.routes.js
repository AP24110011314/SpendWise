import { Router } from 'express';
import { z } from 'zod';
import {
  getSummaryController,
  getByCategoryController,
  getTrendController,
  getDailyController,
  compareMonthsController,
  getForecastController,
} from '../controllers/analytics.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { monthSchema } from '../middleware/validate.js';

const router = Router();

const summarySchema = z.object({
  body: z.object({}),
  query: z.object({
    month: monthSchema.optional(),
  }),
  params: z.object({}),
});

const byCategorySchema = z.object({
  body: z.object({}),
  query: z.object({
    month: monthSchema.optional(),
  }),
  params: z.object({}),
});

const trendSchema = z.object({
  body: z.object({}),
  query: z.object({
    months: z.coerce.number().int().min(1).max(24).optional().default(6),
    referenceMonth: monthSchema.optional(),
  }),
  params: z.object({}),
});

const dailySchema = z.object({
  body: z.object({}),
  query: z.object({
    month: monthSchema.optional(),
  }),
  params: z.object({}),
});

const compareSchema = z.object({
  body: z.object({}),
  query: z.object({
    monthA: monthSchema,
    monthB: monthSchema,
  }),
  params: z.object({}),
});

const forecastSchema = z.object({
  body: z.object({}),
  query: z.object({
    now: z.string().datetime({ offset: true }).optional(), // For testing: fixed date in ISO format
  }),
  params: z.object({}),
});

// All analytics routes require authentication
router.use(authMiddleware);

router.get('/summary', validate(summarySchema), getSummaryController);
router.get('/by-category', validate(byCategorySchema), getByCategoryController);
router.get('/trend', validate(trendSchema), getTrendController);
router.get('/daily', validate(dailySchema), getDailyController);
router.get('/compare', validate(compareSchema), compareMonthsController);
router.get('/forecast', validate(forecastSchema), getForecastController);

export default router;