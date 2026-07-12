import { Router } from 'express';
import { sendMessage, getChatHistory, clearChatHistory } from '../controllers/chatController';
import {
  priceSuggestions,
  revenueForecast,
  autoDeclaration,
} from '../controllers/aiInsightsController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware);

// ── AI Chat ──────────────────────────────────────────────────────────────────
router.post('/message', sendMessage);
router.get('/history', getChatHistory);
router.delete('/history', clearChatHistory);

// ── AI Insights (Gợi ý giá, Dự báo doanh thu, Tờ khai tự động) ─────────────
router.post('/price-suggestions', priceSuggestions);
router.post('/revenue-forecast',  revenueForecast);
router.post('/auto-declaration',  autoDeclaration);

export default router;

