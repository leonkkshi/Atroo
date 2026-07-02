import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateVoucherId(): string {
  return `vc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

// ─── GET /pos/vouchers ────────────────────────────────────────────────────────
// Danh sách voucher của user hiện tại
export const getVouchers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const vouchers = await prisma.voucher.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ vouchers });
  } catch (err) {
    console.error('[Voucher] getVouchers error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách voucher.' });
  }
};

// ─── POST /pos/vouchers ───────────────────────────────────────────────────────
// Tạo voucher mới
export const createVoucher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      code,
      type,
      value,
      minOrderAmount,
      usageLimit,
      expiresAt,
      description,
    } = req.body as {
      code: string;
      type: string;
      value: number;
      minOrderAmount?: number;
      usageLimit?: number | null;
      expiresAt?: string | null;
      description?: string;
    };

    // Validate
    if (!code || !code.trim()) {
      res.status(400).json({ error: 'Mã voucher không được để trống.' });
      return;
    }
    if (!['PERCENT', 'FIXED'].includes(type)) {
      res.status(400).json({ error: 'Loại voucher không hợp lệ. Chọn PERCENT hoặc FIXED.' });
      return;
    }
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue <= 0) {
      res.status(400).json({ error: 'Giá trị giảm giá phải lớn hơn 0.' });
      return;
    }
    if (type === 'PERCENT' && numValue > 100) {
      res.status(400).json({ error: 'Phần trăm giảm giá không được vượt quá 100%.' });
      return;
    }

    const normalizedCode = normalizeCode(code);

    // Kiểm tra trùng mã trong cùng user
    const existing = await prisma.voucher.findUnique({
      where: { userId_code: { userId, code: normalizedCode } },
    });
    if (existing) {
      res.status(409).json({ error: `Mã voucher "${normalizedCode}" đã tồn tại.` });
      return;
    }

    const voucher = await prisma.voucher.create({
      data: {
        id: generateVoucherId(),
        userId,
        code: normalizedCode,
        type,
        value: numValue,
        minOrderAmount: Number(minOrderAmount ?? 0),
        usageLimit: usageLimit != null ? Number(usageLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        description: (description ?? '').trim(),
      },
    });

    res.status(201).json({ voucher });
  } catch (err) {
    console.error('[Voucher] createVoucher error:', err);
    res.status(500).json({ error: 'Không thể tạo voucher.' });
  }
};

// ─── PUT /pos/vouchers/:id ────────────────────────────────────────────────────
// Cập nhật voucher
export const updateVoucher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy voucher.' });
      return;
    }
    if (existing.userId !== userId) {
      res.status(403).json({ error: 'Bạn không có quyền sửa voucher này.' });
      return;
    }

    const {
      code,
      type,
      value,
      minOrderAmount,
      usageLimit,
      status,
      expiresAt,
      description,
    } = req.body as {
      code?: string;
      type?: string;
      value?: number;
      minOrderAmount?: number;
      usageLimit?: number | null;
      status?: string;
      expiresAt?: string | null;
      description?: string;
    };

    // Nếu đổi code → kiểm tra trùng
    let normalizedCode = existing.code;
    if (code && normalizeCode(code) !== existing.code) {
      normalizedCode = normalizeCode(code);
      const duplicate = await prisma.voucher.findUnique({
        where: { userId_code: { userId, code: normalizedCode } },
      });
      if (duplicate) {
        res.status(409).json({ error: `Mã voucher "${normalizedCode}" đã tồn tại.` });
        return;
      }
    }

    if (type && !['PERCENT', 'FIXED'].includes(type)) {
      res.status(400).json({ error: 'Loại voucher không hợp lệ.' });
      return;
    }
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
      res.status(400).json({ error: 'Trạng thái voucher không hợp lệ.' });
      return;
    }

    const numValue = value != null ? Number(value) : existing.value;
    if (!Number.isFinite(numValue) || numValue <= 0) {
      res.status(400).json({ error: 'Giá trị giảm giá phải lớn hơn 0.' });
      return;
    }

    const voucher = await prisma.voucher.update({
      where: { id },
      data: {
        code: normalizedCode,
        type: type ?? existing.type,
        value: numValue,
        minOrderAmount: minOrderAmount != null ? Number(minOrderAmount) : existing.minOrderAmount,
        usageLimit: usageLimit !== undefined ? (usageLimit != null ? Number(usageLimit) : null) : existing.usageLimit,
        status: status ?? existing.status,
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : existing.expiresAt,
        description: description != null ? description.trim() : existing.description,
      },
    });

    res.json({ voucher });
  } catch (err) {
    console.error('[Voucher] updateVoucher error:', err);
    res.status(500).json({ error: 'Không thể cập nhật voucher.' });
  }
};

// ─── DELETE /pos/vouchers/:id ─────────────────────────────────────────────────
// Xóa voucher
export const deleteVoucher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy voucher.' });
      return;
    }
    if (existing.userId !== userId) {
      res.status(403).json({ error: 'Bạn không có quyền xóa voucher này.' });
      return;
    }

    await prisma.voucher.delete({ where: { id } });
    res.json({ message: 'Đã xóa voucher thành công.' });
  } catch (err) {
    console.error('[Voucher] deleteVoucher error:', err);
    res.status(500).json({ error: 'Không thể xóa voucher.' });
  }
};

// ─── POST /pos/vouchers/validate ─────────────────────────────────────────────
// Kiểm tra mã voucher và tính toán discount
// Body: { code: string, orderTotal: number }
export const validateVoucher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { code, orderTotal } = req.body as { code: string; orderTotal: number };

    if (!code || !code.trim()) {
      res.status(400).json({ error: 'Vui lòng nhập mã voucher.' });
      return;
    }

    const normalizedCode = normalizeCode(code);
    const total = Number(orderTotal);

    const voucher = await prisma.voucher.findUnique({
      where: { userId_code: { userId, code: normalizedCode } },
    });

    if (!voucher) {
      res.status(404).json({ error: `Mã voucher "${normalizedCode}" không tồn tại.` });
      return;
    }
    if (voucher.status === 'INACTIVE') {
      res.status(400).json({ error: 'Voucher này đã bị vô hiệu hóa.' });
      return;
    }
    if (voucher.expiresAt && voucher.expiresAt < new Date()) {
      res.status(400).json({ error: 'Voucher này đã hết hạn.' });
      return;
    }
    if (voucher.usageLimit != null && voucher.usageCount >= voucher.usageLimit) {
      res.status(400).json({ error: 'Voucher này đã hết lượt sử dụng.' });
      return;
    }
    if (voucher.minOrderAmount > 0 && total < voucher.minOrderAmount) {
      res.status(400).json({
        error: `Đơn hàng phải đạt tối thiểu ${voucher.minOrderAmount.toLocaleString('vi-VN')}đ để dùng voucher này.`,
      });
      return;
    }

    // Tính số tiền được giảm
    let discountAmount = 0;
    if (voucher.type === 'PERCENT') {
      discountAmount = Math.round((total * voucher.value) / 100);
    } else {
      discountAmount = voucher.value;
    }
    // Không giảm quá tổng hóa đơn
    discountAmount = Math.min(discountAmount, total);

    res.json({
      valid: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        type: voucher.type,
        value: voucher.value,
        description: voucher.description,
      },
      discountAmount,
      finalTotal: total - discountAmount,
    });
  } catch (err) {
    console.error('[Voucher] validateVoucher error:', err);
    res.status(500).json({ error: 'Không thể kiểm tra voucher.' });
  }
};
