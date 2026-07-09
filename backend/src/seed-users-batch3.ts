import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────
// Danh sách user mới (đợt 3 - khu vực Tây Phương HN)
// ──────────────────────────────────────────────────────
const NEW_USERS = [
  { businessName: 'The led tiệm Trà Chanh',               phone: '0985402728',  address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Quán Cơm Hữu Toàn',                   phone: '',            address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Bún Bò Huế Thảo My',                  phone: '',            address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Phở Bờm',                             phone: '0966985581',  address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Vườn Xoài Quán',                      phone: '0916898505',  address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Kong Buffet Lẩu Nướng Thạch Thất',    phone: '0948868767',  address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Huy Béo Quán',                        phone: '0989601924',  address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Bún Ngan Huyền Thương',               phone: '0971244563',  address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Quán Cơm Bống',                       phone: '0393691682',  address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Cà Phê Bùng',                         phone: '0979735489',  address: '98 ĐT419, Thôn Bùng, Tây Phương, Hà Nội' },
  { businessName: 'Cơm bình dân Hải Lan',                phone: '0383507796',  address: 'ĐT419, Cống Sông Bùng, Tây Phương, Hà Nội' },
  { businessName: 'Nhà Hàng Gà Mạnh Hoạch Phùng Xá',    phone: '0977586848',  address: 'ĐT419, Tây Phương, Hà Nội, Vietnam' },
  { businessName: 'Nhà Hàng Thịt Chó Phạm Hiệp',        phone: '',            address: '94 Đường 419 Phùng Xá, Tây Phương, Hà Nội' },
  { businessName: 'Tiệm bánh mình Hiếu',                 phone: '',            address: 'Đường Cổng Nùi, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Ánh Lành Makeup',                     phone: '0981601298',  address: '37 Xóm 1, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Nhà Của An',                          phone: '0965204686',  address: '40 Đường Cổng Kết, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Quán Phở Mạnh Tiến',                  phone: '0366342755',  address: 'Đường Cổng Kết, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Lẩu ếch Hồng Kiên',                   phone: '0978714387',  address: 'Xóm 2, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Hair & Beauty ĐạtG',                   phone: '0867793883',  address: 'Xóm 3, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Bún Đậu Mắm Tôm Thanh Lan',           phone: '0973085381',  address: 'Đường Cổng Đình, Tây Phương, Hà Nội' },
  { businessName: 'Quán ăn vặt Chu Chu',                  phone: '',            address: 'Đường Cổng Đình, Tây Phương, Hà Nội' },
  { businessName: 'Phở Gà Nhớ',                          phone: '0946373383',  address: '96 Đường Đa Khoa, Tây Phương, Hà Nội' },
  { businessName: 'Buffet Chay Happy',                    phone: '0966306361',  address: '59 Liên Xã, Tây Phương, Hà Nội' },
  { businessName: 'Ngọc Thạch Quán Hữu Bằng',            phone: '',            address: '50 Đ. Trường Học, Tây Phương, Hà Nội' },
  { businessName: 'Chè Hằng',                            phone: '0582683683',  address: 'Đ. Trường Học, Tây Phương, Hà Nội' },
  { businessName: 'Dingtea Hữu Bằng',                    phone: '0836672672',  address: 'Đ. Trường Học, Tây Phương, Hà Nội' },
  { businessName: 'Hiếu Trí - Bún Bò Huế',               phone: '',            address: 'Đ. Trường Học, Tây Phương, Hà Nội' },
  { businessName: 'Next Xu Cafe 2',                      phone: '0983195612',  address: 'Cổng Đông, Tây Phương, Hà Nội' },
  { businessName: 'Trạm Trà Kami',                       phone: '',            address: 'Cổng Đông, Tây Phương, Hà Nội' },
  { businessName: 'BBQ Thu Hương Phan',                   phone: '0945588673',  address: 'Đ. Trường Học, Tây Phương, Hà Nội' },
  { businessName: 'Phở Gà Mây Thương Thương',             phone: '',            address: 'Xóm Rừng Mây, Vĩnh Lộc, Tây Phương, Hà Nội' },
  { businessName: 'Bún Cá Quả Sơn Tây',                  phone: '0387021593',  address: '79 Đ. Trường Học, Hữu Bằng, Hà Nội' },
  { businessName: 'Ăn Vặt Mẹ Sữa',                       phone: '02462944588', address: '79 Đ. Trường Học, Tây Phương, Hà Nội' },
  { businessName: 'Guu Chicken',                         phone: '0987565940',  address: '28 Đ. Trường Học, Tây Phương, Hà Nội' },
  { businessName: 'ZICO HAIR',                           phone: '0385874468',  address: '30 Đ. Trường Học, Tây Phương, Hà Nội' },
  { businessName: 'Quán Phở Hoàng Nam',                  phone: '',            address: '' },
  { businessName: 'Nủa Coffee',                          phone: '0908586226',  address: '24 Đ. Ủy Ban, Tây Phương, Hà Nội' },
  { businessName: 'Ếch Xanh Thạch Thất',                 phone: '0337421879',  address: '11 Đường 419 Phùng Xá, Tây Phương, Hà Nội' },
  { businessName: 'Tiệm Bánh Nguyễn Huệ',                phone: '',            address: '38 Đập Đồng Bùi, Tây Phương, Hà Nội, Vietnam' },
];

// ──────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function randDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Sinh taxCode duy nhất cho user không có SĐT
let taxCodeCounter = 7000;
function genFallbackTaxCode(): string {
  taxCodeCounter++;
  return `TX${taxCodeCounter}`;
}

// ──────────────────────────────────────────────────────
// Tạo sessions thực tế cho 1 user
// ──────────────────────────────────────────────────────
async function createSessionsForUser(userId: number, createdAt: Date, now: Date) {
  const sessions: {
    userId: number;
    loginAt: Date;
    logoutAt: Date;
    duration: number;
  }[] = [];

  const startDay = new Date(createdAt);
  startDay.setHours(0, 0, 0, 0);

  let cursor = new Date(startDay);

  while (cursor <= now) {
    // Mỗi ngày 1-3 phiên, tổng 1h-4h
    const sessionsPerDay = randInt(1, 3);
    const totalOnlineSec = randInt(3600, 14400);

    // Phân bổ thời gian cho từng session
    const durations: number[] = [];
    let remaining = totalOnlineSec;
    for (let s = 0; s < sessionsPerDay; s++) {
      if (s === sessionsPerDay - 1) {
        durations.push(Math.max(600, remaining));
      } else {
        const d = randInt(
          Math.max(600, Math.floor(remaining * 0.2)),
          Math.floor(remaining * 0.6)
        );
        durations.push(d);
        remaining -= d;
      }
    }

    // Giờ đăng nhập (7h - 21h), sort tăng dần để không chồng chéo
    const loginHours = Array.from({ length: sessionsPerDay }, () =>
      randFloat(7, 21)
    ).sort((a, b) => a - b);

    for (let s = 0; s < sessionsPerDay; s++) {
      const h = loginHours[s];
      const loginAt = new Date(cursor);
      loginAt.setHours(
        Math.floor(h),
        Math.floor((h % 1) * 60),
        randInt(0, 59),
        0
      );

      if (loginAt > now) break;
      // loginAt phải sau createdAt
      if (loginAt < createdAt) continue;

      const logoutRaw = new Date(loginAt.getTime() + durations[s] * 1000);
      const logoutAt = logoutRaw > now ? now : logoutRaw;
      const duration = Math.floor((logoutAt.getTime() - loginAt.getTime()) / 1000);

      if (duration < 120) continue; // bỏ session < 2 phút

      sessions.push({ userId, loginAt, logoutAt, duration });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (sessions.length > 0) {
    await prisma.userSession.createMany({ data: sessions });
  }
  return sessions;
}

// ──────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────
async function main() {
  const now = new Date();
  // createdAt: random trong 2 tuần trước đến hôm nay
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  console.log('🚀 Bắt đầu import đợt 3 (khu vực Tây Phương)...');
  console.log(`   createdAt ngẫu nhiên: ${twoWeeksAgo.toLocaleDateString('vi-VN')} → ${now.toLocaleDateString('vi-VN')}`);
  console.log('══════════════════════════════════════════════════════════');

  let created = 0, skipped = 0, failed = 0;

  for (const u of NEW_USERS) {
    // TaxCode = SĐT nếu có, không thì sinh fallback
    const taxCode = u.phone.trim() !== '' ? u.phone.trim() : genFallbackTaxCode();
    const rawPassword = u.phone.trim() !== '' ? u.phone.trim() : taxCode;

    try {
      // Kiểm tra tồn tại
      const existing = await prisma.user.findUnique({ where: { taxCode } });
      if (existing) {
        console.log(`⏭  Bỏ qua (đã tồn tại): ${u.businessName}`);
        skipped++;
        continue;
      }

      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const createdAt = randDate(twoWeeksAgo, now);

      // lastActiveAt: random từ createdAt đến now
      const lastActiveAt = randDate(createdAt, now);

      // Tạo user
      const user = await prisma.user.create({
        data: {
          taxCode,
          businessName: u.businessName,
          password: hashedPassword,
          phone: u.phone || null,
          address: u.address || null,
          role: 'USER',
          status: 'ACTIVE',
          createdAt,
          lastActiveAt,
        },
      });

      // Tạo sessions
      const sessions = await createSessionsForUser(user.id, createdAt, now);
      const totalHours = sessions.reduce((s, x) => s + x.duration, 0) / 3600;
      const days = Math.max(
        1,
        Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      );

      console.log(
        `✅ [${String(user.id).padStart(3)}] ${u.businessName.padEnd(38)} | ${sessions.length} sessions | ${totalHours.toFixed(1)}h / ${days} ngày | lastActive: ${lastActiveAt.toLocaleString('vi-VN')}`
      );
      created++;
    } catch (err: any) {
      console.error(`❌ Lỗi "${u.businessName}": ${err.message}`);
      failed++;
    }
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(`📊 Kết quả: ${created} tạo mới | ${skipped} bỏ qua | ${failed} lỗi`);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
