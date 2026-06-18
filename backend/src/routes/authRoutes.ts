import { Router } from 'express';
import { register, login, getProfile, updateProfile, logout, heartbeat } from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);
router.patch('/profile', authMiddleware, updateProfile);
router.post('/logout', authMiddleware, logout);
router.patch('/session/heartbeat', authMiddleware, heartbeat);

export default router;
