import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import { setup, teardown } from './setup.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Transaction } from '../src/models/Transaction.js';
import { RecurringRule } from '../src/models/RecurringRule.js';
import { currentMonth, monthRange, nextOccurrence, getDueOccurrences } from '../src/utils/dates.js';

// Helper to get local date string in Asia/Kolkata timezone
function localDateStr(date) {
  return DateTime.fromJSDate(date, { zone: 'Asia/Kolkata' }).toFormat('yyyy-MM-dd');
}

let app;
let cookie;
let userId;
let expenseCategoryId;
let incomeCategoryId;
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

describe('Recurring Transactions', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Transaction.deleteMany({});
    await RecurringRule.deleteMany({});
    await registerAndLogin();
    testMonth = currentMonth();

    // Create test categories
    const expenseCat = await createCategory('expense', 'Groceries');
    expenseCategoryId = expenseCat.id;
    const incomeCat = await createCategory('income', 'Salary');
    incomeCategoryId = incomeCat.id;
  });

  describe('POST /api/recurring', () => {
    it('creates a monthly recurring rule', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          note: 'Monthly rent',
          frequency: 'monthly',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          anchorDay: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 5000,
        note: 'Monthly rent',
        frequency: 'monthly',
        anchorDay: 1,
        active: true,
      });
      expect(res.body.data.nextRunAt).toBeDefined();
    });

    it('creates a weekly recurring rule', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 1000,
          note: 'Weekly groceries',
          frequency: 'weekly',
          startDate: '2026-01-05',
          anchorDay: 5, // day of week (but we use anchorDay as day of month for monthly)
        });

      expect(res.status).toBe(201);
      expect(res.body.data.frequency).toBe('weekly');
    });

    it('creates a daily recurring rule', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 100,
          note: 'Daily coffee',
          frequency: 'daily',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.frequency).toBe('daily');
    });

    it('creates a yearly recurring rule', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: incomeCategoryId,
          type: 'income',
          amount: 60000,
          note: 'Yearly bonus',
          frequency: 'yearly',
          startDate: '2026-01-15',
          anchorDay: 15,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.frequency).toBe('yearly');
    });

    it('rejects invalid frequency', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          frequency: 'invalid',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      expect(res.status).toBe(400);
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          // missing amount, frequency, startDate, anchorDay
        });

      expect(res.status).toBe(400);
    });

    it('rejects non-existent category', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: fakeId,
          type: 'expense',
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      expect(res.status).toBe(404);
    });

    it('rejects category/type mismatch', async () => {
      const res = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: incomeCategoryId, // income category
          type: 'expense', // but type is expense
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/recurring', () => {
    it('lists recurring rules', async () => {
      await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      const res = await request(app)
        .get('/api/recurring')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0]).toHaveProperty('categoryName');
      expect(res.body.data[0]).toHaveProperty('categoryColor');
    });

    it('filters active rules only', async () => {
      await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      // Create an inactive rule by updating it
      const createRes = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 1000,
          frequency: 'weekly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });
      const ruleId = createRes.body.data._id;

      await request(app)
        .patch(`/api/recurring/${ruleId}`)
        .set('Cookie', cookie)
        .send({ active: false });

      const res = await request(app)
        .get('/api/recurring?activeOnly=true')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].active).toBe(true);
    });
  });

  describe('GET /api/recurring/:id', () => {
    it('gets a single recurring rule', async () => {
      const createRes = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      const ruleId = createRes.body.data._id;

      const res = await request(app)
        .get(`/api/recurring/${ruleId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(ruleId);
      expect(res.body.data).toHaveProperty('categoryName');
    });

    it('returns 404 for non-existent rule', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/recurring/${fakeId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/recurring/:id', () => {
    it('updates a recurring rule', async () => {
      const createRes = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      const ruleId = createRes.body.data._id;

      const res = await request(app)
        .patch(`/api/recurring/${ruleId}`)
        .set('Cookie', cookie)
        .send({ amount: 6000, note: 'Updated rent' });

      expect(res.status).toBe(200);
      expect(res.body.data.amount).toBe(6000);
      expect(res.body.data.note).toBe('Updated rent');
    });

    it('deactivates a rule', async () => {
      const createRes = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      const ruleId = createRes.body.data._id;

      const res = await request(app)
        .patch(`/api/recurring/${ruleId}`)
        .set('Cookie', cookie)
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(res.body.data.active).toBe(false);
    });
  });

  describe('DELETE /api/recurring/:id', () => {
    it('deletes a recurring rule', async () => {
      const createRes = await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      const ruleId = createRes.body.data._id;

      const res = await request(app)
        .delete(`/api/recurring/${ruleId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);

      // Verify it's deleted
      const getRes = await request(app)
        .get(`/api/recurring/${ruleId}`)
        .set('Cookie', cookie);
      expect(getRes.status).toBe(404);
    });
  });

  describe('POST /api/recurring/process', () => {
    it('processes due recurring rules', async () => {
      // Create a rule with start date in the past
      await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      const res = await request(app)
        .post('/api/recurring/process')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('processedCount');
      expect(res.body.data).toHaveProperty('createdCount');
      expect(res.body.data).toHaveProperty('skippedCount');
      expect(res.body.data).toHaveProperty('errors');
    });

    it('does not create duplicate transactions on second run', async () => {
      // Create a rule with start date in the past
      await request(app)
        .post('/api/recurring')
        .set('Cookie', cookie)
        .send({
          categoryId: expenseCategoryId,
          type: 'expense',
          amount: 5000,
          frequency: 'monthly',
          startDate: '2026-01-01',
          anchorDay: 1,
        });

      // First run - should process all due occurrences
      const res1 = await request(app)
        .post('/api/recurring/process')
        .set('Cookie', cookie);
      console.log('Process run 1:', JSON.stringify(res1.body.data));
      expect(res1.body.data.processedCount).toBe(1);
      expect(res1.body.data.createdCount).toBeGreaterThan(0);
      expect(res1.body.data.skippedCount).toBe(0);
      expect(res1.body.data.errors).toEqual([]);

      // Second run - rule is now caught up (nextRunAt advanced), so nothing to process
      const res2 = await request(app)
        .post('/api/recurring/process')
        .set('Cookie', cookie);
      console.log('Process run 2:', JSON.stringify(res2.body.data));
      expect(res2.body.data.processedCount).toBe(0);
      expect(res2.body.data.createdCount).toBe(0);
      expect(res2.body.data.skippedCount).toBe(0);
      expect(res2.body.data.errors).toEqual([]);
    });
  });

  describe('nextOccurrence utility', () => {
    it('handles monthly recurrence with clamping (Jan 31 -> Feb 28)', () => {
      const rule = {
        frequency: 'monthly',
        startDate: new Date('2026-01-31'),
        anchorDay: 31,
        endDate: null,
      };

      const next = nextOccurrence(rule, new Date('2026-01-31'));
      expect(next).not.toBeNull();
      // February 2026 has 28 days
      expect(localDateStr(next)).toBe('2026-02-28');
    });

    it('handles monthly recurrence with clamping (Feb 28 -> Mar 31)', () => {
      const rule = {
        frequency: 'monthly',
        startDate: new Date('2026-02-28'),
        anchorDay: 31,
        endDate: null,
      };

      const next = nextOccurrence(rule, new Date('2026-02-28'));
      expect(next).not.toBeNull();
      // March 2026 has 31 days
      expect(localDateStr(next)).toBe('2026-03-31');
    });

    it('handles yearly recurrence with clamping', () => {
      const rule = {
        frequency: 'yearly',
        startDate: new Date('2024-02-29'), // 2024 is a leap year
        anchorDay: 29,
        endDate: null,
      };

      const next = nextOccurrence(rule, new Date('2024-02-29'));
      expect(next).not.toBeNull();
      // 2025 is not a leap year, Feb has 28 days
      expect(localDateStr(next)).toBe('2025-02-28');
    });

    it('respects endDate', () => {
      const rule = {
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        anchorDay: 1,
        endDate: new Date('2026-06-30'),
      };

      const next = nextOccurrence(rule, new Date('2026-06-01'));
      // From June 1, the next occurrence would be July 1, which is past endDate (June 30)
      // So it should return null
      expect(next).toBeNull();

      // If we check from May 1, next should be June 1 (within endDate)
      const nextMay = nextOccurrence(rule, new Date('2026-05-01'));
      expect(nextMay).not.toBeNull();
      expect(localDateStr(nextMay)).toBe('2026-06-01');
    });
  });

  describe('getDueOccurrences utility', () => {
    it('returns multiple occurrences for overdue rule', () => {
      const rule = {
        frequency: 'monthly',
        startDate: new Date('2026-01-01'),
        anchorDay: 1,
        endDate: null,
        nextRunAt: new Date('2026-01-01'),
      };

      const occurrences = getDueOccurrences(rule, new Date('2026-04-15'));
      // Should get Jan, Feb, Mar, Apr occurrences
      expect(occurrences.length).toBe(4);
    });

    it('returns empty array if no occurrences due', () => {
      const rule = {
        frequency: 'monthly',
        startDate: new Date('2026-05-01'),
        anchorDay: 1,
        endDate: null,
        nextRunAt: new Date('2026-05-01'),
      };

      const occurrences = getDueOccurrences(rule, new Date('2026-04-15'));
      expect(occurrences.length).toBe(0);
    });
  });
});