import {
  getSummary,
  getByCategory,
  getTrend,
  getDaily,
  compareMonths,
} from '../services/analytics.service.js';
import { ApiError } from '../utils/ApiError.js';

export async function getSummaryController(req, res, next) {
  try {
    const { month } = req.validated.query;
    const tz = req.user.timezone || 'Asia/Kolkata';
    const data = await getSummary(req.userId, month, tz);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getByCategoryController(req, res, next) {
  try {
    const { month } = req.validated.query;
    const tz = req.user.timezone || 'Asia/Kolkata';
    const data = await getByCategory(req.userId, month, tz);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getTrendController(req, res, next) {
  try {
    const { months, referenceMonth } = req.validated.query;
    const tz = req.user.timezone || 'Asia/Kolkata';
    const data = await getTrend(req.userId, months, tz, referenceMonth);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getDailyController(req, res, next) {
  try {
    const { month } = req.validated.query;
    const tz = req.user.timezone || 'Asia/Kolkata';
    const data = await getDaily(req.userId, month, tz);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function compareMonthsController(req, res, next) {
  try {
    const { monthA, monthB } = req.validated.query;
    const tz = req.user.timezone || 'Asia/Kolkata';
    const data = await compareMonths(req.userId, monthA, monthB, tz);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}