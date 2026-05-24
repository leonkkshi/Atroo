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

    // Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mã số thuế hoặc mật khẩu không chính xác.' });
    }

    // Tạo JWT token (hết hạn trong 30 ngày cho app di động thoải mái)
    const token = jwt.sign({ id: user.id, taxCode: user.taxCode }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      message: 'Đăng nhập thành công.',
      token,
      user: {
        id: user.id,
        taxCode: user.taxCode,
        businessName: user.businessName
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
        createdAt: true
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
