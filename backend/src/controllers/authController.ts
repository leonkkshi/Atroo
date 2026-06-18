import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'atro_jwt_secret_key_2026_super_secure';

export const register = async (req: Request, res: Response) => {
  try {
    const { taxCode, businessName, password } = req.body;

    if (!taxCode || !businessName || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin: Mã số thuế, tên doanh nghiệp và mật khẩu.' });
    }

    // Kiểm tra Mã số thuế đã tồn tại chưa
    const existingUser = await prisma.user.findUnique({
      where: { taxCode }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Mã số thuế này đã được đăng ký trên hệ thống.' });
    }

    // Băm mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới
    const user = await prisma.user.create({
      data: {
        taxCode,
        businessName,
        password: hashedPassword
      }
    });

    // Tạo token xác thực ngay sau khi đăng ký
    const token = jwt.sign({ id: user.id, taxCode: user.taxCode }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      message: 'Đăng ký tài khoản thành công.',
      token,
      user: {
        id: user.id,
        taxCode: user.taxCode,
        businessName: user.businessName
      }
    });
  } catch (error: any) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ error: 'Đăng ký thất bại. Lỗi: ' + error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { taxCode, password } = req.body;

    if (!taxCode || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp Mã số thuế và mật khẩu.' });
    }

    // Tìm user theo Mã số thuế
    const user = await prisma.user.findUnique({
      where: { taxCode }
    });

    if (!user) {
      return res.status(401).json({ error: 'Mã số thuế hoặc mật khẩu không chính xác.' });
    }

    // Kiểm tra tài khoản bị khóa
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.' });
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mã số thuế hoặc mật khẩu không chính xác.' });
    }

    // Tạo JWT token — bao gồm role để frontend nhận biết quyền
    const token = jwt.sign({ id: user.id, taxCode: user.taxCode, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    // Cập nhật lastActiveAt và tạo UserSession mới
    const now = new Date();
    prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: now } }).catch(() => {});
    const session = await prisma.userSession.create({ data: { userId: user.id } });

    res.json({
      message: 'Đăng nhập thành công.',
      token,
      sessionId: session.id,
      user: {
        id: user.id,
        taxCode: user.taxCode,
        businessName: user.businessName,
        role: user.role,
        status: user.status,
      }
    });
  } catch (error: any) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ error: 'Đăng nhập thất bại. Lỗi: ' + error.message });
  }
};

export const getProfile = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        taxCode: true,
        businessName: true,
        phone: true,
        address: true,
        bankName: true,
        bankAccount: true,
        bankAccountName: true,
        createdAt: true,
        lastActiveAt: true,
        businessType: true,
        revenueGoal: true,
        staffSize: true,
        role: true,
        status: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng.' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: 'Lấy thông tin thất bại.' });
  }
};

export const updateProfile = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { businessName, phone, address, bankName, bankAccount, bankAccountName, currentPassword, newPassword, businessType, revenueGoal, staffSize } = req.body;

    // Validation cơ bản
    if (!businessName || !businessName.trim()) {
      return res.status(400).json({ error: 'Tên cửa hàng / doanh nghiệp không được để trống.' });
    }

    const updateData: Record<string, any> = {
      businessName: businessName.trim(),
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      bankName: bankName?.trim() || null,
      bankAccount: bankAccount?.trim() || null,
      bankAccountName: bankAccountName?.trim() || null,
      businessType: businessType?.trim() || null,
      revenueGoal: revenueGoal != null && revenueGoal !== '' && !isNaN(parseFloat(revenueGoal)) ? parseFloat(revenueGoal) : null,
      staffSize: staffSize != null && staffSize !== '' && !isNaN(parseInt(staffSize)) ? parseInt(staffSize) : null,
    };

    // Đổi mật khẩu nếu có
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.' });
      }
      const existing = await prisma.user.findUnique({ where: { id: userId } });
      if (!existing) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });

      const bcrypt = await import('bcryptjs');
      const match = await bcrypt.compare(currentPassword, existing.password);
      if (!match) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        taxCode: true,
        businessName: true,
        phone: true,
        address: true,
        bankName: true,
        bankAccount: true,
        bankAccountName: true,
        createdAt: true,
        lastActiveAt: true,
        businessType: true,
        revenueGoal: true,
        staffSize: true,
        role: true,
        status: true,
      }
    });

    res.json({ message: 'Cập nhật thông tin thành công.', user });
  } catch (error: any) {
    console.error('[Auth] updateProfile error:', error);
    res.status(500).json({ error: 'Cập nhật thất bại. Vui lòng thử lại.' });
  }
};

// ── POST /auth/logout ────────────────────────────────────────────────────────
export const logout = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Chưa xác thực.' });

    // Tìm session đang mở (logoutAt = null) gần nhất
    const session = await prisma.userSession.findFirst({
      where: { userId, logoutAt: null },
      orderBy: { loginAt: 'desc' },
    });

    if (session) {
      const durationSec = Math.round((Date.now() - session.loginAt.getTime()) / 1000);
      const cappedDuration = Math.min(durationSec, 8 * 3600); // tối đa 8 giờ / session
      await prisma.userSession.update({
        where: { id: session.id },
        data: { logoutAt: new Date(), duration: cappedDuration },
      });
    }

    res.json({ message: 'Đăng xuất thành công.' });
  } catch (error: any) {
    console.error('[Auth] logout error:', error);
    res.status(500).json({ error: 'Đăng xuất thất bại.' });
  }
};

// ── PATCH /auth/session/heartbeat ────────────────────────────────────────────
// Frontend gọi mỗi 5 phút để "update" thời gian session đang mở
export const heartbeat = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Chưa xác thực.' });

    const now = new Date();

    // Cập nhật lastActiveAt
    prisma.user.update({ where: { id: userId }, data: { lastActiveAt: now } }).catch(() => {});

    // Tìm session đang mở gần nhất
    const session = await prisma.userSession.findFirst({
      where: { userId, logoutAt: null },
      orderBy: { loginAt: 'desc' },
    });

    if (session) {
      // Tính duration tạm thời (để nếu tab bị đóng đột ngột, có giá trị gần đúng)
      const durationSec = Math.round((now.getTime() - session.loginAt.getTime()) / 1000);
      const cappedDuration = Math.min(durationSec, 8 * 3600);
      // Không đặt logoutAt — chỉ lưu duration tạm
      await prisma.userSession.update({
        where: { id: session.id },
        data: { duration: cappedDuration },
      });
    } else {
      // Tạo session mới nếu không có (ví dụ: login từ session cũ trước khi có tính năng)
      await prisma.userSession.create({ data: { userId } });
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('[Auth] heartbeat error:', error);
    res.status(500).json({ error: 'Heartbeat thất bại.' });
  }
};
