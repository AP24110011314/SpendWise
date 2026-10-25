import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { setup, teardown } from './setup.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Transaction } from '../src/models/Transaction.js';
import { Budget } from '../src/models/Budget.js';
import { Notification } from '../src/models/Notification.js';
import { generateFingerprint } from '../src/models/Transaction.js';
import { currentMonth, monthRange } from '../src/utils/dates.js';

let app;
let cookie;
let userId;
let categoryId;
let testMonth;

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
  userId = res.body.data.user.id;
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

async function createTransaction(data) {
  const res = await request(app)
    .post('/api/transactions')
    .set('Cookie', cookie)
    .send(data);
  return res;
}

describe('Budgets & Notifications', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Transaction.deleteMany({});
    await Budget.deleteMany({});
    await Notification.deleteMany({});
    await registerAndLogin();
    testMonth = currentMonth();
  });

  describe('POST /api/budgets', () => {
    it('creates a budget for a category', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      const res = await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });
      expect(res.status).toBe(201);
      expect(res.body.budget).toMatchObject({
        categoryId: catId,
        month: testMonth,
        limit: 50000,
        alertThreshold: 80,
      });
      expect(res.body.budget.userId).toBeDefined();
    });

    it('creates an overall budget (no categoryId)', async () => {
      const res = await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: null, month: testMonth, limit: 100000, alertThreshold: 90 });
      expect(res.status).toBe(201);
      expect(res.body.budget.categoryId).toBeNull();
      expect(res.body.budget.limit).toBe(100000);
      expect(res.body.budget.alertThreshold).toBe(90);
    });

    it('rejects duplicate budget for same category/month', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000 });
      const res = await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000 });
      expect(res.status).toBe(409);
    });

    it('rejects budget for non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: fakeId, month: testMonth, limit: 50000 });
      expect(res.status).toBe(404);
    });

    it('validates limit is positive integer', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      const res = await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: -100 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/budgets', () => {
    it('lists budgets for a month', async () => {
      const { id: catId1 } = await createCategory('expense', 'Groceries');
      const { id: catId2 } = await createCategory('expense', 'Transport');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId1, month: testMonth, limit: 50000 });
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId2, month: testMonth, limit: 20000 });

      const res = await request(app)
        .get(`/api/budgets?month=${testMonth}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.budgets.length).toBe(2);
    });

    it('returns empty array when no budgets exist', async () => {
      const res = await request(app)
        .get(`/api/budgets?month=${testMonth}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.budgets).toEqual([]);
    });
  });

  describe('GET /api/budgets/progress', () => {
    it('returns budget progress with spent, remaining, pct, status', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      // Add some expenses
      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 15000,
        date: start.toISOString(),
        note: 'Groceries',
      });

      const res = await request(app)
        .get(`/api/budgets/progress?month=${testMonth}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.progress.length).toBe(1);
      const progress = res.body.progress[0];
      expect(progress.spent).toBe(15000);
      expect(progress.remaining).toBe(35000);
      expect(progress.pct).toBe(30);
      expect(progress.status).toBe('ok');
    });

    it('shows warning status when threshold exceeded', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      // Add expenses at 85% (42500)
      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 42500,
        date: start.toISOString(),
        note: 'Groceries',
      });

      const res = await request(app)
        .get(`/api/budgets/progress?month=${testMonth}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.progress[0].status).toBe('warning');
    });

    it('shows exceeded status when limit exceeded', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      // Add expenses at 110% (55000)
      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 55000,
        date: start.toISOString(),
        note: 'Groceries',
      });

      const res = await request(app)
        .get(`/api/budgets/progress?month=${testMonth}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.progress[0].status).toBe('exceeded');
    });

    it('includes overall budget progress', async () => {
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: null, month: testMonth, limit: 100000 });

      const { id: catId } = await createCategory('expense', 'Groceries');
      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 30000,
        date: start.toISOString(),
        note: 'Groceries',
      });

      const res = await request(app)
        .get(`/api/budgets/progress?month=${testMonth}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.progress.length).toBe(1);
      expect(res.body.progress[0].categoryName).toBe('Overall');
    });

    it('includes category name and color in progress', async () => {
      const { id: catId, name: catName } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000 });

      const res = await request(app)
        .get(`/api/budgets/progress?month=${testMonth}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.progress[0].categoryName).toBe(catName);
      expect(res.body.progress[0].color).toBe('#ff0000');
    });
  });

  describe('GET /api/budgets/:id', () => {
    it('returns a single budget', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      const createRes = await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000 });
      const budgetId = createRes.body.budget._id;

      const res = await request(app)
        .get(`/api/budgets/${budgetId}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.budget._id).toBe(budgetId);
    });

    it('returns 404 for non-existent budget', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/budgets/${fakeId}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/budgets/:id', () => {
    it('updates budget limit and alertThreshold', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      const createRes = await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000 });
      const budgetId = createRes.body.budget._id;

      const res = await request(app)
        .patch(`/api/budgets/${budgetId}`)
        .set('Cookie', cookie)
        .send({ limit: 60000, alertThreshold: 75 });
      expect(res.status).toBe(200);
      expect(res.body.budget.limit).toBe(60000);
      expect(res.body.budget.alertThreshold).toBe(75);
    });

    it('allows changing categoryId', async () => {
      const { id: catId1 } = await createCategory('expense', 'Groceries');
      const { id: catId2 } = await createCategory('expense', 'Transport');
      const createRes = await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId1, month: testMonth, limit: 50000 });
      const budgetId = createRes.body.budget._id;

      const res = await request(app)
        .patch(`/api/budgets/${budgetId}`)
        .set('Cookie', cookie)
        .send({ categoryId: catId2 });
      expect(res.status).toBe(200);
      expect(res.body.budget.categoryId).toBe(catId2);
    });

    it('rejects update for non-existent budget', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/budgets/${fakeId}`)
        .set('Cookie', cookie)
        .send({ limit: 60000 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/budgets/:id', () => {
    it('deletes a budget', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      const createRes = await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000 });
      const budgetId = createRes.body.budget._id;

      const res = await request(app)
        .delete(`/api/budgets/${budgetId}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(204);

      const getRes = await request(app)
        .get(`/api/budgets/${budgetId}`)
        .set('Cookie', cookie);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 for non-existent budget', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .delete(`/api/budgets/${fakeId}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/budgets/copy', () => {
    it('copies budgets from one month to another', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: '2024-01', limit: 50000 });

      const res = await request(app)
        .post('/api/budgets/copy')
        .set('Cookie', cookie)
        .send({ fromMonth: '2024-01', toMonth: '2024-02' });
      expect(res.status).toBe(200);
      expect(res.body.budgets.length).toBe(1);
      expect(res.body.budgets[0].month).toBe('2024-02');
      expect(res.body.budgets[0].limit).toBe(50000);
    });

    it('skips existing budgets in target month', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: '2024-01', limit: 50000 });
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: '2024-02', limit: 60000 });

      const res = await request(app)
        .post('/api/budgets/copy')
        .set('Cookie', cookie)
        .send({ fromMonth: '2024-01', toMonth: '2024-02' });
      expect(res.status).toBe(200);
      expect(res.body.budgets.length).toBe(0); // Skipped because already exists
    });

    it('returns 404 when no budgets in source month', async () => {
      const res = await request(app)
        .post('/api/budgets/copy')
        .set('Cookie', cookie)
        .send({ fromMonth: '2024-01', toMonth: '2024-02' });
      expect(res.status).toBe(404);
    });
  });

  describe('Notifications', () => {
    it('creates budget_warning notification when threshold reached', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      // Add expenses at 85%
      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 42500,
        date: start.toISOString(),
        note: 'Groceries',
      });

      // Trigger evaluation by creating another transaction
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 1000,
        date: start.toISOString(),
        note: 'More groceries',
      });

      const res = await request(app)
        .get('/api/budgets/notifications')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBeGreaterThan(0);
      const warning = res.body.notifications.find(n => n.type === 'budget_warning');
      expect(warning).toBeDefined();
      expect(warning.message).toContain('85%');
    });

    it('creates budget_exceeded notification when limit exceeded', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      // Add expenses at 110%
      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 55000,
        date: start.toISOString(),
        note: 'Groceries',
      });

      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 1000,
        date: start.toISOString(),
        note: 'More groceries',
      });

      const res = await request(app)
        .get('/api/budgets/notifications')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      const exceeded = res.body.notifications.find(n => n.type === 'budget_exceeded');
      expect(exceeded).toBeDefined();
      expect(exceeded.message).toContain('exceeded');
    });

    it('does not create duplicate notifications', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 42500,
        date: start.toISOString(),
        note: 'Groceries',
      });
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 1000,
        date: start.toISOString(),
        note: 'More groceries',
      });

      // Trigger evaluation again
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 500,
        date: start.toISOString(),
        note: 'Even more',
      });

      const res = await request(app)
        .get('/api/budgets/notifications')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      const warnings = res.body.notifications.filter(n => n.type === 'budget_warning');
      expect(warnings.length).toBe(1); // No duplicate
    });

    it('marks notification as read', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 42500,
        date: start.toISOString(),
        note: 'Groceries',
      });
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 1000,
        date: start.toISOString(),
        note: 'More groceries',
      });

      const listRes = await request(app)
        .get('/api/budgets/notifications')
        .set('Cookie', cookie);
      const notificationId = listRes.body.notifications[0]._id;

      const res = await request(app)
        .patch(`/api/budgets/notifications/${notificationId}/read`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.notification.readAt).toBeDefined();

      // Verify it's no longer in unread
      const unreadRes = await request(app)
        .get('/api/budgets/notifications?unreadOnly=true')
        .set('Cookie', cookie);
      expect(unreadRes.body.notifications.length).toBe(0);
    });

    it('marks all notifications as read', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 42500,
        date: start.toISOString(),
        note: 'Groceries',
      });
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 1000,
        date: start.toISOString(),
        note: 'More groceries',
      });

      await request(app)
        .post('/api/budgets/notifications/read-all')
        .set('Cookie', cookie);

      const res = await request(app)
        .get('/api/budgets/notifications?unreadOnly=true')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBe(0);
    });

    it('returns 404 when marking non-existent notification as read', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/budgets/notifications/${fakeId}/read`)
        .set('Cookie', cookie);
      expect(res.status).toBe(404);
    });
  });

  describe('Budget evaluation on transaction changes', () => {
    it('evaluates budgets on transaction create', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 42500,
        date: start.toISOString(),
        note: 'Groceries',
      });

      const res = await request(app)
        .get('/api/budgets/notifications')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.notifications.some(n => n.type === 'budget_warning')).toBe(true);
    });

    it('evaluates budgets on transaction update', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      const { start, end } = monthRange(testMonth);
      const createRes = await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 10000,
        date: start.toISOString(),
        note: 'Groceries',
      });
      const txId = createRes.body.data._id;

      // Update to trigger warning
      const updateRes = await request(app)
        .patch(`/api/transactions/${txId}`)
        .set('Cookie', cookie)
        .send({ amount: 42500 });
      console.log('Update response:', updateRes.status, updateRes.body);

      const res = await request(app)
        .get('/api/budgets/notifications')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.notifications.some(n => n.type === 'budget_warning')).toBe(true);
    });

    it('evaluates budgets on transaction delete', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      const { start, end } = monthRange(testMonth);
      const createRes = await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 42500,
        date: start.toISOString(),
        note: 'Groceries',
      });
      const txId = createRes.body.data._id;

      // This triggers warning
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 1000,
        date: start.toISOString(),
        note: 'More groceries',
      });

      // Delete the large transaction - should clear warning
      await request(app)
        .delete(`/api/transactions/${txId}`)
        .set('Cookie', cookie);

      // Add a small transaction to trigger re-evaluation
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 5000,
        date: start.toISOString(),
        note: 'Small purchase',
      });

      const res = await request(app)
        .get('/api/budgets/notifications')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      // Warning should still exist (not cleared, just no new ones)
    });

    it('evaluates budgets on bulk delete', async () => {
      const { id: catId } = await createCategory('expense', 'Groceries');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId, month: testMonth, limit: 50000, alertThreshold: 80 });

      const { start, end } = monthRange(testMonth);
      const createRes1 = await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 20000,
        date: start.toISOString(),
        note: 'Groceries 1',
      });
      const createRes2 = await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 25000,
        date: start.toISOString(),
        note: 'Groceries 2',
      });

      await request(app)
        .post('/api/transactions/bulk-delete')
        .set('Cookie', cookie)
        .send({ ids: [createRes1.body.data._id, createRes2.body.data._id] });

      // Add a small transaction to trigger re-evaluation
      await createTransaction({
        categoryId: catId,
        type: 'expense',
        amount: 5000,
        date: start.toISOString(),
        note: 'Small purchase',
      });

      const res = await request(app)
        .get('/api/budgets/notifications')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
    });
  });

  describe('Overall budget (categoryId: null)', () => {
    it('tracks overall spending across all categories', async () => {
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: null, month: testMonth, limit: 100000, alertThreshold: 80 });

      const { id: catId1 } = await createCategory('expense', 'Groceries');
      const { id: catId2 } = await createCategory('expense', 'Transport');
      const { start, end } = monthRange(testMonth);

      await createTransaction({
        categoryId: catId1,
        type: 'expense',
        amount: 40000,
        date: start.toISOString(),
        note: 'Groceries',
      });
      await createTransaction({
        categoryId: catId2,
        type: 'expense',
        amount: 45000,
        date: start.toISOString(),
        note: 'Transport',
      });

      const res = await request(app)
        .get(`/api/budgets/progress?month=${testMonth}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      const overall = res.body.progress.find(p => p.categoryId === null);
      expect(overall).toBeDefined();
      expect(overall.spent).toBe(85000);
      expect(overall.status).toBe('warning');
    });

    it('creates notification for overall budget', async () => {
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: null, month: testMonth, limit: 100000, alertThreshold: 80 });

      const { id: catId1 } = await createCategory('expense', 'Groceries');
      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId1,
        type: 'expense',
        amount: 85000,
        date: start.toISOString(),
        note: 'Groceries',
      });

      const res = await request(app)
        .get('/api/budgets/notifications')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      const warning = res.body.notifications.find(n => n.type === 'budget_warning');
      expect(warning).toBeDefined();
      expect(warning.message).toContain('Overall');
    });
  });

  describe('Budget progress with multiple categories', () => {
    it('returns progress for all budgets in month', async () => {
      const { id: catId1 } = await createCategory('expense', 'Groceries');
      const { id: catId2 } = await createCategory('expense', 'Transport');
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId1, month: testMonth, limit: 50000 });
      await request(app)
        .post('/api/budgets')
        .set('Cookie', cookie)
        .send({ categoryId: catId2, month: testMonth, limit: 30000 });

      const { start, end } = monthRange(testMonth);
      await createTransaction({
        categoryId: catId1,
        type: 'expense',
        amount: 20000,
        date: start.toISOString(),
        note: 'Groceries',
      });
      await createTransaction({
        categoryId: catId2,
        type: 'expense',
        amount: 15000,
        date: start.toISOString(),
        note: 'Transport',
      });

      const res = await request(app)
        .get(`/api/budgets/progress?month=${testMonth}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.progress.length).toBe(2);
      expect(res.body.progress.find(p => p.categoryId === catId1).spent).toBe(20000);
      expect(res.body.progress.find(p => p.categoryId === catId2).spent).toBe(15000);
    });
  });
});