import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requireAdmin } from '../middlewares/adminMiddleware';
import { getStats, getUsers, getUserDetail, updateUserStatus, deleteUser } from '../controllers/adminController';

const router = Router();

// Tất cả routes admin đều cần xác thực + quyền admin
router.use(authMiddleware, requireAdmin);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

export default router;
