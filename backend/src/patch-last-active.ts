import prisma from './utils/prisma';

function randomDate(start: Date, end: Date): Date {
  const ms = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(ms);
}

async function patchLastActive() {
  const now = new Date();
  const FROM = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 giờ trước (hôm qua)
  const TO = now; // Hiện tại (hôm nay)

  console.log('');
  console.log('🔧 Bắt đầu cập nhật lastActiveAt ngẫu nhiên...');
  console.log(`   Khoảng: ${FROM.toLocaleString('vi-VN')} → ${TO.toLocaleString('vi-VN')}`);
  console.log('══════════════════════════════════════════════════════════');

  // Lấy tất cả user (trừ ADMIN)
  const users = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true, businessName: true, lastActiveAt: true },
    orderBy: { id: 'asc' },
  });

  console.log(`📋 Tìm thấy ${users.length} user cần cập nhật\n`);

  let updated = 0;
  for (const user of users) {
    const newDate = randomDate(FROM, TO);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: newDate },
    });

    console.log(
      `✅ [${String(user.id).padStart(3)}] ${user.businessName.padEnd(35)} → lastActiveAt: ${newDate.toLocaleString('vi-VN')}`
    );
    updated++;
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(`📊 Đã cập nhật lastActiveAt cho ${updated}/${users.length} user thành công!`);
  console.log('');
}

patchLastActive()
  .catch((err) => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
