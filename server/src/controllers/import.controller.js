import { ApiError } from '../utils/ApiError.js';
import {
  previewImport,
  commitImport,
  undoImport,
  exportTransactions,
} from '../services/import.service.js';

export async function previewImportController(req, res, next) {
  try {
    const userId = req.userId;
    const file = req.file;

    if (!file) {
      throw ApiError.badRequest('No file uploaded');
    }

    // Extract mapping from query params if provided
    const mapping = {};
    if (req.query.mapping) {
      try {
        Object.assign(mapping, JSON.parse(req.query.mapping));
      } catch {
        // Ignore invalid JSON
      }
    }
    mapping.filename = file.originalname;

    const preview = await previewImport(userId, file.buffer, mapping);

    res.json({ data: preview });
  } catch (err) {
    next(err);
  }
}

export async function commitImportController(req, res, next) {
  try {
    const userId = req.userId;
    const body = req.validated.body;
    const mapping = body.mapping || body.options || {};
    const previewRows = body.previewRows || [];

    // For new imports, file buffer is required
    let buffer;
    if (req.file) {
      buffer = req.file.buffer;
    } else {
      throw ApiError.badRequest('File required for new import');
    }

    const result = await commitImport(userId, buffer, mapping, previewRows);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function undoImportController(req, res, next) {
  try {
    const userId = req.userId;
    const { id } = req.validated.params;

    const result = await undoImport(userId, id);

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function listImportBatchesController(req, res, next) {
  try {
    const userId = req.userId;
    const { ImportBatch } = await import('../models/ImportBatch.js');

    const batches = await ImportBatch.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ data: batches });
  } catch (err) {
    next(err);
  }
}

export async function exportTransactionsController(req, res, next) {
  try {
    const userId = req.userId;
    const filters = req.validated.query;

    const csv = await exportTransactions(userId, filters);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}