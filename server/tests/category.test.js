import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, teardown } from './setup.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Transaction } from '../src/models/Transaction.js';
import { generateFingerprint } from '../src/utils/fingerprint.js';
import { Budget } from '../src/models/Budget.js';
import { RecurringRule } from '../src/models/RecurringRule.js';

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

describe('Category Routes', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Transaction.deleteMany({});
    await Budget.deleteMany({});
    await RecurringRule.deleteMany({});

    // Register and login a user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    authCookie = res.headers['set-cookie'];
    userId = res.body.data.user._id;
  });

  describe('GET /api/categories', () => {
    it('should list all default categories for user', async () => {
      const res = await request(app)
        .get('/api/categories')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(15);
      expect(res.body.data.every(c => c.userId === userId)).toBe(true);
      expect(res.body.data.every(c => c.isDefault === true)).toBe(true);
    });

    it('should filter by type', async () => {
      const incomeRes = await request(app)
        .get('/api/categories?type=income')
        .set('Cookie', authCookie)
        .expect(200);

      expect(incomeRes.body.data).toHaveLength(5);
      expect(incomeRes.body.data.every(c => c.type === 'income')).toBe(true);

      const expenseRes = await request(app)
        .get('/api/categories?type=expense')
        .set('Cookie', authCookie)
        .expect(200);

      expect(expenseRes.body.data).toHaveLength(10);
      expect(expenseRes.body.data.every(c => c.type === 'expense')).toBe(true);
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .get('/api/categories')
        .expect(401);
    });
  });

  describe('POST /api/categories', () => {
    it('should create a new category', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send({ name: 'Custom Category', type: 'expense', color: '#ff0000', icon: 'star' })
        .expect(201);

      expect(res.body.data).toHaveProperty('name', 'Custom Category');
      expect(res.body.data).toHaveProperty('type', 'expense');
      expect(res.body.data).toHaveProperty('color', '#ff0000');
      expect(res.body.data).toHaveProperty('icon', 'star');
      expect(res.body.data).toHaveProperty('isDefault', false);
      expect(res.body.data).toHaveProperty('userId', userId);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send({ name: 'Test' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate category name per user per type', async () => {
      await request(app)
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send({ name: 'Custom Category', type: 'expense' })
        .expect(201);

      const res = await request(app)
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send({ name: 'Custom Category', type: 'expense' })
        .expect(409);

      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should allow same name for different types', async () => {
      await request(app)
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send({ name: 'Test Category', type: 'expense' })
        .expect(201);

      const res = await request(app)
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send({ name: 'Test Category', type: 'income' })
        .expect(201);

      expect(res.body.data.type).toBe('income');
    });
  });

  describe('GET /api/categories/:id', () => {
    let categoryId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send({ name: 'Test Category', type: 'expense' });
      categoryId = res.body.data._id;
    });

    it('should return the category', async () => {
      const res = await request(app)
        .get(`/api/categories/${categoryId}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data._id).toBe(categoryId);
      expect(res.body.data.name).toBe('Test Category');
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/categories/${fakeId}`)
        .set('Cookie', authCookie)
        .expect(404);
    });

    it('should return 404 for another user\'s category', async () => {
      // Create another user
      const res2 = await request(app)
        .post('/api/auth/register')
        .send({ name: 'User2', email: 'user2@example.com', password: 'password123' });
      const cookie2 = res2.headers['set-cookie'];

      await request(app)
        .get(`/api/categories/${categoryId}`)
        .set('Cookie', cookie2)
        .expect(404);
    });
  });

  describe('PATCH /api/categories/:id', () => {
    let categoryId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send({ name: 'Test Category', type: 'expense' });
      categoryId = res.body.data._id;
    });

    it('should update category name', async () => {
      const res = await request(app)
        .patch(`/api/categories/${categoryId}`)
        .set('Cookie', authCookie)
        .send({ name: 'Updated Category' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated Category');
    });

    it('should update category color', async () => {
      const res = await request(app)
        .patch(`/api/categories/${categoryId}`)
        .set('Cookie', authCookie)
        .send({ color: '#00ff00' })
        .expect(200);

      expect(res.body.data.color).toBe('#00ff00');
    });

    it('should update category icon', async () => {
      const res = await request(app)
        .patch(`/api/categories/${categoryId}`)
        .set('Cookie', authCookie)
        .send({ icon: 'heart' })
        .expect(200);

      expect(res.body.data.icon).toBe('heart');
    });

    it('should return 404 for non-existent category', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .patch(`/api/categories/${fakeId}`)
        .set('Cookie', authCookie)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    let categoryId;
    let defaultCategoryId;

    beforeEach(async () => {
      // Create a custom category
      const res = await request(app)
        .post('/api/categories')
        .set('Cookie', authCookie)
        .send({ name: 'Custom Category', type: 'expense' });
      categoryId = res.body.data._id;

      // Get a default category ID
      const defaultCat = await Category.findOne({ userId, isDefault: true, type: 'expense' });
      defaultCategoryId = defaultCat._id.toString();
    });

    it('should delete unused custom category', async () => {
      await request(app)
        .delete(`/api/categories/${categoryId}`)
        .set('Cookie', authCookie)
        .expect(200);

      const cat = await Category.findById(categoryId);
      expect(cat).toBeNull();
    });

    it('should return 400 when trying to delete default category', async () => {
      const res = await request(app)
        .delete(`/api/categories/${defaultCategoryId}`)
        .set('Cookie', authCookie)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 when category is in use without reassignTo', async () => {
      // Create a transaction using the category
      const date = new Date();
      const fingerprint = generateFingerprint({
        userId,
        categoryId,
        type: 'expense',
        amount: 1000,
        date,
        note: '',
      });
      await Transaction.create({
        userId,
        categoryId,
        type: 'expense',
        amount: 1000,
        date,
        fingerprint,
      });

      const res = await request(app)
        .delete(`/api/categories/${categoryId}`)
        .set('Cookie', authCookie)
        .expect(409);

      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should reassign transactions when reassignTo provided', async () => {
      // Create a transaction using the category
      const date = new Date();
      const fingerprint = generateFingerprint({
        userId,
        categoryId,
        type: 'expense',
        amount: 1000,
        date,
        note: '',
      });
      await Transaction.create({
        userId,
        categoryId,
        type: 'expense',
        amount: 1000,
        date,
        fingerprint,
      });

      await request(app)
        .delete(`/api/categories/${categoryId}?reassignTo=${defaultCategoryId}`)
        .set('Cookie', authCookie)
        .expect(200);

      // Check transaction was reassigned
      const tx = await Transaction.findOne({ userId });
      expect(tx.categoryId.toString()).toBe(defaultCategoryId);
    });

    it('should reassign budgets when reassignTo provided', async () => {
      // Create a budget using the category
      await Budget.create({
        userId,
        categoryId,
        month: '2024-01',
        limit: 50000,
      });

      await request(app)
        .delete(`/api/categories/${categoryId}?reassignTo=${defaultCategoryId}`)
        .set('Cookie', authCookie)
        .expect(200);

      // Check budget was reassigned
      const budget = await Budget.findOne({ userId });
      expect(budget.categoryId.toString()).toBe(defaultCategoryId);
    });

    it('should reassign recurring rules when reassignTo provided', async () => {
      // Create a recurring rule using the category
      const startDate = new Date();
      await RecurringRule.create({
        userId,
        categoryId,
        type: 'expense',
        amount: 1000,
        frequency: 'monthly',
        startDate,
        anchorDay: startDate.getDate(),
        nextRunAt: startDate,
      });

      await request(app)
        .delete(`/api/categories/${categoryId}?reassignTo=${defaultCategoryId}`)
        .set('Cookie', authCookie)
        .expect(200);

      // Check recurring rule was reassigned
      const rule = await RecurringRule.findOne({ userId });
      expect(rule.categoryId.toString()).toBe(defaultCategoryId);
    });

    it('should return 404 for non-existent reassignTo category', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .delete(`/api/categories/${categoryId}?reassignTo=${fakeId}`)
        .set('Cookie', authCookie)
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for reassignTo category of wrong type', async () => {
      const incomeCat = await Category.findOne({ userId, isDefault: true, type: 'income' });
      const res = await request(app)
        .delete(`/api/categories/${categoryId}?reassignTo=${incomeCat._id}`)
        .set('Cookie', authCookie)
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});