import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { Budget } from '../models/Budget.js';
import { RecurringRule } from '../models/RecurringRule.js';
import { ApiError } from '../utils/ApiError.js';

export async function listCategories(userId, type) {
  const filter = { userId: new mongoose.Types.ObjectId(userId) };
  if (type) {
    filter.type = type;
  }
  return Category.find(filter).sort({ type: 1, name: 1 }).lean();
}

export async function createCategory(userId, data) {
  const category = await Category.create({
    userId: new mongoose.Types.ObjectId(userId),
    name: data.name,
    type: data.type,
    color: data.color || '#6366f1',
    icon: data.icon || 'tag',
    isDefault: false,
  });
  return category.toObject();
}

export async function updateCategory(userId, categoryId, data) {
  const category = await Category.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(categoryId), userId: new mongoose.Types.ObjectId(userId) },
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!category) {
    throw ApiError.notFound('Category not found');
  }
  return category.toObject();
}

export async function deleteCategory(userId, categoryId, reassignToId) {
  const category = await Category.findOne({
    _id: new mongoose.Types.ObjectId(categoryId),
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  if (category.isDefault) {
    throw ApiError.badRequest('Cannot delete default categories');
  }

  if (reassignToId) {
    const reassignCategory = await Category.findOne({
      _id: new mongoose.Types.ObjectId(reassignToId),
      userId: new mongoose.Types.ObjectId(userId),
      type: category.type,
    });

    if (!reassignCategory) {
      throw ApiError.notFound('Reassign category not found or type mismatch');
    }

    // Reassign transactions
    await Transaction.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), categoryId: new mongoose.Types.ObjectId(categoryId) },
      { $set: { categoryId: new mongoose.Types.ObjectId(reassignToId) } }
    );

    // Reassign budgets
    await Budget.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), categoryId: new mongoose.Types.ObjectId(categoryId) },
      { $set: { categoryId: new mongoose.Types.ObjectId(reassignToId) } }
    );

    // Reassign recurring rules
    await RecurringRule.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), categoryId: new mongoose.Types.ObjectId(categoryId) },
      { $set: { categoryId: new mongoose.Types.ObjectId(reassignToId) } }
    );
  } else {
    // Check if category is in use
    const [txCount, budgetCount, recurringCount] = await Promise.all([
      Transaction.countDocuments({ userId: new mongoose.Types.ObjectId(userId), categoryId: new mongoose.Types.ObjectId(categoryId) }),
      Budget.countDocuments({ userId: new mongoose.Types.ObjectId(userId), categoryId: new mongoose.Types.ObjectId(categoryId) }),
      RecurringRule.countDocuments({ userId: new mongoose.Types.ObjectId(userId), categoryId: new mongoose.Types.ObjectId(categoryId) }),
    ]);

    if (txCount > 0 || budgetCount > 0 || recurringCount > 0) {
      throw ApiError.conflict('Category is in use. Provide a reassignTo category ID.');
    }
  }

  await Category.deleteOne({ _id: category._id });
  return { success: true };
}

export async function getCategory(userId, categoryId) {
  const category = await Category.findOne({
    _id: new mongoose.Types.ObjectId(categoryId),
    userId: new mongoose.Types.ObjectId(userId),
  }).lean();

  if (!category) {
    throw ApiError.notFound('Category not found');
  }
  return category;
}