import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import categoryRoutes from './category.routes.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/categories', categoryRoutes);

export default router;