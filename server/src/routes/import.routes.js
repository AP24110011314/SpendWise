import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import {
  previewImportController,
  commitImportController,
  undoImportController,
  listImportBatchesController,
  exportTransactionsController,
} from '../controllers/import.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdSchema, idParamSchema } from '../middleware/validate.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// All import routes require authentication
router.use(authMiddleware);

// Configure multer for memory storage with 5MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

// Multer error handling wrapper
function handleMulterError(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(ApiError.badRequest('File size exceeds 5 MB limit'));
        }
        return next(ApiError.badRequest(err.message));
      }
      if (err.message === 'Only CSV files are allowed') {
        return next(ApiError.badRequest('Only CSV files are allowed'));
      }
      return next(err);
    }
    next();
  });
}

// Validation schemas
const previewSchema = z.object({
  body: z.object({}),
  query: z.object({
    mapping: z.string().optional(), // JSON string of mapping
  }),
  params: z.object({}),
});

const commitSchema = z.object({
  body: z.object({
    importBatchId: objectIdSchema.optional(),
    mapping: z.string().transform((val) => {
      try {
        return JSON.parse(val);
      } catch {
        return {};
      }
    }).pipe(z.object({
      filename: z.string().optional(),
      delimiter: z.string().optional(),
      date: z.string(),
      amount: z.string().optional(),
      debit: z.string().optional(),
      credit: z.string().optional(),
      note: z.string().optional(),
      category: z.string().optional(),
      type: z.string().optional(),
      amountMode: z.enum(['single', 'split']).optional(),
    })),
    previewRows: z.string().transform((val) => {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }).pipe(z.array(z.object({
      rowIndex: z.number().int().positive(),
      date: z.string(),
      amount: z.number().int().positive(),
      type: z.enum(['income', 'expense']),
      note: z.string().optional(),
      categoryName: z.string().optional(),
      categoryId: z.string().optional(),
      valid: z.boolean(),
      errors: z.array(z.object({
        row: z.number(),
        reason: z.string(),
      })).optional(),
    }))),
  }),
  query: z.object({}),
  params: z.object({}),
});

const undoSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: idParamSchema,
});

const listBatchesSchema = z.object({
  body: z.object({}),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  }),
  params: z.object({}),
});

const exportSchema = z.object({
  body: z.object({}),
  query: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    type: z.enum(['income', 'expense']).optional(),
    categoryId: objectIdSchema.optional(),
    amountMin: z.coerce.number().int().min(0).optional(),
    amountMax: z.coerce.number().int().min(0).optional(),
    search: z.string().max(200).optional(),
  }),
  params: z.object({}),
});

// Import routes
router.post('/preview', handleMulterError, validate(previewSchema), previewImportController);
router.post('/commit', handleMulterError, validate(commitSchema), commitImportController);
router.post('/:id/undo', validate(undoSchema), undoImportController);
router.get('/history', validate(listBatchesSchema), listImportBatchesController);

// Export route
router.get('/export', validate(exportSchema), exportTransactionsController);

export default router;