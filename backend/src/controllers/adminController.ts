import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';

// ── GET /admin/stats ──────────────────────────────────────────────────────────
export const getStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalUsers, newUsers, activeUsers, suspendedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
    ]);

    res.json({ totalUsers, newUsers, activeUsers, suspendedUsers });
  } catch (error: any) {
    console.error('[Admin] getStats error:', error);
    res.status(500).json({ error: 'Không thể lấy thống kê hệ thống.' });
  }
};

// ── GET /admin/users ──────────────────────────────────────────────────────────
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      search = '',
      page = '1',
      limit = '20',
      sort = 'createdAt',
      order = 'desc',
      status: statusFilter = '',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Validate sort field
    const allowedSorts = ['createdAt', 'lastActiveAt', 'businessName'];
    const sortField = allowedSorts.includes(sort) ? sort : 'createdAt';
    const orderDir = order === 'asc' ? 'asc' : 'desc';

    const where: any = {};
    if (search.trim()) {
      where.OR = [
        { businessName: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    if (statusFilter === 'ACTIVE' || statusFilter === 'SUSPENDED') {
      where.status = statusFilter;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortField]: orderDir },
        select: {
          id: true,
          businessName: true,
          role: true,
          status: true,
          businessType: true,
          phone: true,
          address: true,
          createdAt: true,
          lastActiveAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    console.error('[Admin] getUsers error:', error);
    res.status(500).json({ error: 'Không thể lấy danh sách người dùng.' });
  }
};

// ── GET /admin/users/:id ──────────────────────────────────────────────────────
export const getUserDetail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id));
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ.' });
    }

    const [user, declarationCount, invoiceCount, posInvoiceCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          businessName: true,
          role: true,
          status: true,
          businessType: true,
          phone: true,
          address: true,
          revenueGoal: true,
          staffSize: true,
          createdAt: true,
          lastActiveAt: true,
        },
      }),
      prisma.taxDeclaration.count({ where: { userId } }),
      prisma.invoice.count({ where: { userId } }),
      prisma.posInvoice.count({ where: { userId } }),
    ]);

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }

    res.json({
      ...user,
      stats: { declarationCount, invoiceCount, posInvoiceCount },
    });
  } catch (error: any) {
    console.error('[Admin] getUserDetail error:', error);
    res.status(500).json({ error: 'Không thể lấy thông tin người dùng.' });
  }
};

// ── PATCH /admin/users/:id/status ─────────────────────────────────────────────
export const updateUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id));
    const { status } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ.' });
    }
    if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ. Chỉ chấp nhận ACTIVE hoặc SUSPENDED.' });
    }

    // Admin không thể tự khóa chính mình
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Không thể thay đổi trạng thái tài khoản của chính bạn.' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }
    // Không khóa admin khác
    if (target.role === 'ADMIN' && status === 'SUSPENDED') {
      return res.status(400).json({ error: 'Không thể khóa tài khoản quản trị viên.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, businessName: true, status: true },
    });

    const msg = status === 'SUSPENDED'
      ? `Đã khóa tài khoản ${updated.businessName}.`
      : `Đã mở khóa tài khoản ${updated.businessName}.`;

    res.json({ message: msg, user: updated });
  } catch (error: any) {
    console.error('[Admin] updateUserStatus error:', error);
    res.status(500).json({ error: 'Không thể cập nhật trạng thái người dùng.' });
  }
};

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────
export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id));
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID người dùng không hợp lệ.' });
    }

    // Admin không thể tự xóa chính mình
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Không thể xóa tài khoản của chính bạn.' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }
    if (target.role === 'ADMIN') {
      return res.status(400).json({ error: 'Không thể xóa tài khoản quản trị viên.' });
    }

    // Cascade delete — Prisma xóa tất cả dữ liệu liên quan
    await prisma.user.delete({ where: { id: userId } });

    res.json({ message: `Đã xóa vĩnh viễn tài khoản ${target.businessName}.` });
  } catch (error: any) {
    console.error('[Admin] deleteUser error:', error);
    res.status(500).json({ error: 'Không thể xóa người dùng.' });
  }
};
