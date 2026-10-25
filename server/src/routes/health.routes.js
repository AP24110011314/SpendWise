import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ data: { status: 'ok' } });
});

export default router;