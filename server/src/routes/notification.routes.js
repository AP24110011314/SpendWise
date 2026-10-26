import { Router } from 'express';
import { z } from 'zod';
import {
  listNotificationsController,
  markNotificationReadController,
  markAllNotificationsReadController,
} from '../controllers/budget.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate, idParamSchema } from '../middleware/validate.js';

const router = Router();

router.use(authMiddleware);

const markNotificationReadSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: idParamSchema,
});

const markAllNotificationsReadSchema = z.object({
  body: z.object({}),
  query: z.object({}),
  params: z.object({}),
});

router.get('/', listNotificationsController);
router.patch('/:id/read', validate(markNotificationReadSchema), markNotificationReadController);
router.post('/read-all', validate(markAllNotificationsReadSchema), markAllNotificationsReadController);

export default router;
