import { Router } from 'express';
import { getDeadlines, createDeadline, updateDeadlineStatus, seedDefaultDeadlines } from '../controllers/calendarController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.get('/deadlines', getDeadlines);
router.post('/deadlines', createDeadline);
router.patch('/deadlines/:id', updateDeadlineStatus);
router.patch('/deadlines/:id/status', updateDeadlineStatus);
router.post('/deadlines/seed-defaults', seedDefaultDeadlines);

export default router;
