import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, teardown } from './setup.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Transaction } from '../src/models/Transaction.js';

let app;

beforeAll(async () => {
  await setup();
  const { createApp } = await import('../src/app.js');
  app = createApp();
  await connectDB();
});

afterAll(async () => {
  await teardown();
});

let authCookie;
let userId;
let defaultExpenseCategoryId;
let defaultIncomeCategoryId;

describe('Transaction Routes', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Transaction.deleteMany({});

    // Register and login a user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    authCookie = res.headers['set-cookie'];
    userId = res.body.data.user._id;

    // Get default category IDs
    const expenseCat = await Category.findOne({ userId, isDefault: true, type: 'expense' });
    defaultExpenseCategoryId = expenseCat._id.toString();

    const incomeCat = await Category.findOne({ userId, isDefault: true, type: 'income' });
    defaultIncomeCategoryId = incomeCat._id.toString();
  });

  describe('POST /api/transactions', () => {
    it('should create an expense transaction', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Cookie', authCookie)
        .send({
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 1500,
          date: '2024-01-15T10:00:00Z',
          note: 'Lunch',
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('categoryId', defaultExpenseCategoryId);
      expect(res.body.data).toHaveProperty('type', 'expense');
      expect(res.body.data).toHaveProperty('amount', 1500);
      expect(res.body.data).toHaveProperty('note', 'Lunch');
      expect(res.body.data).toHaveProperty('userId', userId);
      expect(res.body.data).toHaveProperty('fingerprint');
    });

    it('should create an income transaction', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Cookie', authCookie)
        .send({
          categoryId: defaultIncomeCategoryId,
          type: 'income',
          amount: 500000,
          date: '2024-01-01T09:00:00Z',
          note: 'Salary',
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('type', 'income');
      expect(res.body.data).toHaveProperty('amount', 500000);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Cookie', authCookie)
        .send({ categoryId: defaultExpenseCategoryId })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post('/api/transactions')
        .set('Cookie', authCookie)
        .send({
          categoryId: fakeId,
          type: 'expense',
          amount: 1000,
          date: '2024-01-15T10:00:00Z',
        })
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for category/type mismatch', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Cookie', authCookie)
        .send({
          categoryId: defaultIncomeCategoryId, // income category
          type: 'expense', // but expense type
          amount: 1000,
          date: '2024-01-15T10:00:00Z',
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate transaction (same fingerprint)', async () => {
      await request(app)
        .post('/api/transactions')
        .set('Cookie', authCookie)
        .send({
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 1500,
          date: '2024-01-15T10:00:00Z',
          note: 'Lunch',
        })
        .expect(201);

      const res = await request(app)
        .post('/api/transactions')
        .set('Cookie', authCookie)
        .send({
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 1500,
          date: '2024-01-15T10:00:00Z',
          note: 'Lunch',
        })
        .expect(409);

      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .post('/api/transactions')
        .send({
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 1000,
          date: '2024-01-15T10:00:00Z',
        })
        .expect(401);
    });
  });

  describe('GET /api/transactions', () => {
    beforeEach(async () => {
      // Create test transactions
      await Transaction.create([
        {
          userId,
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 1000,
          date: new Date('2024-01-10T10:00:00Z'),
          note: 'Coffee',
          fingerprint: 'abc1',
        },
        {
          userId,
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 2000,
          date: new Date('2024-01-15T12:00:00Z'),
          note: 'Lunch',
          fingerprint: 'abc2',
        },
        {
          userId,
          categoryId: defaultIncomeCategoryId,
          type: 'income',
          amount: 50000,
          date: new Date('2024-01-01T09:00:00Z'),
          note: 'Salary',
          fingerprint: 'abc3',
        },
        {
          userId,
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 500,
          date: new Date('2024-02-10T10:00:00Z'),
          note: 'Snack',
          fingerprint: 'abc4',
        },
      ]);
    });

    it('should list all transactions with pagination', async () => {
      const res = await request(app)
        .get('/api/transactions')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(4);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 20);
      expect(res.body.meta).toHaveProperty('total', 4);
      expect(res.body.meta).toHaveProperty('totalPages', 1);
    });

    it('should filter by type', async () => {
      const incomeRes = await request(app)
        .get('/api/transactions?type=income')
        .set('Cookie', authCookie)
        .expect(200);

      expect(incomeRes.body.data).toHaveLength(1);
      expect(incomeRes.body.data[0].type).toBe('income');

      const expenseRes = await request(app)
        .get('/api/transactions?type=expense')
        .set('Cookie', authCookie)
        .expect(200);

      expect(expenseRes.body.data).toHaveLength(3);
      expect(expenseRes.body.data.every(t => t.type === 'expense')).toBe(true);
    });

    it('should filter by categoryId', async () => {
      const res = await request(app)
        .get(`/api/transactions?categoryId=${defaultIncomeCategoryId}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].categoryId).toBe(defaultIncomeCategoryId);
    });

    it('should filter by date range', async () => {
      const res = await request(app)
        .get('/api/transactions?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.data.every(t => new Date(t.date) >= new Date('2024-01-01') && new Date(t.date) <= new Date('2024-01-31'))).toBe(true);
    });

    it('should filter by amount range', async () => {
      const res = await request(app)
        .get('/api/transactions?minAmount=1500&maxAmount=3000')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].amount).toBe(2000);
    });

    it('should search by note', async () => {
      const res = await request(app)
        .get('/api/transactions?search=cof')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].note).toBe('Coffee');
    });

    it('should sort by date ascending', async () => {
      const res = await request(app)
        .get('/api/transactions?sortBy=date&sortOrder=asc')
        .set('Cookie', authCookie)
        .expect(200);

      const dates = res.body.data.map(t => new Date(t.date).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
      }
    });

    it('should sort by amount descending', async () => {
      const res = await request(app)
        .get('/api/transactions?sortBy=amount&sortOrder=desc')
        .set('Cookie', authCookie)
        .expect(200);

      const amounts = res.body.data.map(t => t.amount);
      for (let i = 1; i < amounts.length; i++) {
        expect(amounts[i]).toBeLessThanOrEqual(amounts[i - 1]);
      }
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/transactions?page=1&limit=2')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toHaveProperty('page', 1);
      expect(res.body.meta).toHaveProperty('limit', 2);
      expect(res.body.meta).toHaveProperty('total', 4);
      expect(res.body.meta).toHaveProperty('totalPages', 2);
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .get('/api/transactions')
        .expect(401);
    });
  });

  describe('GET /api/transactions/:id', () => {
    let transactionId;

    beforeEach(async () => {
      const tx = await Transaction.create({
        userId,
        categoryId: defaultExpenseCategoryId,
        type: 'expense',
        amount: 1500,
        date: new Date('2024-01-15T10:00:00Z'),
        note: 'Test Transaction',
        fingerprint: 'test123',
      });
      transactionId = tx._id.toString();
    });

    it('should return the transaction', async () => {
      const res = await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data._id).toBe(transactionId);
      expect(res.body.data.note).toBe('Test Transaction');
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/transactions/${fakeId}`)
        .set('Cookie', authCookie)
        .expect(404);
    });

    it('should return 404 for another user\'s transaction', async () => {
      // Create another user
      const res2 = await request(app)
        .post('/api/auth/register')
        .send({ name: 'User2', email: 'user2@example.com', password: 'password123' });
      const cookie2 = res2.headers['set-cookie'];

      await request(app)
        .get(`/api/transactions/${transactionId}`)
        .set('Cookie', cookie2)
        .expect(404);
    });
  });

  describe('PATCH /api/transactions/:id', () => {
    let transactionId;

    beforeEach(async () => {
      const tx = await Transaction.create({
        userId,
        categoryId: defaultExpenseCategoryId,
        type: 'expense',
        amount: 1500,
        date: new Date('2024-01-15T10:00:00Z'),
        note: 'Original',
        fingerprint: 'test123',
      });
      transactionId = tx._id.toString();
    });

    it('should update transaction amount', async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionId}`)
        .set('Cookie', authCookie)
        .send({ amount: 2000 })
        .expect(200);

      expect(res.body.data.amount).toBe(2000);
    });

    it('should update transaction note', async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionId}`)
        .set('Cookie', authCookie)
        .send({ note: 'Updated note' })
        .expect(200);

      expect(res.body.data.note).toBe('Updated note');
    });

    it('should update transaction date', async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionId}`)
        .set('Cookie', authCookie)
        .send({ date: '2024-01-20T10:00:00Z' })
        .expect(200);

      expect(new Date(res.body.data.date).toISOString()).toBe('2024-01-20T10:00:00.000Z');
    });

    it('should update transaction category (same type)', async () => {
      // Create another expense category
      const newCat = await Category.create({
        userId,
        name: 'New Expense Cat',
        type: 'expense',
        isDefault: false,
      });

      const res = await request(app)
        .patch(`/api/transactions/${transactionId}`)
        .set('Cookie', authCookie)
        .send({ categoryId: newCat._id.toString() })
        .expect(200);

      expect(res.body.data.categoryId).toBe(newCat._id.toString());
    });

    it('should return 400 when changing to category of different type', async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionId}`)
        .set('Cookie', authCookie)
        .send({ categoryId: defaultIncomeCategoryId }) // income category for expense transaction
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .patch(`/api/transactions/${fakeId}`)
        .set('Cookie', authCookie)
        .send({ amount: 2000 })
        .expect(404);
    });

    it('should return 400 for empty update', async () => {
      const res = await request(app)
        .patch(`/api/transactions/${transactionId}`)
        .set('Cookie', authCookie)
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/transactions/:id', () => {
    let transactionId;

    beforeEach(async () => {
      const tx = await Transaction.create({
        userId,
        categoryId: defaultExpenseCategoryId,
        type: 'expense',
        amount: 1500,
        date: new Date('2024-01-15T10:00:00Z'),
        note: 'To Delete',
        fingerprint: 'test123',
      });
      transactionId = tx._id.toString();
    });

    it('should delete the transaction', async () => {
      await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Cookie', authCookie)
        .expect(200);

      const tx = await Transaction.findById(transactionId);
      expect(tx).toBeNull();
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .delete(`/api/transactions/${fakeId}`)
        .set('Cookie', authCookie)
        .expect(404);
    });

    it('should return 404 for another user\'s transaction', async () => {
      const res2 = await request(app)
        .post('/api/auth/register')
        .send({ name: 'User2', email: 'user2@example.com', password: 'password123' });
      const cookie2 = res2.headers['set-cookie'];

      await request(app)
        .delete(`/api/transactions/${transactionId}`)
        .set('Cookie', cookie2)
        .expect(404);
    });
  });

  describe('POST /api/transactions/bulk-delete', () => {
    let transactionIds;

    beforeEach(async () => {
      const txs = await Transaction.create([
        {
          userId,
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 1000,
          date: new Date('2024-01-10T10:00:00Z'),
          note: 'Tx1',
          fingerprint: 'bulk1',
        },
        {
          userId,
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 2000,
          date: new Date('2024-01-15T12:00:00Z'),
          note: 'Tx2',
          fingerprint: 'bulk2',
        },
        {
          userId,
          categoryId: defaultIncomeCategoryId,
          type: 'income',
          amount: 50000,
          date: new Date('2024-01-01T09:00:00Z'),
          note: 'Salary',
          fingerprint: 'bulk3',
        },
      ]);
      transactionIds = txs.map(t => t._id.toString());
    });

    it('should delete multiple transactions', async () => {
      const res = await request(app)
        .post('/api/transactions/bulk-delete')
        .set('Cookie', authCookie)
        .send({ ids: [transactionIds[0], transactionIds[1]] })
        .expect(200);

      expect(res.body.data.deletedCount).toBe(2);

      const remaining = await Transaction.find({ userId });
      expect(remaining).toHaveLength(1);
    });

    it('should not delete other users\' transactions', async () => {
      const res2 = await request(app)
        .post('/api/auth/register')
        .send({ name: 'User2', email: 'user2@example.com', password: 'password123' });
      const cookie2 = res2.headers['set-cookie'];
      const userId2 = res2.body.data.user._id;

      // Create a transaction for user2
      const tx2 = await Transaction.create({
        userId: userId2,
        categoryId: defaultIncomeCategoryId,
        type: 'income',
        amount: 1000,
        date: new Date(),
        note: 'User2 tx',
        fingerprint: 'user2tx',
      });

      // Try to delete it as user1
      const res = await request(app)
        .post('/api/transactions/bulk-delete')
        .set('Cookie', authCookie)
        .send({ ids: [tx2._id.toString()] })
        .expect(200);

      expect(res.body.data.deletedCount).toBe(0);
    });

    it('should return 400 for empty ids array', async () => {
      const res = await request(app)
        .post('/api/transactions/bulk-delete')
        .set('Cookie', authCookie)
        .send({ ids: [] })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for too many IDs', async () => {
      const manyIds = Array(101).fill('507f1f77bcf86cd799439011');
      const res = await request(app)
        .post('/api/transactions/bulk-delete')
        .set('Cookie', authCookie)
        .send({ ids: manyIds })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});