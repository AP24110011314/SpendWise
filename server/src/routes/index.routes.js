import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import categoryRoutes from './category.routes.js';
import transactionRoutes from './transaction.routes.js';
import analyticsRoutes from './analytics.routes.js';
import budgetRoutes from './budget.routes.js';
import recurringRoutes from './recurring.routes.js';
import importRoutes from './import.routes.js';
import notificationRoutes from './notification.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);
router.use('/transactions', transactionRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/budgets', budgetRoutes);
router.use('/recurring', recurringRoutes);
router.use('/import', importRoutes);
router.use('/notifications', notificationRoutes);

export default router;