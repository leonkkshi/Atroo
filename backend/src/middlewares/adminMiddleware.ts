import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

/**
 * Middleware chặn truy cập nếu user không có role ADMIN.
 * Phải dùng sau authMiddleware.
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Bạn không có quyền truy cập chức năng này.' });
  }
  next();
};
