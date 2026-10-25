import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { Budget } from '../models/Budget.js';
import { RecurringRule } from '../models/RecurringRule.js';
import { ImportBatch } from '../models/ImportBatch.js';
import { generateFingerprint } from '../utils/fingerprint.js';
import { currentMonth, shiftMonth, monthRange, daysInMonth } from '../utils/dates.js';

const DEMO_EMAIL = 'demo@spendwise.app';
const DEMO_PASSWORD = 'demo12345';
const DEMO_NAME = 'Demo User';
const TZ = 'Asia/Kolkata';

async function clearDemoData() {
  const user = await User.findOne({ email: DEMO_EMAIL });
  if (user) {
    const userId = user._id;
    await Transaction.deleteMany({ userId });
    await Category.deleteMany({ userId });
    await Budget.deleteMany({ userId });
    await RecurringRule.deleteMany({ userId });
    await ImportBatch.deleteMany({ userId });
    await User.deleteOne({ _id: userId });
    console.log('Cleared existing demo data');
  }
}

async function createDemoUser() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await User.create({
    email: DEMO_EMAIL,
    passwordHash,
    name: DEMO_NAME,
    timezone: TZ,
  });
  console.log(`Created demo user: ${DEMO_EMAIL} (${user._id})`);
  return user;
}

async function createDefaultCategories(userId) {
  const defaultCategories = [
    // Income categories (5)
    { name: 'Salary', type: 'income', color: '#22c55e', isDefault: true },
    { name: 'Freelance', type: 'income', color: '#16a34a', isDefault: true },
    { name: 'Investments', type: 'income', color: '#15803d', isDefault: true },
    { name: 'Gifts', type: 'income', color: '#166534', isDefault: true },
    { name: 'Other Income', type: 'income', color: '#14532d', isDefault: true },
    // Expense categories (10)
    { name: 'Housing', type: 'expense', color: '#ef4444', isDefault: true },
    { name: 'Transport', type: 'expense', color: '#f97316', isDefault: true },
    { name: 'Food & Dining', type: 'expense', color: '#eab308', isDefault: true },
    { name: 'Utilities', type: 'expense', color: '#3b82f6', isDefault: true },
    { name: 'Healthcare', type: 'expense', color: '#8b5cf6', isDefault: true },
    { name: 'Entertainment', type: 'expense', color: '#ec4899', isDefault: true },
    { name: 'Shopping', type: 'expense', color: '#06b6d4', isDefault: true },
    { name: 'Education', type: 'expense', color: '#84cc16', isDefault: true },
    { name: 'Subscriptions', type: 'expense', color: '#64748b', isDefault: true },
    { name: 'Other Expenses', type: 'expense', color: '#9ca3af', isDefault: true },
  ];

  const categories = await Category.insertMany(
    defaultCategories.map(c => ({ ...c, userId }))
  );
  console.log(`Created ${categories.length} default categories`);
  return categories;
}

async function createTransactions(userId, categories) {
  const catMap = new Map(categories.map(c => [c.name, c._id]));
  const now = new Date();
  const currentMonthKey = currentMonth(TZ, now);

  // Generate ~6 months of data (current month + 5 previous months)
  const monthKeys = [];
  for (let i = 5; i >= 0; i--) {
    monthKeys.push(shiftMonth(currentMonthKey, -i));
  }

  const transactions = [];

  // Income patterns
  const salaryAmount = 15000000; // 150,000.00
  const freelanceAmount = 3000000; // 30,000.00
  const investmentAmount = 800000; // 8,000.00

  // Expense patterns (base monthly amounts)
  const baseExpenses = {
    'Housing': 4500000,      // 45,000.00 rent
    'Transport': 800000,     // 8,000.00
    'Food & Dining': 2500000, // 25,000.00
    'Utilities': 500000,     // 5,000.00
    'Healthcare': 300000,    // 3,000.00
    'Entertainment': 1200000, // 12,000.00
    'Shopping': 1500000,     // 15,000.00
    'Education': 500000,     // 5,000.00
    'Subscriptions': 200000, // 2,000.00
    'Other Expenses': 400000, // 4,000.00
  };

  for (const monthKey of monthKeys) {
    const { start, end } = monthRange(monthKey, TZ);
    const dim = daysInMonth(monthKey, TZ);
    const monthDate = new Date(monthKey + '-01');

    // Income: Salary on 1st of each month
    const salaryDate = new Date(monthDate);
    salaryDate.setDate(1);
    const salaryFp = generateFingerprint({
      userId, categoryId: catMap.get('Salary'), type: 'income',
      amount: salaryAmount, date: salaryDate, note: `Salary ${monthKey}`
    });
    transactions.push({
      userId, categoryId: catMap.get('Salary'), type: 'income',
      amount: salaryAmount, date: salaryDate, note: `Salary ${monthKey}`,
      fingerprint: salaryFp
    });

    // Income: Freelance (occasional)
    if (Math.random() > 0.3) {
      const freelanceDate = new Date(monthDate);
      freelanceDate.setDate(15 + Math.floor(Math.random() * 10));
      const freelanceFp = generateFingerprint({
        userId, categoryId: catMap.get('Freelance'), type: 'income',
        amount: freelanceAmount, date: freelanceDate, note: `Freelance project ${monthKey}`
      });
      transactions.push({
        userId, categoryId: catMap.get('Freelance'), type: 'income',
        amount: freelanceAmount, date: freelanceDate, note: `Freelance project ${monthKey}`,
        fingerprint: freelanceFp
      });
    }

    // Income: Investments (quarterly)
    if ([1, 4, 7, 10].includes(monthDate.getMonth() + 1)) {
      const investDate = new Date(monthDate);
      investDate.setDate(5);
      const investFp = generateFingerprint({
        userId, categoryId: catMap.get('Investments'), type: 'income',
        amount: investmentAmount, date: investDate, note: `Dividends ${monthKey}`
      });
      transactions.push({
        userId, categoryId: catMap.get('Investments'), type: 'income',
        amount: investmentAmount, date: investDate, note: `Dividends ${monthKey}`,
        fingerprint: investFp
      });
    }

    // Expenses: Base monthly with some variation
    for (const [catName, baseAmount] of Object.entries(baseExpenses)) {
      // Number of transactions per category per month
      const numTx = catName === 'Food & Dining' ? 8 + Math.floor(Math.random() * 4)
        : catName === 'Transport' ? 4 + Math.floor(Math.random() * 3)
        : catName === 'Shopping' ? 2 + Math.floor(Math.random() * 3)
        : catName === 'Entertainment' ? 2 + Math.floor(Math.random() * 2)
        : catName === 'Housing' ? 1
        : catName === 'Utilities' ? 1
        : catName === 'Subscriptions' ? 1
        : 1 + Math.floor(Math.random() * 2);

      for (let t = 0; t < numTx; t++) {
        const txDate = new Date(monthDate);
        txDate.setDate(1 + Math.floor(Math.random() * dim));
        // Add some variation to amounts
        const variation = 0.7 + Math.random() * 0.6; // 70%-130%
        const amount = Math.round(baseAmount * variation / numTx);

        const note = catName === 'Housing' ? `Rent ${monthKey}`
          : catName === 'Utilities' ? `Utility bill ${monthKey}`
          : catName === 'Subscriptions' ? `Subscriptions ${monthKey}`
          : `${catName} ${monthKey} #${t + 1}`;

        const fp = generateFingerprint({
          userId, categoryId: catMap.get(catName), type: 'expense',
          amount, date: txDate, note
        });
        transactions.push({
          userId, categoryId: catMap.get(catName), type: 'expense',
          amount, date: txDate, note, fingerprint: fp
        });
      }
    }
  }

  // Add some larger one-off expenses
  const largeExpenses = [
    { cat: 'Healthcare', amount: 2500000, note: 'Medical procedure', monthOffset: -2 },
    { cat: 'Education', amount: 1500000, note: 'Course fees', monthOffset: -3 },
    { cat: 'Shopping', amount: 3000000, note: 'Electronics', monthOffset: -1 },
    { cat: 'Transport', amount: 1200000, note: 'Car repair', monthOffset: -4 },
  ];

  for (const le of largeExpenses) {
    const monthKey = shiftMonth(currentMonthKey, le.monthOffset);
    const { start, end } = monthRange(monthKey, TZ);
    const dim = daysInMonth(monthKey, TZ);
    const txDate = new Date(monthKey + '-01');
    txDate.setDate(1 + Math.floor(Math.random() * dim));

    const fp = generateFingerprint({
      userId, categoryId: catMap.get(le.cat), type: 'expense',
      amount: le.amount, date: txDate, note: le.note
    });
    transactions.push({
      userId, categoryId: catMap.get(le.cat), type: 'expense',
      amount: le.amount, date: txDate, note: le.note, fingerprint: fp
    });
  }

  await Transaction.insertMany(transactions);
  console.log(`Created ${transactions.length} transactions over 6 months`);
  return transactions;
}

async function createRecurringRules(userId, categories) {
  const catMap = new Map(categories.map(c => [c.name, c._id]));
  const now = new Date();
  const currentMonthKey = currentMonth(TZ, now);

  const rules = [
    // Monthly rent
    {
      userId, categoryId: catMap.get('Housing'), type: 'expense',
      amount: 4500000, frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      anchorDay: 1,
      nextRunAt: new Date(`${currentMonthKey}-01`),
      active: true
    },
    // Monthly utilities
    {
      userId, categoryId: catMap.get('Utilities'), type: 'expense',
      amount: 500000, frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      anchorDay: 5,
      nextRunAt: new Date(`${currentMonthKey}-05`),
      active: true
    },
    // Monthly subscriptions
    {
      userId, categoryId: catMap.get('Subscriptions'), type: 'expense',
      amount: 200000, frequency: 'monthly',
      startDate: new Date('2026-01-01'),
      anchorDay: 10,
      nextRunAt: new Date(`${currentMonthKey}-10`),
      active: true
    },
    // Weekly grocery budget (anchorDay = day of week 1=Monday)
    {
      userId, categoryId: catMap.get('Food & Dining'), type: 'expense',
      amount: 150000, frequency: 'weekly',
      startDate: new Date('2026-01-01'),
      anchorDay: 1,
      nextRunAt: new Date(),
      active: true
    },
    // Yearly insurance (anchorDay = day of month)
    {
      userId, categoryId: catMap.get('Healthcare'), type: 'expense',
      amount: 3000000, frequency: 'yearly',
      startDate: new Date('2026-03-15'),
      anchorDay: 15,
      nextRunAt: new Date('2027-03-15'),
      active: true
    },
  ];

  await RecurringRule.insertMany(rules);
  console.log(`Created ${rules.length} recurring rules`);
  return rules;
}

async function createBudgets(userId, categories) {
  const catMap = new Map(categories.map(c => [c.name, c._id]));
  const now = new Date();
  const currentMonthKey = currentMonth(TZ, now);

  const budgets = [
    // Overall budget
    { userId, categoryId: null, month: currentMonthKey, limit: 10000000, alertThreshold: 80 },
    // Category budgets
    { userId, categoryId: catMap.get('Housing'), month: currentMonthKey, limit: 5000000, alertThreshold: 90 },
    { userId, categoryId: catMap.get('Food & Dining'), month: currentMonthKey, limit: 3000000, alertThreshold: 80 },
    { userId, categoryId: catMap.get('Transport'), month: currentMonthKey, limit: 1200000, alertThreshold: 80 },
    { userId, categoryId: catMap.get('Entertainment'), month: currentMonthKey, limit: 1500000, alertThreshold: 80 },
    { userId, categoryId: catMap.get('Shopping'), month: currentMonthKey, limit: 2000000, alertThreshold: 80 },
    { userId, categoryId: catMap.get('Utilities'), month: currentMonthKey, limit: 600000, alertThreshold: 90 },
    { userId, categoryId: catMap.get('Healthcare'), month: currentMonthKey, limit: 800000, alertThreshold: 80 },
    { userId, categoryId: catMap.get('Education'), month: currentMonthKey, limit: 600000, alertThreshold: 80 },
    { userId, categoryId: catMap.get('Subscriptions'), month: currentMonthKey, limit: 250000, alertThreshold: 90 },
    { userId, categoryId: catMap.get('Other Expenses'), month: currentMonthKey, limit: 500000, alertThreshold: 80 },
  ];

  // Add previous month budgets for comparison
  const prevMonthKey = shiftMonth(currentMonthKey, -1);
  const prevBudgets = budgets.map(b => ({
    ...b, month: prevMonthKey,
    limit: b.limit === 10000000 ? 9500000 : b.limit // slightly lower overall
  }));

  await Budget.insertMany([...budgets, ...prevBudgets]);
  console.log(`Created ${budgets.length} budgets for current month + ${prevBudgets.length} for previous month`);
  return [...budgets, ...prevBudgets];
}

async function createOverBudgetCategory(userId, categories) {
  // Make "Entertainment" over budget by adding more transactions
  const catMap = new Map(categories.map(c => [c.name, c._id]));
  const now = new Date();
  const currentMonthKey = currentMonth(TZ, now);
  const { start, end } = monthRange(currentMonthKey, TZ);
  const dim = daysInMonth(currentMonthKey, TZ);

  // Add more entertainment expenses to exceed budget (budget is 1,500,000 = 15,000.00)
  const extraExpenses = [];
  for (let i = 0; i < 8; i++) {
    const txDate = new Date();
    txDate.setDate(1 + Math.floor(Math.random() * dim));
    const amount = 250000 + Math.floor(Math.random() * 200000); // 2,500-4,500 each
    const note = `Extra entertainment ${i + 1}`;
    const fp = generateFingerprint({
      userId, categoryId: catMap.get('Entertainment'), type: 'expense',
      amount, date: txDate, note
    });
    extraExpenses.push({
      userId, categoryId: catMap.get('Entertainment'), type: 'expense',
      amount, date: txDate, note, fingerprint: fp
    });
  }

  await Transaction.insertMany(extraExpenses);
  console.log(`Added ${extraExpenses.length} extra Entertainment expenses to exceed budget`);
}

async function seed() {
  try {
    await connectDB();
    console.log('Connected to database');

    await clearDemoData();
    const user = await createDemoUser();
    const categories = await createDefaultCategories(user._id);
    await createTransactions(user._id, categories);
    await createRecurringRules(user._id, categories);
    await createBudgets(user._id, categories);
    await createOverBudgetCategory(user._id, categories);

    console.log('\n✅ Seed completed successfully!');
    console.log(`📧 Demo login: ${DEMO_EMAIL}`);
    console.log(`🔑 Password: ${DEMO_PASSWORD}`);
    console.log(`🌍 Timezone: ${TZ}`);
    console.log(`📅 Data spans 6 months including current month`);
    console.log(`📊 One category (Entertainment) is over budget`);
    console.log(`🔄 Recurring rules: Rent, Utilities, Subscriptions, Weekly Groceries, Yearly Insurance`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();