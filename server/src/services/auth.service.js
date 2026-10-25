import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

function getConfig() {
  const { JWT_SECRET, JWT_EXPIRES_IN, COOKIE_NAME, NODE_ENV } = getEnv();
  return { JWT_SECRET, JWT_EXPIRES_IN, COOKIE_NAME, NODE_ENV };
}

const DEFAULT_CATEGORIES = [
  // Income categories
  { name: 'Salary', type: 'income', color: '#22c55e', icon: 'briefcase', isDefault: true },
  { name: 'Freelance', type: 'income', color: '#16a34a', icon: 'laptop', isDefault: true },
  { name: 'Investments', type: 'income', color: '#15803d', icon: 'trending-up', isDefault: true },
  { name: 'Gifts', type: 'income', color: '#166534', icon: 'gift', isDefault: true },
  { name: 'Other Income', type: 'income', color: '#14532d', icon: 'plus-circle', isDefault: true },

  // Expense categories
  { name: 'Food & Dining', type: 'expense', color: '#ef4444', icon: 'utensils', isDefault: true },
  { name: 'Transport', type: 'expense', color: '#f97316', icon: 'car', isDefault: true },
  { name: 'Shopping', type: 'expense', color: '#ec4899', icon: 'shopping-bag', isDefault: true },
  { name: 'Entertainment', type: 'expense', color: '#8b5cf6', icon: 'film', isDefault: true },
  { name: 'Bills & Utilities', type: 'expense', color: '#3b82f6', icon: 'file-text', isDefault: true },
  { name: 'Healthcare', type: 'expense', color: '#06b6d4', icon: 'heart-pulse', isDefault: true },
  { name: 'Education', type: 'expense', color: '#84cc16', icon: 'graduation-cap', isDefault: true },
  { name: 'Travel', type: 'expense', color: '#f59e0b', icon: 'plane', isDefault: true },
  { name: 'Other Expenses', type: 'expense', color: '#6b7280', icon: 'more-horizontal', isDefault: true },
  { name: 'Subscriptions', type: 'expense', color: '#a855f7', icon: 'credit-card', isDefault: true },
];

async function seedDefaultCategories(userId) {
  const categories = DEFAULT_CATEGORIES.map((cat) => ({
    ...cat,
    userId,
  }));
  await Category.insertMany(categories);
}

function generateTokens(userId) {
  const { JWT_SECRET, JWT_EXPIRES_IN } = getConfig();
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { accessToken };
}

function setTokenCookie(res, token) {
  const { COOKIE_NAME, NODE_ENV } = getConfig();
  const isProduction = NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
}

function clearTokenCookie(res) {
  const { COOKIE_NAME, NODE_ENV } = getConfig();
  const isProduction = NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  });
}

export async function register({ name, email, password }) {
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email: email.toLowerCase(), passwordHash });

  await seedDefaultCategories(user._id);

  const { accessToken } = generateTokens(user._id);
  const userObj = user.toObject();
  delete userObj.passwordHash;
  return { user: userObj, accessToken };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const { accessToken } = generateTokens(user._id);
  const userObj = user.toObject();
  delete userObj.passwordHash;

  return { user: userObj, accessToken };
}

export async function logout() {
  // Token is cleared via cookie on client side
  return { success: true };
}

export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user.toObject();
}

export async function updateMe(userId, data) {
  const allowedFields = ['name', 'currency', 'timezone'];
  const updateData = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest('No valid fields to update');
  }

  const user = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true });
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user.toObject();
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  return { success: true };
}

export { setTokenCookie, clearTokenCookie, generateTokens };