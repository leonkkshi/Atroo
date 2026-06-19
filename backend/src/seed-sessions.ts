/**
 * seed-sessions.ts
 * Seed dữ liệu UserSession cho tất cả users:
 *  - Từ ngày tạo tài khoản đến hôm nay
 *  - Mỗi ngày: 1-3 phiên, tổng tối thiểu 8 giờ (random tối đa ~12 giờ)
 *  - Thời điểm login random trong ngày (6h sáng – 23h)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Tạo sessions cho 1 ngày với tổng thời gian >= minTotalSecs
 * Trả về mảng { loginAt, logoutAt, duration }
 */
function generateDaySessions(
  day: Date,
  minTotalSecs: number,
  maxTotalSecs: number
): Array<{ loginAt: Date; logoutAt: Date; duration: number }> {
  const totalSecs = randInt(minTotalSecs, maxTotalSecs);
  const numSessions = randInt(1, 3);

  // Chia tổng thời gian thành numSessions phần
  const parts: number[] = [];
  let remaining = totalSecs;
  for (let i = 0; i < numSessions - 1; i++) {
    const minPart = Math.floor(remaining * 0.2);
    const maxPart = Math.floor(remaining * 0.6);
    const part = randInt(Math.max(minPart, 600), maxPart); // tối thiểu 10 phút
    parts.push(part);
    remaining -= part;
  }
  parts.push(remaining);

  // Sắp xếp thời điểm login trong ngày (6h - 22h)
  const slots: number[] = [];
  for (let i = 0; i < numSessions; i++) {
    slots.push(randInt(6 * 3600, 22 * 3600 - parts[i]));
  }
  slots.sort((a, b) => a - b);

  // Đảm bảo các session không overlap
  const sessions: Array<{ loginAt: Date; logoutAt: Date; duration: number }> = [];
  let prevEnd = 0;
  for (let i = 0; i < numSessions; i++) {
    const startSecs = Math.max(slots[i], prevEnd + randInt(600, 3600)); // gap 10-60 phút
    const duration = parts[i];
    const endSecs = startSecs + duration;

    const loginAt = new Date(startOfDay(day).getTime() + startSecs * 1000);
    const logoutAt = new Date(startOfDay(day).getTime() + endSecs * 1000);

    sessions.push({ loginAt, logoutAt, duration });
    prevEnd = endSecs;
  }

  return sessions;
}

async function main() {
  console.log('🔍 Đang lấy danh sách users...');

  const users = await prisma.user.findMany({
    select: { id: true, businessName: true, createdAt: true },
    orderBy: { id: 'asc' },
  });

  console.log(`👥 Tìm thấy ${users.length} users\n`);

  // Xóa sessions cũ (nếu có, để tránh trùng)
  const deletedCount = await prisma.userSession.deleteMany({});
  console.log(`🗑️  Đã xóa ${deletedCount.count} sessions cũ\n`);

  const today = startOfDay(new Date());
  let totalCreated = 0;

  for (const user of users) {
    const startDate = startOfDay(new Date(user.createdAt));
    const days: Date[] = [];

    // Lấy tất cả ngày từ createdAt đến hôm nay
    let cursor = new Date(startDate);
    while (cursor <= today) {
      days.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }

    console.log(`📅 [${user.businessName}] ${days.length} ngày cần seed...`);

    // Tạo sessions theo batch
    const sessionData: Array<{
      userId: number;
      loginAt: Date;
      logoutAt: Date;
      duration: number;
    }> = [];

    for (const day of days) {
      // Ngày hôm nay chỉ tính đến giờ hiện tại
      const isToday = day.toDateString() === today.toDateString();
      const maxSecs = isToday ? Math.min(8 * 3600, Math.floor((Date.now() - today.getTime()) / 1000 - 3600)) : 12 * 3600;
      const minSecs = isToday ? Math.min(4 * 3600, maxSecs) : 8 * 3600;

      if (maxSecs < 1800) continue; // skip nếu quá ít thời gian

      const daySessions = generateDaySessions(day, minSecs, maxSecs);
      for (const s of daySessions) {
        sessionData.push({ userId: user.id, ...s });
      }
    }

    // Insert batch
    await prisma.userSession.createMany({ data: sessionData });
    totalCreated += sessionData.length;
    console.log(`   ✅ Đã tạo ${sessionData.length} sessions`);
  }

  console.log(`\n🎉 Hoàn thành! Tổng cộng ${totalCreated} sessions đã được tạo.`);
}

main()
  .catch(e => { console.error('❌ Lỗi:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
