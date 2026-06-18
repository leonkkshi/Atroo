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

    // Thống kê session
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const [totalSessionAgg, last30Agg, last7Agg] = await Promise.all([
      prisma.userSession.aggregate({
        where: { userId, duration: { not: null } },
        _sum: { duration: true },
        _count: { id: true },
        _avg: { duration: true },
      }),
      prisma.userSession.aggregate({
        where: { userId, loginAt: { gte: thirtyDaysAgo }, duration: { not: null } },
        _sum: { duration: true },
      }),
      prisma.userSession.aggregate({
        where: { userId, loginAt: { gte: sevenDaysAgo }, duration: { not: null } },
        _sum: { duration: true },
      }),
    ]);

    res.json({
      ...user,
      stats: {
        declarationCount,
        invoiceCount,
        posInvoiceCount,
        totalDuration: totalSessionAgg._sum.duration ?? 0,
        totalSessions: totalSessionAgg._count.id ?? 0,
        avgDuration: Math.round(totalSessionAgg._avg.duration ?? 0),
        last30Days: last30Agg._sum.duration ?? 0,
        last7Days: last7Agg._sum.duration ?? 0,
      },
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

// ── GET /admin/users/:id/usage ────────────────────────────────────────────────
export const getUserUsage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = parseInt(String(req.params.id));
    if (isNaN(userId)) return res.status(400).json({ error: 'ID không hợp lệ.' });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    // Lấy 30 session gần nhất để vẽ chart
    const recentSessions = await prisma.userSession.findMany({
      where: { userId, duration: { not: null } },
      orderBy: { loginAt: 'desc' },
      take: 60,
      select: { loginAt: true, logoutAt: true, duration: true },
    });

    // Tổng hợp theo ngày (7 ngày gần nhất)
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const s of recentSessions) {
      const day = s.loginAt.toISOString().slice(0, 10);
      if (dailyMap[day] !== undefined && s.duration) {
        dailyMap[day] += s.duration;
      }
    }

    const [totalAgg, last30Agg, last7Agg] = await Promise.all([
      prisma.userSession.aggregate({
        where: { userId, duration: { not: null } },
        _sum: { duration: true },
        _count: { id: true },
        _avg: { duration: true },
      }),
      prisma.userSession.aggregate({
        where: { userId, loginAt: { gte: thirtyDaysAgo }, duration: { not: null } },
        _sum: { duration: true },
        _count: { id: true },
      }),
      prisma.userSession.aggregate({
        where: { userId, loginAt: { gte: sevenDaysAgo }, duration: { not: null } },
        _sum: { duration: true },
        _count: { id: true },
      }),
    ]);

    res.json({
      totalDuration: totalAgg._sum.duration ?? 0,
      totalSessions: totalAgg._count.id ?? 0,
      avgDuration: Math.round(totalAgg._avg.duration ?? 0),
      last30Days: { duration: last30Agg._sum.duration ?? 0, sessions: last30Agg._count.id ?? 0 },
      last7Days: { duration: last7Agg._sum.duration ?? 0, sessions: last7Agg._count.id ?? 0 },
      dailyUsage: Object.entries(dailyMap).map(([date, duration]) => ({ date, duration })),
      recentSessions: recentSessions.slice(0, 10),
    });
  } catch (error: any) {
    console.error('[Admin] getUserUsage error:', error);
    res.status(500).json({ error: 'Không thể lấy thống kê thời gian dùng.' });
  }
};

// ── GET /admin/usage ──────────────────────────────────────────────────────────
export const getSystemUsage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    // Top 10 users dùng nhiều nhất trong 30 ngày
    const topUsersRaw = await prisma.userSession.groupBy({
      by: ['userId'],
      where: { loginAt: { gte: thirtyDaysAgo }, duration: { not: null } },
      _sum: { duration: true },
      _count: { id: true },
      orderBy: { _sum: { duration: 'desc' } },
      take: 10,
    });

    // Lấy tên user
    const userIds = topUsersRaw.map(u => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, businessName: true, businessType: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const topUsers = topUsersRaw.map(u => ({
      userId: u.userId,
      businessName: userMap[u.userId]?.businessName ?? 'Không xác định',
      businessType: userMap[u.userId]?.businessType,
      totalDuration: u._sum.duration ?? 0,
      totalSessions: u._count.id,
    }));

    // Daily tổng hệ thống (7 ngày gần nhất)
    const allRecentSessions = await prisma.userSession.findMany({
      where: { loginAt: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) }, duration: { not: null } },
      select: { loginAt: true, duration: true },
    });

    const systemDailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      systemDailyMap[d.toISOString().slice(0, 10)] = 0;
    }
    for (const s of allRecentSessions) {
      const day = s.loginAt.toISOString().slice(0, 10);
      if (systemDailyMap[day] !== undefined && s.duration) {
        systemDailyMap[day] += s.duration;
      }
    }

    res.json({
      topUsers,
      systemDailyUsage: Object.entries(systemDailyMap).map(([date, duration]) => ({ date, duration })),
    });
  } catch (error: any) {
    console.error('[Admin] getSystemUsage error:', error);
    res.status(500).json({ error: 'Không thể lấy thống kê hệ thống.' });
  }
};
