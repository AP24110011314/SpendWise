import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { currentMonth, monthRange } from './src/utils/dates.js';
import { Transaction, generateFingerprint } from './src/models/Transaction.js';
import { Budget } from './src/models/Budget.js';
import { Category } from './src/models/Category.js';
import { Notification } from './src/models/Notification.js';
import { User } from './src/models/User.js';
import { evaluateBudgets } from './src/services/budget.service.js';

async function test() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Create user
  const user = await User.create({ email: 'test@test.com', passwordHash: 'hash', name: 'Test' });
  const userId = user._id.toString();

  // Create category
  const category = await Category.create({ userId, name: 'Groceries', type: 'expense', color: '#ff0000' });
  const catId = category._id.toString();

  // Get current month
  const testMonth = currentMonth();
  console.log('testMonth:', testMonth);

  // Create budget
  const budget = await Budget.create({
    userId,
    categoryId: catId,
    month: testMonth,
    limit: 50000,
    alertThreshold: 80,
  });
  console.log('Budget created:', budget._id.toString());

  // Create transaction
  const { start, end } = monthRange(testMonth);
  console.log('Month range:', start, 'to', end);

  const fingerprint = generateFingerprint(userId, start, 'expense', 10000, 'Groceries');
  const tx = await Transaction.create({
    userId,
    categoryId: catId,
    type: 'expense',
    amount: 10000,
    date: start,
    note: 'Groceries',
    fingerprint,
  });
  console.log('Transaction created:', tx._id.toString(), 'amount:', tx.amount);

  // Evaluate budgets after first transaction
  console.log('\n--- After first transaction (10000) ---');
  await evaluateBudgets(userId, catId, testMonth);
  let notifications = await Notification.find({ userId });
  console.log('Notifications:', notifications.map(n => ({ type: n.type, budgetId: n.budgetId.toString(), month: n.month })));

  // Update transaction to 42500
  tx.amount = 42500;
  await tx.save();
  console.log('\n--- After update to 42500 ---');
  await evaluateBudgets(userId, catId, testMonth);
  notifications = await Notification.find({ userId });
  console.log('Notifications:', notifications.map(n => ({ type: n.type, budgetId: n.budgetId.toString(), month: n.month, message: n.message })));

  // Check spent calculation
  const { start: s, end: e } = monthRange(testMonth);
  const spentResult = await Transaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), type: 'expense', categoryId: new mongoose.Types.ObjectId(catId), date: { $gte: s, $lt: e } } },
    { $group: { _id: null, spent: { $sum: '$amount' } } }
  ]);
  console.log('\nSpent calculation:', spentResult);

  await mongoose.disconnect();
  await mongod.stop();
}

test().catch(console.error);