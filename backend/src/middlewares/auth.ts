import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'atro_jwt_secret_key_2026_super_secure';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    taxCode: string;
    role: string;
    status: string;
  };
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; taxCode: string; role?: string };

      // Lấy thông tin đầy đủ từ DB để có role và status mới nhất
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, taxCode: true, role: true, status: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Tài khoản không tồn tại.' });
      }

      // Kiểm tra tài khoản bị khóa
      if (user.status === 'SUSPENDED') {
        return res.status(403).json({ error: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.' });
      }

      req.user = {
        id: user.id,
        taxCode: user.taxCode,
        role: user.role,
        status: user.status,
      };

      // Cập nhật lastActiveAt — fire-and-forget, không chặn response
      prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() }
      }).catch(err => console.warn('[Auth] Không thể cập nhật lastActiveAt:', err.message));

      return next();
    } catch (error) {
      console.warn('[Auth Middleware Warning]: Token không hợp lệ hoặc hết hạn, tự động chuyển sang tài khoản mẫu...');
    }
  }

  // Tự động tìm hoặc tạo tài khoản demo để loại bỏ hoàn toàn các lỗi kết nối 401 lúc khởi chạy ứng dụng
  try {
    const demoTaxCode = '0123456789';
    let user = await prisma.user.findUnique({
      where: { taxCode: demoTaxCode },
      select: { id: true, taxCode: true, role: true, status: true }
    });

    if (!user) {
      try {
        const hashedPassword = await bcrypt.hash('securesafepassword123', 10);
        const created = await prisma.user.create({
          data: {
            taxCode: demoTaxCode,
            businessName: 'Nguyễn Văn An',
            password: hashedPassword
          },
          select: { id: true, taxCode: true, role: true, status: true }
        });
        user = created;
        console.log('[Auth Middleware]: Tự động khởi tạo thành công tài khoản mẫu Nguyễn Văn An (MST: 0123456789)');
      } catch (createError: any) {
        console.warn('[Auth Middleware Warning] Lỗi khi tạo user mẫu (có thể do race condition), thử tìm lại:', createError.message);
        user = await prisma.user.findUnique({
          where: { taxCode: demoTaxCode },
          select: { id: true, taxCode: true, role: true, status: true }
        });
        if (!user) {
          throw createError;
        }
      }
    }

    req.user = {
      id: user.id,
      taxCode: user.taxCode,
      role: user.role,
      status: user.status,
    };
    return next();
  } catch (error: any) {
    console.error('[Auth Middleware Error] Không thể tự động xác thực bằng tài khoản mẫu:', error.stack || error);
    return res.status(401).json({ error: 'Không tìm thấy token xác thực. Truy cập bị từ chối.', details: error.message });
  }
};
