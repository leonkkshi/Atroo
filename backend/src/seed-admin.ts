/**
 * Seed script: Tạo tài khoản Admin mặc định
 * Chạy: npx ts-node src/seed-admin.ts
 *
 * Thông tin tài khoản:
 *   MST     : 9999999999
 *   Tên     : Quản trị viên A Trợ
 *   Mật khẩu: admin123456
 *   Role    : ADMIN
 */

import prisma from './utils/prisma';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  const ADMIN_TAX_CODE = '9999999999';
  const ADMIN_NAME = 'Quản trị viên A Trợ';
  const ADMIN_PASSWORD = 'admin123456';

  try {
    console.log('🔍 Kiểm tra tài khoản admin...');
    const existing = await prisma.user.findUnique({ where: { taxCode: ADMIN_TAX_CODE } });

    if (existing) {
      if (existing.role !== 'ADMIN') {
        // Nâng quyền nếu tồn tại nhưng chưa phải admin
        await prisma.user.update({
          where: { taxCode: ADMIN_TAX_CODE },
          data: { role: 'ADMIN' }
        });
        console.log(`✅ Đã nâng quyền tài khoản ${ADMIN_TAX_CODE} lên ADMIN.`);
      } else {
        console.log(`ℹ️  Tài khoản admin (MST: ${ADMIN_TAX_CODE}) đã tồn tại — bỏ qua.`);
      }
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const admin = await prisma.user.create({
      data: {
        taxCode: ADMIN_TAX_CODE,
        businessName: ADMIN_NAME,
        password: hashedPassword,
        role: 'ADMIN',
        status: 'ACTIVE',
      }
    });

    console.log('');
    console.log('✅ Tạo tài khoản admin thành công!');
    console.log('══════════════════════════════════════');
    console.log(`   MST     : ${admin.taxCode}`);
    console.log(`   Tên     : ${admin.businessName}`);
    console.log(`   Mật khẩu: ${ADMIN_PASSWORD}`);
    console.log(`   Role    : ${admin.role}`);
    console.log('══════════════════════════════════════');
    console.log('⚠️  Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên!');
    console.log('');
  } catch (err: any) {
    console.error('❌ Lỗi khi tạo admin:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
