import prisma from './utils/prisma';
import bcrypt from 'bcryptjs';

interface NewUserSeed2 {
  businessName: string;
  phone: string;
  address: string;
}

const NEW_USERS_2: NewUserSeed2[] = [
  { businessName: "Mây Quán", phone: "0862261226", address: "đường hoàng tùng, lê trọng tấn, an khánh hà nội" },
  { businessName: "Tiêm Cơm Gia Đinh Hà Đông", phone: "0965730550", address: "Khu B Geleximco, Lê Trọng Tấn, An Khánh, Hà Nội" },
  { businessName: "Cơm Ngon Anh Béo", phone: "0968251516", address: "Khu B Geleximco, An Khánh, Hà Nội" },
  { businessName: "Tiệm Cơm Nàng Tấm", phone: "0839103388", address: "Khu đô thị Geleximco, Lê Trọng Tấn, Tây Mỗ, Hà Nội" },
  { businessName: "Bún Đậu Thủy Gà", phone: "0985102468", address: "201 Lê Trọng Tấn, La Dương, Dương Nội, Hà Nội" },
  { businessName: "Tít Thò Lò", phone: "0972895533", address: "18AB, Dương Nội, Hà Nội" },
  { businessName: "Cháo Mr.Bean", phone: "0862655924", address: "Lê Giản, Đại Mỗ, Hà Nội, Vietnam" },
  { businessName: "Tiệm Bánh Thu Trang", phone: "0936290932", address: "49 P. Ngọc Trục, làng Ngọc Trục, Đại Mỗ, Hà Nội" },
  { businessName: "MỲ CAY LA'CA", phone: "0989251931", address: "40 P. Ngọc Trục, làng Ngọc Trục, Đại Mỗ, Hà Nội" },
  { businessName: "Chân Gà Sốt Thái MeeChang", phone: "0336789071", address: "93 Ngọc Trục, làng Ngọc Trục, Đại Mỗ, Hà Nội" },
  { businessName: "Chất Lẩu Nướng Buffet", phone: "0969158193", address: "48 Vườn Cam, Từ Liêm, Hà Nội" },
  { businessName: "Quán nhậu Trang Trẻ Trâu", phone: "0968598771", address: "6 P. Hồng Đô, làng Phú Đô, Từ Liêm, Hà Nội" },
  { businessName: "Bia hơi minh tâm", phone: "0836484333", address: "31 Đ. Mễ Trì, Từ Liêm, Hà Nội" },
  { businessName: "Phở Thìn Mỹ Đình", phone: "02432006379", address: "CT9 Mỹ Đình Sông Đà, Từ Liêm, Hà Nội" },
  { businessName: "Quán Tươi", phone: "0974356725", address: "3 Ngõ 123 Trung Kính, Yên Hòa, Hà Nội" },
  { businessName: "Cơm Văn Đô Trung Kính", phone: "0356922789", address: "58 P. Trung Kính, Yên Hòa, Hà Nội" },
  { businessName: "KienKo Kitchen", phone: "0779222029", address: "34 P. Trung Kính, Yên Hòa, Hà Nội" },
  { businessName: "Bún riêu tóp mỡ 37", phone: "0961013130", address: "67 P. Trung Kính, Yên Hòa, Hà Nội" },
  { businessName: "Đụt Quán", phone: "0868128180", address: "5 Ngõ 41 Trần Duy Hưng, Yên Hòa, Hà Nội" }
];

// Sinh ngày ngẫu nhiên từ 11/06/2026 đến 18/06/2026
function getRandomCreatedAt(): Date {
  const start = new Date('2026-06-11T07:00:00').getTime();
  const end = new Date('2026-06-18T22:00:00').getTime();
  const randomTimestamp = start + Math.random() * (end - start);
  return new Date(randomTimestamp);
}

async function seedNewUsers2() {
  console.log('🚀 Bắt đầu import danh sách người dùng mới (đợt 2)...');
  console.log('══════════════════════════════════════════════════════════');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of NEW_USERS_2) {
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
      const createdAt = getRandomCreatedAt();

      await prisma.user.create({
        data: {
          taxCode,
          businessName: u.businessName,
          password: hashedPassword,
          phone: u.phone,
          address: u.address,
          role: 'USER',
          status: 'ACTIVE',
          createdAt,
        },
      });

      console.log(`✅ Đã tạo: ${u.businessName} — SĐT/TaxCode: ${taxCode} (createdAt: ${createdAt.toISOString()})`);
      created++;
    } catch (err: any) {
      console.error(`❌ Lỗi khi tạo "${u.businessName}": ${err.message}`);
      failed++;
    }
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(`📊 Kết quả: ${created} tạo mới | ${skipped} bỏ qua | ${failed} lỗi`);
}

seedNewUsers2()
  .catch((err) => {
    console.error('❌ Lỗi nghiêm trọng:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
