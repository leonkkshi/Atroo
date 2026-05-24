import { Router } from 'express';
import { calculateTax, saveDeclaration, getDeclarations } from '../controllers/taxController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.use(authMiddleware); // Tất cả API thuế cần đăng nhập

router.post('/calculate', calculateTax);
router.post('/declarations', saveDeclaration);
router.get('/declarations', getDeclarations);

export default router;
