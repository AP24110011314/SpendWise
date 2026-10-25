import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export async function authMiddleware(req, res, next) {
  const { COOKIE_NAME, JWT_SECRET } = getEnv();
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return next(ApiError.unauthorized());
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return next(ApiError.unauthorized());
    }
    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return next(ApiError.unauthorized());
    }
    next(err);
  }
}

export function optionalAuth(req, res, next) {
  const { COOKIE_NAME, JWT_SECRET } = getEnv();
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    User.findById(decoded.userId).select('-passwordHash').then(user => {
      if (user) req.user = user;
      next();
    }).catch(() => next());
  } catch {
    next();
  }
}