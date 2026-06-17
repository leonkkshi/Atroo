/**
 * Patch script: Cập nhật createdAt ngẫu nhiên cho tất cả user (trừ ADMIN)
 * Khoảng thời gian: 25/05/2026 → 04/06/2026
 * Chạy: npx ts-node --transpile-only src/patch-created-at.ts
 */

import prisma from './utils/prisma';

function randomDate(start: Date, end: Date): Date {
  const ms = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  // Giới hạn giờ trong ngày: 7h sáng → 23h đêm (thực tế hơn)
  const d = new Date(ms);
  const hour = 7 + Math.floor(Math.random() * 16); // 7–22h
  const min  = Math.floor(Math.random() * 60);
  const sec  = Math.floor(Math.random() * 60);
  d.setHours(hour, min, sec, 0);
  return d;
}

async function patchCreatedAt() {
  const FROM = new Date('2026-05-25T00:00:00+07:00');
  const TO   = new Date('2026-06-04T23:59:59+07:00');

  console.log('');
  console.log('🔧 Bắt đầu cập nhật createdAt ngẫu nhiên...');
  console.log(`   Khoảng: ${FROM.toLocaleDateString('vi-VN')} → ${TO.toLocaleDateString('vi-VN')}`);
  console.log('══════════════════════════════════════════════════════════');

  // Lấy tất cả user (trừ ADMIN)
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true, businessName: true, createdAt: true },
    orderBy: { id: 'asc' },
  });

  console.log(`📋 Tìm thấy ${users.length} user cần cập nhật\n`);

  let updated = 0;
  for (const user of users) {
    const newDate = randomDate(FROM, TO);

    await prisma.$executeRaw`
      UPDATE "User"
      SET "createdAt" = ${newDate}
      WHERE id = ${user.id}
    `;

    console.log(
      `✅ [${String(user.id).padStart(3)}] ${user.businessName.padEnd(35)} → ${newDate.toLocaleString('vi-VN')}`
    );
    updated++;
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(`📊 Đã cập nhật ${updated}/${users.length} user thành công!`);
  console.log('');
}

patchCreatedAt()
  .catch((err) => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
