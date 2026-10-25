import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { setup, teardown } from './setup.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Transaction } from '../src/models/Transaction.js';
import { ImportBatch } from '../src/models/ImportBatch.js';
import { generateFingerprint } from '../src/utils/fingerprint.js';

let app;
let cookie;
let userId;
let expenseCategoryId;
let incomeCategoryId;

beforeAll(async () => {
  await setup();
  const { createApp } = await import('../src/app.js');
  app = createApp();
  await connectDB();
});

afterAll(async () => {
  await teardown();
});

async function registerAndLogin() {
  const email = `test${Date.now()}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', name: 'Test User' });
  expect(res.status).toBe(201);
  cookie = res.headers['set-cookie'];
  userId = res.body.data.user._id;
  return cookie;
}

let categoryCounter = 0;
async function createCategory(type = 'expense', name = null) {
  const baseName = name || 'Test Category';
  const uniqueName = `${baseName} ${++categoryCounter}`;
  const res = await request(app)
    .post('/api/categories')
    .set('Cookie', cookie)
    .send({ name: uniqueName, type, color: '#ff0000' });
  expect(res.status).toBe(201);
  return { id: res.body.data._id, name: uniqueName };
}

function readFixture(filename) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', filename));
}

describe('CSV Import / Export', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Transaction.deleteMany({});
    await ImportBatch.deleteMany({});
    await registerAndLogin();

    // Create test categories
    const expenseCat = await createCategory('expense', 'Food');
    expenseCategoryId = expenseCat.id;
    const incomeCat = await createCategory('income', 'Salary');
    incomeCategoryId = incomeCat.id;
  });

  describe('POST /api/import/preview', () => {
    it('previews a standard CSV with comma delimiter', async () => {
      const buffer = readFixture('bank-standard.csv');

      const res = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv');

      expect(res.status).toBe(200);
      expect(res.body.data.totalRows).toBe(5);
      expect(res.body.data.validCount).toBe(5);
      expect(res.body.data.invalidCount).toBe(0);
      expect(res.body.data.previewRows).toHaveLength(5);
      expect(res.body.data.suggestedMapping.date).toBe('Date');
      expect(res.body.data.suggestedMapping.amount).toBe('Amount');
    });

    it('previews a European CSV with semicolon delimiter', async () => {
      const buffer = readFixture('bank-european.csv');

      const res = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-european.csv');

      expect(res.status).toBe(200);
      expect(res.body.data.delimiter).toBe(';');
      expect(res.body.data.totalRows).toBe(5);
      expect(res.body.data.validCount).toBe(5);
    });

    it('previews a split debit/credit CSV', async () => {
      const buffer = readFixture('bank-split.csv');

      const res = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-split.csv');

      expect(res.status).toBe(200);
      expect(res.body.data.suggestedMapping.amountMode).toBe('split');
      expect(res.body.data.suggestedMapping.debit).toBe('Debit');
      expect(res.body.data.suggestedMapping.credit).toBe('Credit');
      expect(res.body.data.validCount).toBe(5);
    });

    it('reports invalid rows with row numbers', async () => {
      const buffer = readFixture('bank-bad-rows.csv');

      const res = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-bad-rows.csv');

      expect(res.status).toBe(200);
      expect(res.body.data.totalRows).toBe(6);
      expect(res.body.data.invalidCount).toBeGreaterThan(0);
      // Check that errors have row numbers
      const invalidRows = res.body.data.previewRows.filter(r => !r.valid);
      expect(invalidRows.length).toBeGreaterThan(0);
      for (const row of invalidRows) {
        expect(row.errors).toBeDefined();
        expect(row.errors[0].row).toBeDefined();
      }
    });

    it('rejects non-CSV files', async () => {
      const buffer = Buffer.from('not a csv');

      const res = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'test.txt');

      expect(res.status).toBe(400);
    });

    it('rejects files over 5MB', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');

      const res = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', largeBuffer, 'large.csv');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/import/commit', () => {
    it('commits a valid import and creates transactions', async () => {
      const buffer = readFixture('bank-standard.csv');

      // First preview
      const previewRes = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv');

      const previewData = previewRes.body.data;

      // Then commit
      const commitRes = await request(app)
        .post('/api/import/commit')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv')
        .field('mapping', JSON.stringify(previewData.suggestedMapping))
        .field('previewRows', JSON.stringify(previewData.previewRows));

      expect(commitRes.status).toBe(200);
      expect(commitRes.body.data.importedCount).toBe(5);
      expect(commitRes.body.data.skippedDuplicates).toBe(0);
      expect(commitRes.body.data.invalidCount).toBe(0);

      // Verify transactions were created
      const transactions = await Transaction.find({ userId });
      expect(transactions.length).toBe(5);
    });

    it('importing the same CSV twice skips all rows the second time (fingerprint dedupe)', async () => {
      const buffer = readFixture('bank-standard.csv');

      // First preview
      const previewRes = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv');

      const previewData = previewRes.body.data;

      // First commit
      await request(app)
        .post('/api/import/commit')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv')
        .field('mapping', JSON.stringify(previewData.suggestedMapping))
        .field('previewRows', JSON.stringify(previewData.previewRows));

      // Second commit - same data
      const commitRes2 = await request(app)
        .post('/api/import/commit')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv')
        .field('mapping', JSON.stringify(previewData.suggestedMapping))
        .field('previewRows', JSON.stringify(previewData.previewRows));

      expect(commitRes2.status).toBe(200);
      expect(commitRes2.body.data.importedCount).toBe(0);
      expect(commitRes2.body.data.skippedDuplicates).toBe(5);

      // Verify only 5 transactions exist
      const transactions = await Transaction.find({ userId });
      expect(transactions.length).toBe(5);
    });

    it('creates import batch record', async () => {
      const buffer = readFixture('bank-standard.csv');

      const previewRes = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv');

      const previewData = previewRes.body.data;

      const commitRes = await request(app)
        .post('/api/import/commit')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv')
        .field('mapping', JSON.stringify(previewData.suggestedMapping))
        .field('previewRows', JSON.stringify(previewData.previewRows));

      const batchId = commitRes.body.data.importBatchId;
      expect(batchId).toBeDefined();

      const batch = await ImportBatch.findById(batchId);
      expect(batch).toBeDefined();
      expect(batch.importedCount).toBe(5);
      expect(batch.filename).toBe('bank-standard.csv');
    });

    it('handles custom category mapping', async () => {
      const buffer = readFixture('bank-standard.csv');

      const previewRes = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv');

      const previewData = previewRes.body.data;
      // Modify mapping to use specific category
      const mapping = {
        ...previewData.suggestedMapping,
        category: 'Category', // Use the Category column from CSV
      };

      // Modify preview rows to include category name
      const previewRows = previewData.previewRows.map(row => ({
        ...row,
        categoryName: row.categoryName || 'Food',
      }));

      const commitRes = await request(app)
        .post('/api/import/commit')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv')
        .field('mapping', JSON.stringify(mapping))
        .field('previewRows', JSON.stringify(previewRows));

      expect(commitRes.status).toBe(200);
      expect(commitRes.body.data.importedCount).toBe(5);
    });
  });

  describe('POST /api/import/:id/undo', () => {
    it('undoes an import and removes the batch transactions', async () => {
      const buffer = readFixture('bank-standard.csv');

      const previewRes = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv');

      const previewData = previewRes.body.data;

      const commitRes = await request(app)
        .post('/api/import/commit')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv')
        .field('mapping', JSON.stringify(previewData.suggestedMapping))
        .field('previewRows', JSON.stringify(previewData.previewRows));

      const batchId = commitRes.body.data.importBatchId;

      // Verify transactions exist
      let transactions = await Transaction.find({ userId });
      expect(transactions.length).toBe(5);

      // Undo the import
      const undoRes = await request(app)
        .post(`/api/import/${batchId}/undo`)
        .set('Cookie', cookie);

      expect(undoRes.status).toBe(200);
      expect(undoRes.body.data.deletedCount).toBe(5);

      // Verify transactions are removed
      transactions = await Transaction.find({ userId });
      expect(transactions.length).toBe(0);
    });

    it('returns 404 for non-existent batch', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app)
        .post(`/api/import/${fakeId}/undo`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/import/history', () => {
    it('lists import batches', async () => {
      const buffer = readFixture('bank-standard.csv');

      const previewRes = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv');

      const previewData = previewRes.body.data;

      await request(app)
        .post('/api/import/commit')
        .set('Cookie', cookie)
        .attach('file', buffer, 'bank-standard.csv')
        .field('mapping', JSON.stringify(previewData.suggestedMapping))
        .field('previewRows', JSON.stringify(previewData.previewRows));

      const res = await request(app)
        .get('/api/import/history')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]).toHaveProperty('filename');
      expect(res.body.data[0]).toHaveProperty('importedCount');
      expect(res.body.data[0]).toHaveProperty('skippedDuplicates');
      expect(res.body.data[0]).toHaveProperty('invalidCount');
    });
  });

  describe('GET /api/import/export', () => {
    it('exports transactions as CSV', async () => {
      // Create some transactions first
      await Transaction.create([
        { userId, categoryId: expenseCategoryId, type: 'expense', amount: 12550, note: 'Groceries', date: new Date('2026-01-15'), fingerprint: 'test1' },
        { userId, categoryId: incomeCategoryId, type: 'income', amount: 500000, note: 'Salary', date: new Date('2026-01-20'), fingerprint: 'test2' },
      ]);

      const res = await request(app)
        .get('/api/import/export')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('.csv');

      const csvText = res.text;
      expect(csvText).toContain('date,type,amount,note,category,categoryType');
      expect(csvText).toContain('Groceries');
      expect(csvText).toContain('Salary');
    });

    it('exports with month filter', async () => {
      await Transaction.create([
        { userId, categoryId: expenseCategoryId, type: 'expense', amount: 12550, note: 'Groceries', date: new Date('2026-01-15'), fingerprint: 'test1' },
        { userId, categoryId: expenseCategoryId, type: 'expense', amount: 4500, note: 'Gas', date: new Date('2026-02-10'), fingerprint: 'test2' },
      ]);

      const res = await request(app)
        .get('/api/import/export?month=2026-01')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const csvText = res.text;
      const lines = csvText.trim().split('\n');
      // Header + 1 data row
      expect(lines.length).toBe(2);
    });

    it('exports with type filter', async () => {
      await Transaction.create([
        { userId, categoryId: expenseCategoryId, type: 'expense', amount: 12550, note: 'Groceries', date: new Date('2026-01-15'), fingerprint: 'test1' },
        { userId, categoryId: incomeCategoryId, type: 'income', amount: 500000, note: 'Salary', date: new Date('2026-01-20'), fingerprint: 'test2' },
      ]);

      const res = await request(app)
        .get('/api/import/export?type=income')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      const csvText = res.text;
      const lines = csvText.trim().split('\n');
      // Header + 1 data row
      expect(lines.length).toBe(2);
      expect(csvText).toContain('income');
      expect(csvText).not.toContain('expense');
    });
  });

  describe('Round-trip: Export and re-import', () => {
    it('exported CSV can be re-imported cleanly', async () => {
      // Create transactions with real fingerprints
      const fingerprint1 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 12550,
        date: new Date('2026-01-15'),
        note: 'Groceries',
      });
      const fingerprint2 = generateFingerprint({
        userId,
        categoryId: incomeCategoryId,
        type: 'income',
        amount: 500000,
        date: new Date('2026-01-20'),
        note: 'Salary',
      });
      await Transaction.create([
        { userId, categoryId: expenseCategoryId, type: 'expense', amount: 12550, note: 'Groceries', date: new Date('2026-01-15'), fingerprint: fingerprint1 },
        { userId, categoryId: incomeCategoryId, type: 'income', amount: 500000, note: 'Salary', date: new Date('2026-01-20'), fingerprint: fingerprint2 },
      ]);

      // Export
      const exportRes = await request(app)
        .get('/api/import/export')
        .set('Cookie', cookie);

      expect(exportRes.status).toBe(200);
      const csvBuffer = Buffer.from(exportRes.text);

      // Import the exported CSV
      const previewRes = await request(app)
        .post('/api/import/preview')
        .set('Cookie', cookie)
        .attach('file', csvBuffer, 'export.csv');

      const previewData = previewRes.body.data;

      const commitRes = await request(app)
        .post('/api/import/commit')
        .set('Cookie', cookie)
        .attach('file', csvBuffer, 'export.csv')
        .field('mapping', JSON.stringify(previewData.suggestedMapping))
        .field('previewRows', JSON.stringify(previewData.previewRows));

      expect(commitRes.status).toBe(200);
      // Should skip duplicates
      expect(commitRes.body.data.skippedDuplicates).toBe(2);
      expect(commitRes.body.data.importedCount).toBe(0);
    });
  });
});