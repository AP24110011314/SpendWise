import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategory,
} from '../services/category.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listCategoriesController = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const categories = await listCategories(req.user._id, type);
  res.json({ data: categories });
});

export const createCategoryController = asyncHandler(async (req, res) => {
  const category = await createCategory(req.user._id, req.body);
  res.status(201).json({ data: category });
});

export const getCategoryController = asyncHandler(async (req, res) => {
  const category = await getCategory(req.user._id, req.params.id);
  res.json({ data: category });
});

export const updateCategoryController = asyncHandler(async (req, res) => {
  const category = await updateCategory(req.user._id, req.params.id, req.body);
  res.json({ data: category });
});

export const deleteCategoryController = asyncHandler(async (req, res) => {
  const { reassignTo } = req.query;
  const result = await deleteCategory(req.user._id, req.params.id, reassignTo);
  res.json({ data: result });
});