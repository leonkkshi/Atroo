/**
 * Seed script: Import danh sách người dùng từ file
 * Chạy: npx ts-node --transpile-only src/seed-users.ts
 *
 * - taxCode   = số điện thoại (đã xoá khoảng trắng & dấu chấm)
 * - password  = số điện thoại (đã xoá khoảng trắng & dấu chấm)
 * - businessName = tên quán/cửa hàng
 * - phone, address, email được lưu vào profile
 */

import prisma from './utils/prisma';
import bcrypt from 'bcryptjs';

interface UserSeed {
  businessName: string;
  phone: string;
  email?: string;
  address?: string;
}

const RAW_USERS: UserSeed[] = [
  { businessName: 'Quán Nhậu Galaxy',               phone: '862019199',    email: 'quannhaugalaxy@gmail.com',       address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Ghiền BBQ',                       phone: '0372311859',   email: 'quachmanhloc1999@gmail.com',     address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'MANYO Tteokbokki Hoà Lạc',        phone: '0977567833',   email: 'manyohoalac@gmail.com',          address: 'Tân Xã - Hòa Lạc' },
  { businessName: 'HaBi Streets Cuisine - Hoà Lạc',  phone: '0398900026',                                            address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: '1988 BBQ',                         phone: '0329656565',   email: '1988bbq1@gmail.com',             address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Bánh tráng Tana',                 phone: '0975533159',   email: 'sieuthibanhtrangtana@gmail.com', address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Nhất Nướng Quán',                 phone: '0985372989',                                            address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Cơm Gà Ruby',                     phone: '0966378633',   email: 'Ngocthuytiin@gmail.com',         address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Sweet Cake Tân Xã',               phone: '0334678158',                                            address: 'Tân Xã - Hòa Lạc' },
  { businessName: 'Cơm rang Nguyễn Việt',            phone: '356721667',                                             address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Young Food&Drink',                phone: '0335990484',                                            address: 'Tân Xã - Hòa Lạc' },
  { businessName: 'Lẩu nướng 368',                   phone: '977625684',    email: 'giakhang842009@gmail.com',       address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Nem nướng Hùng Anh',              phone: '342436528',                                             address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Trung Toàn Bakery',               phone: '0338893388',                                            address: 'Hòa Lạc, Bình Yên, Thạch Thất, Hà Nội' },
  { businessName: 'Thành Phát Bakery Hoà Lạc',       phone: '0906066585',                                            address: 'Hòa Lạc, Bình Yên, Thạch Thất, Hà Nội' },
  { businessName: 'Taetna Hoà Lạc',                  phone: '968478816',                                             address: 'Thạch Hòa - Thạch Thất' },
  { businessName: 'Hằng Nguyễn bakery',              phone: '962288790',                                             address: 'Ngã tư lục quân, Hòa lạc' },
  { businessName: 'Chè ngon Jolly',                  phone: '0869958939',                                            address: 'Thôn 3 Thạch Hòa' },
  { businessName: 'Techno Tea',                      phone: '326392618',                                             address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Takocha',                         phone: '0343857996',                                            address: 'Thôn 3 - Thạch Hòa - Thạch Thất' },
  { businessName: 'Bún Cá Nam Hà',                   phone: '966707009',                                             address: 'Hòa Lạc, Bình Yên, Thạch Thất, Hà Nội' },
  { businessName: 'Barbershop Hoà Lạc',              phone: '389369202',                                             address: 'Hòa Lạc, Bình Yên, Thạch Thất, Hà Nội' },
  { businessName: 'Tiên An Costumes',                phone: '929745666',                                             address: 'Hòa Lạc, Bình Yên, Thạch Thất, Hà Nội' },
  { businessName: 'Phở Nam Nhất',                    phone: '385748668',                                             address: 'Cầu Hòa Lạc, Bình Yên, Thạch Thất, Hà Nội' },
];

async function seedUsers() {
  console.log('');
  console.log('🚀 Bắt đầu import danh sách người dùng...');
  console.log('══════════════════════════════════════════════════════════');

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const u of RAW_USERS) {
    const taxCode = u.phone; // Dùng số điện thoại làm taxCode
    const password = u.phone; // Mật khẩu mặc định = số điện thoại

    try {
      const existing = await prisma.user.findUnique({ where: { taxCode } });

      if (existing) {
        console.log(`⏭  Bỏ qua (đã tồn tại): ${u.businessName} — ${taxCode}`);
        skipped++;
        continue;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.user.create({
        data: {
          taxCode,
          businessName: u.businessName,
          password: hashedPassword,
          phone: u.phone,
          address: u.address ?? null,
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      console.log(`✅ Đã tạo: ${u.businessName} — MST/SĐT: ${taxCode}`);
      created++;
    } catch (err: any) {
      console.error(`❌ Lỗi khi tạo "${u.businessName}": ${err.message}`);
      failed++;
    }
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(`📊 Kết quả: ${created} tạo mới | ${skipped} bỏ qua | ${failed} lỗi`);
  console.log('');
  console.log('ℹ️  Mật khẩu mặc định của mỗi tài khoản = số điện thoại (taxCode)');
  console.log('   Ví dụ: taxCode=862019199 → password=862019199');
  console.log('');
}

seedUsers()
  .catch((err) => {
    console.error('❌ Lỗi nghiêm trọng:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
