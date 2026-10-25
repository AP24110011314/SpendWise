import { Router } from 'express';
import { z } from 'zod';
import {
  listCategoriesController,
  createCategoryController,
  getCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from '../controllers/category.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(40, 'Name too long'),
    type: z.enum(['income', 'expense']),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional(),
    icon: z.string().max(30).optional(),
  }),
  query: z.object({}),
  params: z.object({}),
});

const getCategorySchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(40, 'Name too long').optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional(),
    icon: z.string().max(30).optional(),
  }),
  query: z.object({}),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

const deleteCategorySchema = z.object({
  body: z.object({}),
  query: z.object({
    reassignTo: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID').optional(),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
});

// All category routes require authentication
router.use(authMiddleware);

router.get('/', listCategoriesController);
router.post('/', validate(createCategorySchema), createCategoryController);
router.get('/:id', validate(getCategorySchema), getCategoryController);
router.patch('/:id', validate(updateCategorySchema), updateCategoryController);
router.delete('/:id', validate(deleteCategorySchema), deleteCategoryController);

export default router;