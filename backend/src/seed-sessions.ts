import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Random int in [min, max]
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random float in [min, max]
function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function main() {
  console.log('🔧 Bắt đầu tạo UserSession giả lập...');
  console.log('══════════════════════════════════════════════════════════');

  const now = new Date();

  // Lấy tất cả user trừ ADMIN
  const users = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' } },
    select: { id: true, businessName: true, createdAt: true },
    orderBy: { id: 'asc' },
  });

  console.log(`📋 Tìm thấy ${users.length} user cần tạo session\n`);

  let totalSessions = 0;

  for (const user of users) {
    // Xoá session cũ (nếu có) để tránh duplicate
    await prisma.userSession.deleteMany({ where: { userId: user.id } });

    const sessions: {
      userId: number;
      loginAt: Date;
      logoutAt: Date;
      duration: number;
    }[] = [];

    // Duyệt từng ngày từ createdAt đến hôm nay
    const startDate = new Date(user.createdAt);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    let cursor = new Date(startDate);

    while (cursor <= endDate) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);

      // Mỗi ngày có 1-3 phiên đăng nhập
      const sessionsPerDay = randInt(1, 3);
      // Tổng thời gian online trong ngày: 1h - 4h (giây)
      const totalOnlineSeconds = randInt(3600, 14400);
      // Phân bổ thời gian cho từng session
      const sessionDurations: number[] = [];
      let remaining = totalOnlineSeconds;
      for (let s = 0; s < sessionsPerDay; s++) {
        if (s === sessionsPerDay - 1) {
          sessionDurations.push(remaining);
        } else {
          const dur = randInt(
            Math.floor(remaining * 0.2),
            Math.floor(remaining * 0.6)
          );
          sessionDurations.push(dur);
          remaining -= dur;
        }
      }

      // Sắp xếp các khoảng giờ login trong ngày (7h sáng - 22h tối)
      // Các quán thường mở từ sáng sớm
      const loginHours = Array.from({ length: sessionsPerDay }, () =>
        randFloat(7, 21)
      ).sort((a, b) => a - b);

      for (let s = 0; s < sessionsPerDay; s++) {
        const loginHour = loginHours[s];
        const loginAt = new Date(cursor);
        loginAt.setHours(
          Math.floor(loginHour),
          Math.floor((loginHour % 1) * 60),
          randInt(0, 59),
          0
        );

        // Đảm bảo loginAt không vượt quá now
        if (loginAt > now) break;

        const durationSeconds = sessionDurations[s];
        const logoutAt = new Date(loginAt.getTime() + durationSeconds * 1000);

        // Đảm bảo logoutAt không vượt quá now
        const actualLogoutAt = logoutAt > now ? now : logoutAt;
        const actualDuration = Math.floor(
          (actualLogoutAt.getTime() - loginAt.getTime()) / 1000
        );

        if (actualDuration < 60) continue; // bỏ session quá ngắn < 1 phút

        sessions.push({
          userId: user.id,
          loginAt,
          logoutAt: actualLogoutAt,
          duration: actualDuration,
        });
      }

      // Sang ngày tiếp theo
      cursor.setDate(cursor.getDate() + 1);
    }

    // Batch insert
    if (sessions.length > 0) {
      await prisma.userSession.createMany({ data: sessions });
      totalSessions += sessions.length;

      // Tính tổng giờ online
      const totalHours = sessions.reduce((sum, s) => sum + s.duration, 0) / 3600;
      const days = Math.ceil(
        (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      console.log(
        `✅ [${String(user.id).padStart(3)}] ${user.businessName.padEnd(35)} → ${sessions.length} sessions | ${totalHours.toFixed(1)}h / ${days} ngày`
      );
    }
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(
    `📊 Đã tạo ${totalSessions} sessions cho ${users.length} user thành công!`
  );
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
