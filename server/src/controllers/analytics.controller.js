import {
  getSummary,
  getByCategory,
  getTrend,
  getDaily,
  compareMonths,
  getForecast,
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
    const query = req.validated.query;
    const monthA = query.monthA || query.a;
    const monthB = query.monthB || query.b;
    const tz = req.user.timezone || 'Asia/Kolkata';
    const data = await compareMonths(req.userId, monthA, monthB, tz);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getForecastController(req, res, next) {
  try {
    const tz = req.user.timezone || 'Asia/Kolkata';
    const now = req.validated.query.now ? new Date(req.validated.query.now) : new Date();
    const data = await getForecast(req.userId, now, tz);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}