import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import categoryRoutes from './category.routes.js';
import transactionRoutes from './transaction.routes.js';
import analyticsRoutes from './analytics.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/transactions', transactionRoutes);
router.use('/analytics', analyticsRoutes);

export default router;