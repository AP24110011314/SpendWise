import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, teardown } from './setup.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Transaction, generateFingerprint } from '../src/models/Transaction.js';

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

describe('Analytics Routes', () => {
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

  describe('GET /api/analytics/summary', () => {
    beforeEach(async () => {
      // Create test transactions for January 2024
      const transactions = [
        // Income
        { userId, categoryId: defaultIncomeCategoryId, type: 'income', amount: 500000, date: new Date('2024-01-05T10:00:00Z'), note: 'Salary', fingerprint: 'fp1' },
        { userId, categoryId: defaultIncomeCategoryId, type: 'income', amount: 50000, date: new Date('2024-01-15T10:00:00Z'), note: 'Freelance', fingerprint: 'fp2' },
        // Expenses
        { userId, categoryId: defaultExpenseCategoryId, type: 'expense', amount: 15000, date: new Date('2024-01-10T12:00:00Z'), note: 'Groceries', fingerprint: 'fp3' },
        { userId, categoryId: defaultExpenseCategoryId, type: 'expense', amount: 8000, date: new Date('2024-01-20T18:00:00Z'), note: 'Transport', fingerprint: 'fp4' },
        { userId, categoryId: defaultExpenseCategoryId, type: 'expense', amount: 25000, date: new Date('2024-01-25T14:00:00Z'), note: 'Entertainment', fingerprint: 'fp5' },
      ];
      await Transaction.create(transactions);
    });

    it('should return summary for current month by default', async () => {
      const res = await request(app)
        .get('/api/analytics/summary')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveProperty('month');
      expect(res.body.data).toHaveProperty('income');
      expect(res.body.data).toHaveProperty('expense');
      expect(res.body.data).toHaveProperty('net');
      expect(res.body.data).toHaveProperty('savingsRate');
    });

    it('should return correct summary for specific month', async () => {
      const res = await request(app)
        .get('/api/analytics/summary?month=2024-01')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data.month).toBe('2024-01');
      expect(res.body.data.income).toBe(550000); // 500000 + 50000
      expect(res.body.data.expense).toBe(48000); // 15000 + 8000 + 25000
      expect(res.body.data.net).toBe(502000); // 550000 - 48000
      expect(res.body.data.savingsRate).toBe(91.3); // 502000 / 550000 * 100 = 91.27... rounded to 1 decimal
      expect(res.body.data.incomeCount).toBe(2);
      expect(res.body.data.expenseCount).toBe(3);
    });

    it('should return zeros for month with no transactions', async () => {
      const res = await request(app)
        .get('/api/analytics/summary?month=2024-02')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data.month).toBe('2024-02');
      expect(res.body.data.income).toBe(0);
      expect(res.body.data.expense).toBe(0);
      expect(res.body.data.net).toBe(0);
      expect(res.body.data.savingsRate).toBe(0);
    });

    it('should return 401 without auth', async () => {
      await request(app)
        .get('/api/analytics/summary')
        .expect(401);
    });
  });

  describe('GET /api/analytics/by-category', () => {
    beforeEach(async () => {
      // Create test transactions for January 2024
      const foodCat = await Category.findOne({ userId, isDefault: true, type: 'expense', name: 'Food & Dining' });
      const transportCat = await Category.findOne({ userId, isDefault: true, type: 'expense', name: 'Transport' });

      const transactions = [
        { userId, categoryId: foodCat._id, type: 'expense', amount: 15000, date: new Date('2024-01-10T12:00:00Z'), note: 'Groceries', fingerprint: 'fp1' },
        { userId, categoryId: foodCat._id, type: 'expense', amount: 10000, date: new Date('2024-01-15T12:00:00Z'), note: 'Restaurant', fingerprint: 'fp2' },
        { userId, categoryId: transportCat._id, type: 'expense', amount: 8000, date: new Date('2024-01-20T18:00:00Z'), note: 'Uber', fingerprint: 'fp3' },
      ];
      await Transaction.create(transactions);
    });

    it('should return spending by category', async () => {
      const res = await request(app)
        .get('/api/analytics/by-category?month=2024-01')
        .set('Cookie', authCookie)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Check structure
      for (const cat of res.body.data) {
        expect(cat).toHaveProperty('categoryId');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('color');
        expect(cat).toHaveProperty('total');
        expect(cat).toHaveProperty('count');
        expect(cat).toHaveProperty('pct');
      }

      // Check totals
      const total = res.body.data.reduce((sum, cat) => sum + cat.total, 0);
      expect(total).toBe(33000);

      // Check percentages sum to ~100
      const pctSum = res.body.data.reduce((sum, cat) => sum + cat.pct, 0);
      expect(pctSum).toBeGreaterThan(99);
      expect(pctSum).toBeLessThan(101);
    });

    it('should sort by total descending', async () => {
      const res = await request(app)
        .get('/api/analytics/by-category?month=2024-01')
        .set('Cookie', authCookie)
        .expect(200);

      for (let i = 1; i < res.body.data.length; i++) {
        expect(res.body.data[i].total).toBeLessThanOrEqual(res.body.data[i - 1].total);
      }
    });

    it('should return empty array for month with no expenses', async () => {
      const res = await request(app)
        .get('/api/analytics/by-category?month=2024-02')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/analytics/trend', () => {
    beforeEach(async () => {
      // Create transactions across multiple months
      const transactions = [
        // Jan 2024
        { userId, categoryId: defaultIncomeCategoryId, type: 'income', amount: 500000, date: new Date('2024-01-05T10:00:00Z'), note: 'Salary', fingerprint: 'fp1' },
        { userId, categoryId: defaultExpenseCategoryId, type: 'expense', amount: 40000, date: new Date('2024-01-10T12:00:00Z'), note: 'Expenses', fingerprint: 'fp2' },
        // Feb 2024
        { userId, categoryId: defaultIncomeCategoryId, type: 'income', amount: 500000, date: new Date('2024-02-05T10:00:00Z'), note: 'Salary', fingerprint: 'fp3' },
        { userId, categoryId: defaultExpenseCategoryId, type: 'expense', amount: 45000, date: new Date('2024-02-10T12:00:00Z'), note: 'Expenses', fingerprint: 'fp4' },
        // Mar 2024
        { userId, categoryId: defaultIncomeCategoryId, type: 'income', amount: 550000, date: new Date('2024-03-05T10:00:00Z'), note: 'Salary', fingerprint: 'fp5' },
        { userId, categoryId: defaultExpenseCategoryId, type: 'expense', amount: 50000, date: new Date('2024-03-10T12:00:00Z'), note: 'Expenses', fingerprint: 'fp6' },
      ];
      await Transaction.create(transactions);
    });

    it('should return trend for last 6 months by default', async () => {
      const res = await request(app)
        .get('/api/analytics/trend')
        .set('Cookie', authCookie)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(6);

      // Check structure
      for (const month of res.body.data) {
        expect(month).toHaveProperty('month');
        expect(month).toHaveProperty('income');
        expect(month).toHaveProperty('expense');
        expect(month).toHaveProperty('net');
      }
    });

    it('should return correct trend data for months with transactions', async () => {
      const res = await request(app)
        .get('/api/analytics/trend?months=3&referenceMonth=2024-03')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data.length).toBe(3);

      // Find the months with data
      const janData = res.body.data.find(m => m.month === '2024-01');
      const febData = res.body.data.find(m => m.month === '2024-02');
      const marData = res.body.data.find(m => m.month === '2024-03');

      expect(janData).toBeDefined();
      expect(janData.income).toBe(500000);
      expect(janData.expense).toBe(40000);
      expect(janData.net).toBe(460000);

      expect(febData).toBeDefined();
      expect(febData.income).toBe(500000);
      expect(febData.expense).toBe(45000);
      expect(febData.net).toBe(455000);

      expect(marData).toBeDefined();
      expect(marData.income).toBe(550000);
      expect(marData.expense).toBe(50000);
      expect(marData.net).toBe(500000);
    });

    it('should zero-fill months without transactions', async () => {
      const res = await request(app)
        .get('/api/analytics/trend?months=6')
        .set('Cookie', authCookie)
        .expect(200);

      // At least 3 months should have zero data (assuming current month is not in our test data)
      const zeroMonths = res.body.data.filter(m => m.income === 0 && m.expense === 0);
      expect(zeroMonths.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /api/analytics/daily', () => {
    beforeEach(async () => {
      const daysInJan = 31;
      const transactions = [];

      // Create one transaction per day for first 5 days
      for (let day = 1; day <= 5; day++) {
        const date = new Date(`2024-01-${day.toString().padStart(2, '0')}T12:00:00Z`);
        transactions.push({
          userId,
          categoryId: defaultExpenseCategoryId,
          type: 'expense',
          amount: 1000 * day,
          date,
          note: `Day ${day}`,
          fingerprint: `fp${day}`,
        });
      }

      await Transaction.create(transactions);
    });

    it('should return daily series for the month', async () => {
      const res = await request(app)
        .get('/api/analytics/daily?month=2024-01')
        .set('Cookie', authCookie)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(31); // January has 31 days

      // Check structure
      for (const day of res.body.data) {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('income');
        expect(day).toHaveProperty('expense');
        expect(day).toHaveProperty('net');
        expect(day).toHaveProperty('cumulativeExpense');
      }
    });

    it('should have correct daily amounts for days with transactions', async () => {
      const res = await request(app)
        .get('/api/analytics/daily?month=2024-01')
        .set('Cookie', authCookie)
        .expect(200);

      const day1 = res.body.data.find(d => d.date === '2024-01-01');
      const day3 = res.body.data.find(d => d.date === '2024-01-03');
      const day5 = res.body.data.find(d => d.date === '2024-01-05');

      expect(day1.expense).toBe(1000);
      expect(day3.expense).toBe(3000);
      expect(day5.expense).toBe(5000);
    });

    it('should have zero amounts for days without transactions', async () => {
      const res = await request(app)
        .get('/api/analytics/daily?month=2024-01')
        .set('Cookie', authCookie)
        .expect(200);

      const day10 = res.body.data.find(d => d.date === '2024-01-10');
      expect(day10.income).toBe(0);
      expect(day10.expense).toBe(0);
      expect(day10.net).toBe(0);
    });

    it('should have correct cumulative expenses', async () => {
      const res = await request(app)
        .get('/api/analytics/daily?month=2024-01')
        .set('Cookie', authCookie)
        .expect(200);

      // Cumulative should increase only on days with expenses
      const day1 = res.body.data.find(d => d.date === '2024-01-01');
      const day2 = res.body.data.find(d => d.date === '2024-01-02');
      const day3 = res.body.data.find(d => d.date === '2024-01-03');

      expect(day1.cumulativeExpense).toBe(1000);
      expect(day2.cumulativeExpense).toBe(3000); // 1000 + 2000
      expect(day3.cumulativeExpense).toBe(6000); // 1000 + 2000 + 3000
    });
  });

  describe('GET /api/analytics/compare', () => {
    let foodCategoryId;
    let transportCategoryId;
    let entertainmentCategoryId;

    beforeEach(async () => {
      // Get specific default category IDs
      const foodCat = await Category.findOne({ userId, isDefault: true, type: 'expense', name: 'Food & Dining' });
      const transportCat = await Category.findOne({ userId, isDefault: true, type: 'expense', name: 'Transport' });
      const entertainmentCat = await Category.findOne({ userId, isDefault: true, type: 'expense', name: 'Entertainment' });

      console.log('DEBUG foodCat name:', foodCat?.name);
      console.log('DEBUG transportCat name:', transportCat?.name);
      console.log('DEBUG entertainmentCat name:', entertainmentCat?.name);
      console.log('DEBUG foodCat:', JSON.stringify(foodCat));
      console.log('DEBUG transportCat:', JSON.stringify(transportCat));
      console.log('DEBUG entertainmentCat:', JSON.stringify(entertainmentCat));

      foodCategoryId = foodCat._id.toString();
      transportCategoryId = transportCat._id.toString();
      entertainmentCategoryId = entertainmentCat._id.toString();

      // Create transactions for two months
      const transactions = [
        // Jan 2024
        { userId, categoryId: foodCategoryId, type: 'expense', amount: 20000, date: new Date('2024-01-10T12:00:00Z'), note: 'Food', fingerprint: 'fp1' },
        { userId, categoryId: transportCategoryId, type: 'expense', amount: 10000, date: new Date('2024-01-15T12:00:00Z'), note: 'Transport', fingerprint: 'fp2' },
        // Feb 2024
        { userId, categoryId: foodCategoryId, type: 'expense', amount: 25000, date: new Date('2024-02-10T12:00:00Z'), note: 'Food', fingerprint: 'fp3' },
        { userId, categoryId: transportCategoryId, type: 'expense', amount: 15000, date: new Date('2024-02-15T12:00:00Z'), note: 'Transport', fingerprint: 'fp4' },
        { userId, categoryId: entertainmentCategoryId, type: 'expense', amount: 5000, date: new Date('2024-02-20T12:00:00Z'), note: 'Entertainment', fingerprint: 'fp5' },
      ];
      await Transaction.create(transactions);
    });

    it('should compare two months', async () => {
      const res = await request(app)
        .get('/api/analytics/compare?monthA=2024-01&monthB=2024-02')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveProperty('monthA', '2024-01');
      expect(res.body.data).toHaveProperty('monthB', '2024-02');
      expect(res.body.data).toHaveProperty('categories');
      expect(Array.isArray(res.body.data.categories)).toBe(true);
    });

    it('should include all categories from both months', async () => {
      const res = await request(app)
        .get('/api/analytics/compare?monthA=2024-01&monthB=2024-02')
        .set('Cookie', authCookie)
        .expect(200);

      const categories = res.body.data.categories;
      expect(categories.length).toBeGreaterThanOrEqual(3); // Food, Transport, Entertainment

      // Find specific categories
      const food = categories.find(c => c.name === 'Food & Dining');
      const transport = categories.find(c => c.name === 'Transport');
      const entertainment = categories.find(c => c.name === 'Entertainment');

      expect(food).toBeDefined();
      expect(transport).toBeDefined();
      expect(entertainment).toBeDefined();
    });

    it('should calculate delta and percentage correctly', async () => {
      const res = await request(app)
        .get('/api/analytics/compare?monthA=2024-01&monthB=2024-02')
        .set('Cookie', authCookie)
        .expect(200);

      const food = res.body.data.categories.find(c => c.name === 'Food & Dining');
      // Jan: 20000, Feb: 25000, delta = 5000, pct = 25%
      expect(food.monthA).toBe(20000);
      expect(food.monthB).toBe(25000);
      expect(food.delta).toBe(5000);
      expect(food.pct).toBe(25);

      const transport = res.body.data.categories.find(c => c.name === 'Transport');
      // Jan: 10000, Feb: 15000, delta = 5000, pct = 50%
      expect(transport.monthA).toBe(10000);
      expect(transport.monthB).toBe(15000);
      expect(transport.delta).toBe(5000);
      expect(transport.pct).toBe(50);

      const entertainment = res.body.data.categories.find(c => c.name === 'Entertainment');
      // Jan: 0, Feb: 5000, delta = 5000, pct = null (division by zero)
      expect(entertainment.monthA).toBe(0);
      expect(entertainment.monthB).toBe(5000);
      expect(entertainment.delta).toBe(5000);
      expect(entertainment.pct).toBeNull();
    });

    it('should sort categories by absolute delta descending', async () => {
      const res = await request(app)
        .get('/api/analytics/compare?monthA=2024-01&monthB=2024-02')
        .set('Cookie', authCookie)
        .expect(200);

      const categories = res.body.data.categories;
      for (let i = 1; i < categories.length; i++) {
        expect(Math.abs(categories[i].delta)).toBeLessThanOrEqual(Math.abs(categories[i - 1].delta));
      }
    });

    it('should include summary totals', async () => {
      const res = await request(app)
        .get('/api/analytics/compare?monthA=2024-01&monthB=2024-02')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data).toHaveProperty('incomeA');
      expect(res.body.data).toHaveProperty('incomeB');
      expect(res.body.data).toHaveProperty('expenseA');
      expect(res.body.data).toHaveProperty('expenseB');
      expect(res.body.data).toHaveProperty('netA');
      expect(res.body.data).toHaveProperty('netB');

      expect(res.body.data.expenseA).toBe(30000); // 20000 + 10000
      expect(res.body.data.expenseB).toBe(45000); // 25000 + 15000 + 5000
    });

    it('should return 400 for missing month parameters', async () => {
      const res = await request(app)
        .get('/api/analytics/compare?monthA=2024-01')
        .set('Cookie', authCookie)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});