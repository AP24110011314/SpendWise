import {
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  bulkDeleteTransactions,
} from '../services/transaction.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function createTransactionController(req, res, next) {
  try {
    const transaction = await createTransaction(req.userId, req.validated.body);
    res.status(201).json({ data: transaction });
  } catch (err) {
    next(err);
  }
}

export async function listTransactionsController(req, res, next) {
  try {
    const result = await listTransactions(req.userId, req.validated.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTransactionController(req, res, next) {
  try {
    const transaction = await getTransaction(req.userId, req.validated.params.id);
    res.json({ data: transaction });
  } catch (err) {
    next(err);
  }
}

export async function updateTransactionController(req, res, next) {
  try {
    const transaction = await updateTransaction(
      req.userId,
      req.validated.params.id,
      req.validated.body
    );
    res.json({ data: transaction });
  } catch (err) {
    next(err);
  }
}

export async function deleteTransactionController(req, res, next) {
  try {
    await deleteTransaction(req.userId, req.validated.params.id);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
}

export async function bulkDeleteTransactionsController(req, res, next) {
  try {
    const { ids } = req.validated.body;
    const result = await bulkDeleteTransactions(req.userId, ids);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}