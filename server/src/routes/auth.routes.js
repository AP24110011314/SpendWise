import { Router } from 'express';
import { z } from 'zod';
import {
  registerController,
  loginController,
  logoutController,
  meController,
  updateMeController,
  changePasswordController,
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(80, 'Name too long'),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required'),
  }),
});

const updateMeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(80, 'Name too long').optional(),
    currency: z.string().length(3, 'Currency must be 3 characters').optional(),
    timezone: z.string().min(1, 'Timezone is required').optional(),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  }),
});

// Apply auth rate limit to auth endpoints
router.use(authRateLimit);

// Public routes
router.post('/register', validate(registerSchema), registerController);
router.post('/login', validate(loginSchema), loginController);

// Protected routes
router.post('/logout', authMiddleware, logoutController);
router.get('/me', authMiddleware, meController);
router.patch('/me', authMiddleware, validate(updateMeSchema), updateMeController);
router.post('/change-password', authMiddleware, validate(changePasswordSchema), changePasswordController);

export default router;