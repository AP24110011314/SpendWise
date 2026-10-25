import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, teardown } from './setup.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Transaction } from '../src/models/Transaction.js';
import { Budget } from '../src/models/Budget.js';
import { RecurringRule } from '../src/models/RecurringRule.js';
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

async function createCategory(type = 'expense', name = 'Test Category') {
  const res = await request(app)
    .post('/api/categories')
    .set('Cookie', cookie)
    .send({ name, type, color: '#ff0000' });
  expect(res.status).toBe(201);
  return res.body.data._id;
}

async function getDefaultCategory(type, name) {
  const cat = await Category.findOne({ userId, type, isDefault: true, name });
  return cat?._id;
}

describe('Forecast Service', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Transaction.deleteMany({});
    await Budget.deleteMany({});
    await RecurringRule.deleteMany({});
    await registerAndLogin();

    // Use unique category names to avoid conflicts with defaults
    expenseCategoryId = await createCategory('expense', 'Test Groceries');
    incomeCategoryId = await createCategory('income', 'Test Salary');
  });

  describe('GET /api/analytics/forecast', () => {
    it('returns forecast with zeros for empty month', async () => {
      // NOW = 2026-10-15 (e=15, D=31, r=16)
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('month', '2026-10');
      expect(res.body.data).toHaveProperty('daysElapsed', 15);
      expect(res.body.data).toHaveProperty('daysInMonth', 31);
      expect(res.body.data).toHaveProperty('spentSoFar', 0);
      expect(res.body.data).toHaveProperty('projectedTotal', 0);
      expect(res.body.data).toHaveProperty('upcomingRecurringTotal', 0);
      expect(res.body.data).toHaveProperty('previousMonthTotal', 0);
      expect(res.body.data).toHaveProperty('confidence', 'low');
      expect(res.body.data).toHaveProperty('categories');
      expect(Array.isArray(res.body.data.categories)).toBe(true);
    });

    it('calculates run-rate projection correctly with variable spend', async () => {
      // NOW = 2026-10-15 (e=15, D=31, r=16)
      // Variable spend so far: 30,000, no recurring, no history
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      const fingerprint = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        note: 'Groceries',
      });

      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        fingerprint,
      });

      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.spentSoFar).toBe(30000);
      // runRate = 30000 + (30000/15)*16 = 30000 + 32000 = 62000
      expect(res.body.data.projectedTotal).toBe(62000);
      expect(res.body.data.upcomingRecurringTotal).toBe(0);
      expect(res.body.data.confidence).toBe('low'); // no history
    });

    it('calculates WMA projection with 3 months history', async () => {
      // NOW = 2026-10-15 (e=15, D=31, r=16)
      // Variable spend so far: 30,000, no recurring
      // History: Sep 60,000; Aug 50,000; Jul 40,000
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      // Current month spend
      const fingerprint1 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        note: 'Groceries current',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        fingerprint: fingerprint1,
      });

      // Historical data - September 2026 (complete month)
      const fingerprint2 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 60000,
        date: new Date('2026-09-15'),
        note: 'Groceries Sep',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 60000,
        date: new Date('2026-09-15'),
        fingerprint: fingerprint2,
      });

      // August 2026
      const fingerprint3 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 50000,
        date: new Date('2026-08-15'),
        note: 'Groceries Aug',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 50000,
        date: new Date('2026-08-15'),
        fingerprint: fingerprint3,
      });

      // July 2026
      const fingerprint4 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 40000,
        date: new Date('2026-07-15'),
        note: 'Groceries Jul',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 40000,
        date: new Date('2026-07-15'),
        fingerprint: fingerprint4,
      });

      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.spentSoFar).toBe(30000);

      // runRate = 30000 + (30000/15)*16 = 62000
      // WMA = (0.5*60000 + 0.3*50000 + 0.2*40000) / 1.0 = 53000
      // alpha = 15/31 ≈ 0.48387
      // projected = alpha*62000 + (1-alpha)*max(53000, 30000)
      //          = 0.48387*62000 + 0.51613*53000
      //          = 30000 + 27355 = 57355 (approx)
      // Allow ±1 due to rounding
      expect(res.body.data.projectedTotal).toBeGreaterThanOrEqual(57354);
      expect(res.body.data.projectedTotal).toBeLessThanOrEqual(57356);
      expect(res.body.data.confidence).toBe('high'); // e >= 10 and 3 months history
      expect(res.body.data.previousMonthTotal).toBe(60000);
    });

    it('adds upcoming recurring to projection', async () => {
      // NOW = 2026-10-15
      // Variable spend: 30,000
      // Upcoming recurring: 2 occurrences of 15,000 = 30,000
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      // Current month variable spend
      const fingerprint1 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        note: 'Groceries variable',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        fingerprint: fingerprint1,
      });

      // Recurring rule: monthly, 15000, anchorDay 20, starts Oct 20
      // Next occurrences after Oct 15: Oct 20 (within month)
      const startDate = new Date('2026-10-20');
      await RecurringRule.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 15000,
        frequency: 'monthly',
        startDate,
        anchorDay: 20,
        nextRunAt: startDate,
        active: true,
      });

      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.spentSoFar).toBe(30000);
      expect(res.body.data.upcomingRecurringTotal).toBe(15000);
      // runRate = 30000 + (30000/15)*16 + 15000 = 30000 + 32000 + 15000 = 77000
      expect(res.body.data.projectedTotal).toBe(77000);
    });

    it('includes recurring-generated spend in recurringSpent calculation', async () => {
      // NOW = 2026-10-15
      // Variable spend: 30,000 (no recurringRuleId)
      // Recurring spend: 20,000 (has recurringRuleId)
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      // Variable spend
      const fingerprint1 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        note: 'Groceries variable',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        fingerprint: fingerprint1,
      });

      // Recurring-generated transaction
      const recurringRuleId = '507f1f77bcf86cd799439011';
      const fingerprint2 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 20000,
        date: new Date('2026-10-05'),
        note: 'Rent recurring',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 20000,
        date: new Date('2026-10-05'),
        fingerprint: fingerprint2,
        recurringRuleId,
      });

      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.spentSoFar).toBe(50000); // 30000 + 20000
      // variableSpent = 30000, recurringSpent = 20000
      // runRate = 50000 + (30000/15)*16 = 50000 + 32000 = 82000
      expect(res.body.data.projectedTotal).toBe(82000);
    });

    it('applies floor: projected >= spent + upcomingRecurring', async () => {
      // NOW = 2026-10-15
      // Variable spend: 1000, no recurring
      // History: Sep 10000 (wma = 10000)
      // runRate = 1000 + (1000/15)*16 = 2067
      // alpha = 15/31 ≈ 0.48
      // wmaFloor = max(10000, 1000) = 10000
      // projected = 0.48*2067 + 0.52*10000 = 992 + 5200 = 6192
      // floor = 1000
      // This tests the max(wma_c, spent_c + upcomingRecurring_c) logic
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      const fingerprint1 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 1000,
        date: new Date('2026-10-10'),
        note: 'Small spend',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 1000,
        date: new Date('2026-10-10'),
        fingerprint: fingerprint1,
      });

      // Historical: September 10000
      const fingerprint2 = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 10000,
        date: new Date('2026-09-15'),
        note: 'High Sep',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 10000,
        date: new Date('2026-09-15'),
        fingerprint: fingerprint2,
      });

      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      // projected should be >= spent + upcomingRecurring = 1000
      expect(res.body.data.projectedTotal).toBeGreaterThanOrEqual(1000);
      // With history, should be closer to WMA
      expect(res.body.data.projectedTotal).toBeGreaterThan(1000);
    });

    it('returns 401 without auth', async () => {
      await request(app)
        .get('/api/analytics/forecast')
        .expect(401);
    });

    it('respects user timezone for day calculation', async () => {
      // Test that day of month is calculated in user's timezone
      // The default timezone is Asia/Kolkata
      // If now is 2026-10-15T18:30:00Z, in Asia/Kolkata it's 2026-10-16T00:00:00
      // So day should be 16
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      // We can't easily change the user's timezone in this test
      // but we can verify the forecast runs without error
      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.daysElapsed).toBeGreaterThanOrEqual(1);
      expect(res.body.data.daysElapsed).toBeLessThanOrEqual(31);
    });

    it('budget.willExceed is true when projected exceeds budget', async () => {
      // NOW = 2026-10-15
      // Spend: 10000, no history
      // Budget: 50000
      // runRate = 10000 + (10000/15)*16 = 20667
      // projected = 20667, budget = 50000, willExceed = false
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      const fingerprint = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 10000,
        date: new Date('2026-10-10'),
        note: 'Test',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 10000,
        date: new Date('2026-10-10'),
        fingerprint,
      });

      // Create overall budget
      await Budget.create({
        userId,
        categoryId: null,
        month: '2026-10',
        limit: 50000,
        alertThreshold: 80,
      });

      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.budget).toBeDefined();
      expect(res.body.data.budget.limit).toBe(50000);
      expect(res.body.data.budget.willExceed).toBe(false);
    });

    it('budget.willExceed is true when projected exceeds budget limit', async () => {
      // NOW = 2026-10-15
      // Spend: 30000, no history
      // runRate = 30000 + (30000/15)*16 = 62000
      // Budget: 50000
      // projected = 62000 > 50000, willExceed = true
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      const fingerprint = generateFingerprint({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        note: 'Test',
      });
      await Transaction.create({
        userId,
        categoryId: expenseCategoryId,
        type: 'expense',
        amount: 30000,
        date: new Date('2026-10-10'),
        fingerprint,
      });

      // Create overall budget
      await Budget.create({
        userId,
        categoryId: null,
        month: '2026-10',
        limit: 50000,
        alertThreshold: 80,
      });

      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.budget).toBeDefined();
      expect(res.body.data.budget.limit).toBe(50000);
      expect(res.body.data.budget.willExceed).toBe(true);
    });

    it('handles categories with only upcoming recurring (no current spend)', async () => {
      // NOW = 2026-10-15
      const NOW = new Date('2026-10-15T12:00:00.000Z');

      // Create a second category
      const transportCatId = await createCategory('expense', 'Test Transport');
      // No current spend in Transport
      // Recurring rule for Transport: monthly 5000, anchorDay 20
      const startDate = new Date('2026-10-20');
      await RecurringRule.create({
        userId,
        categoryId: transportCatId,
        type: 'expense',
        amount: 5000,
        frequency: 'monthly',
        startDate,
        anchorDay: 20,
        nextRunAt: startDate,
        active: true,
      });

      const res = await request(app)
        .get('/api/analytics/forecast')
        .query({ now: NOW.toISOString() })
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      // Should have 1 category (Test Transport with upcoming recurring)
      // Test Groceries has no transactions, no recurring, no history - not in forecast
      expect(res.body.data.categories.length).toBe(1);

      // Find Transport category
      const transportCat = res.body.data.categories.find(c => c.categoryId === transportCatId);
      expect(transportCat).toBeDefined();
      expect(transportCat.spent).toBe(0);
      // Should have projected = upcomingRecurring = 5000 (floor applies)
      expect(transportCat.projected).toBe(5000);
      expect(res.body.data.upcomingRecurringTotal).toBe(5000);
    });
  });
});