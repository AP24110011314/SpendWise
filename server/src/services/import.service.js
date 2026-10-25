import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import { Category } from '../models/Category.js';
import { ImportBatch } from '../models/ImportBatch.js';
import { generateFingerprint } from '../utils/fingerprint.js';
import { parseDate, formatDateForCsv } from '../utils/dates.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Detect CSV delimiter from first few lines
 */
function detectDelimiter(text) {
  const delimiters = [',', ';', '\t', '|'];
  // Normalize line endings and split
  const lines = text.replace(/\r\n/g, '\n').split('\n').slice(0, 5);

  let bestDelimiter = ',';
  let maxCount = 0;

  for (const delim of delimiters) {
    const counts = lines.map(line => (line.match(new RegExp(`\\${delim}`, 'g')) || []).length);
    const avgCount = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
    if (avgCount > maxCount) {
      maxCount = avgCount;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Parse CSV buffer to array of objects
 */
function parseCsv(buffer, delimiter) {
  const text = buffer.toString('utf-8');
  const actualDelimiter = delimiter || detectDelimiter(text);

  try {
    const records = parse(text, {
      delimiter: actualDelimiter,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
    return { records, delimiter: actualDelimiter, headers: records.length > 0 ? Object.keys(records[0]) : [] };
  } catch (err) {
    throw new Error(`CSV parse error: ${err.message}`);
  }
}

/**
 * Get user categories for mapping suggestions
 */
async function getUserCategories(userId) {
  const categories = await Category.find({ userId }).lean();
  const incomeCategories = categories.filter(c => c.type === 'income').map(c => ({ id: c._id.toString(), name: c.name, color: c.color }));
  const expenseCategories = categories.filter(c => c.type === 'expense').map(c => ({ id: c._id.toString(), name: c.name, color: c.color }));
  return { incomeCategories, expenseCategories, allCategories: [...incomeCategories, ...expenseCategories] };
}

/**
 * Generate mapping suggestions based on header names
 */
function suggestMapping(headers, categories) {
  const commonMappings = {
    date: ['date', 'transaction date', 'posted date', 'booking date', 'value date', 'datum'],
    amount: ['amount', 'transaction amount', 'value', 'betrag', 'montant'],
    debit: ['debit', 'withdrawal', 'outflow', 'charge', 'expense', 'soll', 'débit'],
    credit: ['credit', 'deposit', 'inflow', 'payment received', 'income', 'haben', 'crédit'],
    note: ['note', 'description', 'memo', 'details', 'payee', 'merchant', 'reference', 'verwendungszweck', 'libellé'],
    category: ['category', 'category name', 'type', 'kategorie', 'catégorie'],
  };

  const suggestions = {};
  const lowerHeaders = headers.map(h => h.toLowerCase());

  for (const [field, keywords] of Object.entries(commonMappings)) {
    for (const keyword of keywords) {
      const idx = lowerHeaders.findIndex(h => h.includes(keyword));
      if (idx !== -1) {
        suggestions[field] = headers[idx];
        break;
      }
    }
  }

  // If no amount column but both debit/credit found, suggest both
  if (!suggestions.amount && suggestions.debit && suggestions.credit) {
    suggestions.amountMode = 'split';
  } else if (suggestions.amount) {
    suggestions.amountMode = 'single';
  }

  return suggestions;
}

/**
 * Parse amount from string, handling various formats
 */
function parseAmount(str) {
  if (str === null || str === undefined || str === '') return null;
  // Remove currency symbols, spaces, and handle European format (1.234,56)
  const cleaned = String(str).replace(/[€$£\s]/g, '').replace(/,(\d{2})$/, '.$1');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100); // Convert to minor units
}

/**
 * Parse date from string with multiple format support
 */
function parseDateFlexible(str) {
  if (!str) return null;

  const formats = [
    'yyyy-MM-dd',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'dd.MM.yyyy',
    'yyyy/MM/dd',
    'dd-MM-yyyy',
    'MM-dd-yyyy',
    'yyyy.MM.dd',
    'dd MMM yyyy',
    'MMM dd, yyyy',
  ];

  for (const fmt of formats) {
    try {
      const parsed = parseDate(str, fmt);
      if (parsed && !isNaN(parsed.getTime())) return parsed;
    } catch {
      // Try next format
    }
  }

  // Try ISO date
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) return iso;

  return null;
}

/**
 * Find or create category by name
 */
async function resolveCategory(userId, categoryName, defaultType) {
  if (!categoryName) return null;

  const normalized = categoryName.trim();
  let category = await Category.findOne({ userId, name: { $regex: new RegExp(`^${normalized}$`, 'i') } });

  if (!category) {
    // Create new category
    category = await Category.create({
      userId,
      name: normalized,
      type: defaultType,
      color: defaultType === 'income' ? '#22c55e' : '#ef4444',
    });
  }

  return category;
}

/**
 * Build transaction object from CSV row based on mapping
 */
function buildTransactionFromRow(row, mapping, userId, rowIndex) {
  const errors = [];

  // Parse date
  const dateStr = row[mapping.date];
  const date = parseDateFlexible(dateStr);
  if (!date) {
    errors.push({ row: rowIndex, reason: `Invalid date format: ${dateStr}` });
  }

  // Parse amount based on mode
  let amount = null;
  let type = null;

  if (mapping.amountMode === 'split') {
    const debit = parseAmount(row[mapping.debit]);
    const credit = parseAmount(row[mapping.credit]);

    if (debit !== null && debit > 0) {
      amount = debit;
      type = 'expense';
    } else if (credit !== null && credit > 0) {
      amount = credit;
      type = 'income';
    } else {
      errors.push({ row: rowIndex, reason: 'Both debit and credit are empty or zero' });
    }
  } else {
    // Single amount column - determine type from sign or separate type column
    const rawAmount = parseAmount(row[mapping.amount]);
    if (rawAmount === null) {
      errors.push({ row: rowIndex, reason: `Invalid amount: ${row[mapping.amount]}` });
    } else {
      amount = Math.abs(rawAmount);
      // Check if there's a type column
      if (mapping.type && row[mapping.type]) {
        const typeVal = String(row[mapping.type]).toLowerCase();
        if (typeVal.includes('credit') || typeVal.includes('income') || typeVal.includes('deposit') || typeVal === 'cr') {
          type = 'income';
        } else if (typeVal.includes('debit') || typeVal.includes('expense') || typeVal.includes('withdrawal') || typeVal === 'db') {
          type = 'expense';
        } else {
          type = rawAmount >= 0 ? 'income' : 'expense';
        }
      } else {
        type = rawAmount >= 0 ? 'income' : 'expense';
      }
    }
  }

  // Parse note
  const note = mapping.note ? (row[mapping.note] || '').trim() : '';

  // Parse category
  let categoryId = null;
  if (mapping.category && row[mapping.category]) {
    // Will be resolved later
    categoryId = row[mapping.category].trim();
  }

  return {
    date,
    amount,
    type,
    note,
    categoryName: categoryId,
    errors,
    fingerprint: null, // Will be generated after category resolution
  };
}

/**
 * Preview import - parse CSV and return preview data without saving
 */
export async function previewImport(userId, buffer, mapping = {}) {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 5 MB limit');
  }

  const { records, delimiter, headers } = parseCsv(buffer);

  if (records.length === 0) {
    throw new Error('CSV file is empty or has no valid rows');
  }

  // Get user categories for suggestions
  const categories = await getUserCategories(userId);

  // Generate mapping suggestions if not provided
  const suggestedMapping = suggestMapping(headers, categories);
  const finalMapping = { ...suggestedMapping, ...mapping };

  // Validate required fields
  if (!finalMapping.date) {
    throw new Error('Date column is required');
  }
  if (!finalMapping.amount && !(finalMapping.debit && finalMapping.credit)) {
    throw new Error('Amount column (or both debit/credit columns) is required');
  }

  // Build preview rows
  const previewRows = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowIndex = i + 1; // 1-based for user display
    const built = buildTransactionFromRow(row, finalMapping, userId, rowIndex);

    if (built.errors.length === 0) {
      validCount++;
      previewRows.push({
        rowIndex,
        date: built.date ? formatDateForCsv(built.date) : '',
        amount: built.amount,
        type: built.type,
        note: built.note,
        categoryName: built.categoryName || '',
        categoryId: '', // Will be filled after resolution
        valid: true,
      });
    } else {
      invalidCount++;
      previewRows.push({
        rowIndex,
        date: row[finalMapping.date] || '',
        amount: row[finalMapping.amount || finalMapping.debit] || '',
        type: '',
        note: row[finalMapping.note] || '',
        categoryName: row[finalMapping.category] || '',
        categoryId: '',
        valid: false,
        errors: built.errors,
      });
    }
  }

  return {
    delimiter,
    headers,
    totalRows: records.length,
    validCount,
    invalidCount,
    previewRows,
    suggestedMapping: finalMapping,
    categories: categories.allCategories,
  };
}

/**
 * Commit import - process validated rows and create transactions
 */
export async function commitImport(userId, buffer, mapping, previewRows) {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 5 MB limit');
  }

  const { records } = parseCsv(buffer, mapping.delimiter);

  // Create import batch record
  const importBatch = await ImportBatch.create({
    userId,
    filename: mapping.filename || 'import.csv',
    totalRows: records.length,
    importedCount: 0,
    skippedDuplicates: 0,
    invalidCount: 0,
    errors: [],
  });

  const transactionsToCreate = [];
  const errors = [];
  let importedCount = 0;
  let skippedDuplicates = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowIndex = i + 1;
    const previewRow = previewRows.find(p => p.rowIndex === rowIndex);

    if (!previewRow || !previewRow.valid) {
      // Check if we have errors from preview
      if (previewRow && previewRow.errors) {
        for (const err of previewRow.errors) {
          errors.push(err);
        }
      }
      continue;
    }

    // Resolve category
    let categoryId = null;
    if (previewRow.categoryName) {
      const category = await resolveCategory(userId, previewRow.categoryName, previewRow.type);
      if (category) categoryId = category._id;
    }

    // If no category resolved, use default
    if (!categoryId) {
      const defaultCategories = await Category.find({ userId, type: previewRow.type }).limit(1);
      if (defaultCategories.length > 0) {
        categoryId = defaultCategories[0]._id;
      }
    }

    if (!categoryId) {
      errors.push({ row: rowIndex, reason: 'No category available for this transaction type' });
      continue;
    }

    // Generate fingerprint for deduplication
    const fingerprint = generateFingerprint({
      userId,
      categoryId,
      type: previewRow.type,
      amount: previewRow.amount,
      date: previewRow.date,
      note: previewRow.note,
    });

    // Check for duplicate
    const existing = await Transaction.findOne({ userId, fingerprint });
    if (existing) {
      skippedDuplicates++;
      continue;
    }

    transactionsToCreate.push({
      userId,
      categoryId,
      type: previewRow.type,
      amount: previewRow.amount,
      note: previewRow.note,
      date: new Date(previewRow.date),
      fingerprint,
      isRecurring: false,
    });
  }

  // Bulk insert transactions
  if (transactionsToCreate.length > 0) {
    try {
      await Transaction.insertMany(transactionsToCreate, { ordered: false });
      importedCount = transactionsToCreate.length;
    } catch (err) {
      // Handle any bulk write errors (e.g., duplicates that slipped through)
      for (const err of err.writeErrors || []) {
        errors.push({ row: err.err.op.rowIndex, reason: err.errmsg });
      }
      importedCount = transactionsToCreate.length - (err.writeErrors?.length || 0);
    }
  }

  // Update import batch
  importBatch.importedCount = importedCount;
  importBatch.skippedDuplicates = skippedDuplicates;
  importBatch.invalidCount = errors.length;
  importBatch.errors = errors;
  await importBatch.save();

  return {
    importBatchId: importBatch._id,
    importedCount,
    skippedDuplicates,
    invalidCount: errors.length,
    errors: errors.slice(0, 100), // Limit errors returned
  };
}

/**
 * Undo import - delete all transactions from a batch
 */
export async function undoImport(userId, importBatchId) {
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(importBatchId)) {
    throw ApiError.notFound('Import batch not found');
  }

  const batch = await ImportBatch.findOne({ _id: importBatchId, userId });
  if (!batch) {
    throw ApiError.notFound('Import batch not found');
  }

  // Find transactions by fingerprint matching this batch's time range
  // Since we don't store fingerprints in batch, we use the createdAt range
  const startOfBatch = batch.createdAt;
  const endOfBatch = new Date(startOfBatch.getTime() + 60000); // 1 minute window

  // Find transactions created during this batch window
  const transactions = await Transaction.find({
    userId,
    createdAt: { $gte: startOfBatch, $lt: endOfBatch },
  }).select('_id');

  const transactionIds = transactions.map(t => t._id);

  if (transactionIds.length > 0) {
    await Transaction.deleteMany({ _id: { $in: transactionIds } });
  }

  // Mark batch as undone (could add a status field, but for now just return count)
  return { deletedCount: transactionIds.length };
}

/**
 * Export transactions to CSV
 */
export async function exportTransactions(userId, filters = {}) {
  const query = { userId };

  // Apply filters
  if (filters.month) {
    const { start, end } = monthRange(filters.month);
    query.date = { $gte: start, $lt: end };
  }
  if (filters.type) {
    query.type = filters.type;
  }
  if (filters.categoryId) {
    query.categoryId = filters.categoryId;
  }
  if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
    query.amount = {};
    if (filters.amountMin !== undefined) query.amount.$gte = filters.amountMin;
    if (filters.amountMax !== undefined) query.amount.$lte = filters.amountMax;
  }
  if (filters.search) {
    query.$or = [
      { note: { $regex: filters.search, $options: 'i' } },
    ];
  }

  const transactions = await Transaction.find(query)
    .populate('categoryId', 'name color type')
    .sort({ date: -1, createdAt: -1 })
    .lean();

  // Format for CSV
  const rows = transactions.map(t => ({
    date: formatDateForCsv(t.date),
    type: t.type,
    amount: t.type === 'income' ? t.amount / 100 : -t.amount / 100, // Positive for income, negative for expense
    note: t.note || '',
    category: t.categoryId?.name || '',
    categoryType: t.categoryId?.type || '',
  }));

  const csv = stringify(rows, {
    header: true,
    columns: ['date', 'type', 'amount', 'note', 'category', 'categoryType'],
  });

  return csv;
}

// Import the date utilities
import { monthRange } from '../utils/dates.js';