import { Router } from 'express';
import { sendMessage, getChatHistory, clearChatHistory } from '../controllers/chatController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

router.post('/message', sendMessage);
router.get('/history', getChatHistory);
router.delete('/history', clearChatHistory);

export default router;
