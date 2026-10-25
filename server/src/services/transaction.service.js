import { Transaction } from '../models/Transaction.js';
import { Category } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { generateFingerprint } from '../models/Transaction.js';

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

export async function createTransaction(userId, data, now = new Date()) {
  const { categoryId, type, amount, date, note } = data;

  await validateCategoryOwnership(userId, categoryId, type);

  const txDate = new Date(date);
  const fingerprint = generateFingerprint(userId, txDate, type, amount, note || '');

  // Check for duplicate fingerprint
  const existing = await Transaction.findOne({ userId, fingerprint });
  if (existing) {
    throw ApiError.conflict('Duplicate transaction detected');
  }

  const transaction = await Transaction.create({
    userId,
    categoryId,
    type,
    amount,
    date: txDate,
    note: note || '',
    fingerprint,
  });

  return transaction;
}

export async function listTransactions(userId, filters, now = new Date()) {
  const {
    type,
    categoryId,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    search,
    sortBy = 'date',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
  } = filters;

  const query = { userId };

  if (type) {
    query.type = type;
  }

  if (categoryId) {
    query.categoryId = categoryId;
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  if (minAmount || maxAmount) {
    query.amount = {};
    if (minAmount) query.amount.$gte = Number(minAmount);
    if (maxAmount) query.amount.$lte = Number(maxAmount);
  }

  if (search) {
    query.note = { $regex: search, $options: 'i' };
  }

  const allowedSortFields = ['date', 'amount', 'createdAt', 'updatedAt'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'date';
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  return {
    data: transactions,
    meta: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

export async function getTransaction(userId, transactionId) {
  const transaction = await Transaction.findOne({ _id: transactionId, userId });
  if (!transaction) {
    throw ApiError.notFound('Transaction not found');
  }
  return transaction;
}

export async function updateTransaction(userId, transactionId, data, now = new Date()) {
  const transaction = await Transaction.findOne({ _id: transactionId, userId });
  if (!transaction) {
    throw ApiError.notFound('Transaction not found');
  }

  const { categoryId, type, amount, date, note } = data;

  const newCategoryId = categoryId ?? transaction.categoryId;
  const newType = type ?? transaction.type;
  const newAmount = amount ?? transaction.amount;
  const newDate = date ? new Date(date) : transaction.date;
  const newNote = note !== undefined ? note : transaction.note;

  // If category or type changed, validate
  if (categoryId || type) {
    await validateCategoryOwnership(userId, newCategoryId, newType);
  }

  // Recalculate fingerprint if relevant fields changed
  let newFingerprint = transaction.fingerprint;
  if (categoryId || type || amount || date || note !== undefined) {
    newFingerprint = generateFingerprint(userId, newDate, newType, newAmount, newNote);
    const existing = await Transaction.findOne({
      userId,
      fingerprint: newFingerprint,
      _id: { $ne: transactionId },
    });
    if (existing) {
      throw ApiError.conflict('Duplicate transaction detected');
    }
  }

  transaction.categoryId = newCategoryId;
  transaction.type = newType;
  transaction.amount = newAmount;
  transaction.date = newDate;
  transaction.note = newNote;
  transaction.fingerprint = newFingerprint;

  await transaction.save();
  return transaction;
}

export async function deleteTransaction(userId, transactionId) {
  const transaction = await Transaction.findOneAndDelete({ _id: transactionId, userId });
  if (!transaction) {
    throw ApiError.notFound('Transaction not found');
  }
  return { success: true };
}

export async function bulkDeleteTransactions(userId, ids) {
  const result = await Transaction.deleteMany({ _id: { $in: ids }, userId });
  return { deletedCount: result.deletedCount };
}