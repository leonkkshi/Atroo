import prisma from './utils/prisma';
import bcrypt from 'bcryptjs';

interface NewUserSeed {
  businessName: string;
  phone: string;
  address: string;
}

const NEW_USERS: NewUserSeed[] = [
  { businessName: "Loan's Pickleball", phone: "0989419586", address: "Ngõ 5 Cụm 4 Thôn 3 Thạch Hòa" },
  { businessName: "Qin Hair Salon", phone: "0983071566", address: "Thôn 3 Hòa Lạc" },
  { businessName: "Liên Facial Spa", phone: "0395769189", address: "Thôn 3 Hòa Lạc" },
  { businessName: "Bún Chả Thu Hà", phone: "0898243680", address: "Thôn 3 Hòa Lạc" },
  { businessName: "Bún Bò Huế Đức Duy", phone: "0973271135", address: "Thôn 3 Hòa Lạc" },
  { businessName: "Quán Ăn Đêm Tuấn Hằng", phone: "0964495509", address: "Thôn 2 Hòa Lạc" },
  { businessName: "Bún Cá Thái Bình", phone: "0901513669", address: "Thôn 2 Hòa Lạc" },
  { businessName: "Lẩu Nướng 368", phone: "0977625684", address: "Ngã 3 Hòa lạc" },
  { businessName: "Quán meo meo phở bò cơm rang", phone: "0981890636", address: "Thôn 4 Thạch Hòa" },
  { businessName: "Yên Bái Quán", phone: "0879952398", address: "Thôn 3 Thạch Hòa" },
  { businessName: "Cơm sạch 17", phone: "0822783123", address: "Thôn 3 Thạch Hòa" },
  { businessName: "Hẻm Nướng 1978", phone: "0327127277", address: "Thôn 3 Thạch Hòa" },
  { businessName: "Cơm Xe Tải Thanh Huyền", phone: "0987746158", address: "Gần ngã tư đhqg" },
  { businessName: "Cơm Nguyễn Tuấn", phone: "0983556183", address: "Ngã 3 Hòa lạc" },
  { businessName: "Cơm Tấm Chính Lan 1998", phone: "0368466998", address: "Tân Xã - Hòa Lạc" },
  { businessName: "Thiên Ban Quán Bún Cá Cay", phone: "0968860363", address: "tân Xã - Hòa Lạc" }
];

// Sinh ngày ngẫu nhiên từ 04/06/2026 đến 11/06/2026
function getRandomCreatedAt(): Date {
  const start = new Date('2026-06-04T07:00:00').getTime();
  const end = new Date('2026-06-11T22:00:00').getTime();
  const randomTimestamp = start + Math.random() * (end - start);
  return new Date(randomTimestamp);
}

async function seedNewUsers() {
  console.log('🚀 Bắt đầu import danh sách người dùng mới...');
  console.log('══════════════════════════════════════════════════════════');

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of NEW_USERS) {
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

seedNewUsers()
  .catch((err) => {
    console.error('❌ Lỗi nghiêm trọng:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
