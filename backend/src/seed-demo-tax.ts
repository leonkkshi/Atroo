/**
 * seed-demo-tax.ts
 *
 * Tạo 4 account demo để minh hoạ tính thuế khoán theo 4 nhóm doanh thu (Nghị định 68/2026):
 *   Nhóm 1 – ≤ 1 tỷ/năm      → 0 đồng thuế (miễn hoàn toàn)
 *   Nhóm 2 – ~2 tỷ/năm      → Có thuế GTGT 5% + TNCN 2% (tiệm cắt tóc)
 *   Nhóm 3 – ~5 tỷ/năm      → Kê khai theo lợi nhuận, TNCN 17%
 *   Nhóm 4 – ~80 tỷ/năm     → Kê khai theo lợi nhuận, TNCN 20%
 *
 * Mỗi account có:
 *   - Thông tin kinh doanh thực tế
 *   - Sản phẩm POS phù hợp với ngành
 *   - Lịch sử bán hàng (PosInvoice) để doanh thu khớp đúng nhóm
 *   - Chi phí (PosExpense) tương ứng
 *
 * Chạy: npx ts-node --require tsconfig-paths/register src/seed-demo-tax.ts
 *
 * Mật khẩu đăng nhập = taxCode (mã số thuế) của từng account
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ── Helpers ─────────────────────────────────────────────────────────────────
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Cấu hình 4 account demo ──────────────────────────────────────────────────
interface DemoAccount {
  taxCode: string;
  businessName: string;
  phone: string;
  address: string;
  businessType: string;
  revenueGoal: number;
  group: number;
  targetAnnualRevenue: number;
  items: PosItemDef[];
  expenseMonthly: number;
}

interface PosItemDef {
  name: string;
  price: number;
  type: 'FOOD' | 'PRODUCT' | 'SERVICE';
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Nhóm 1 – Quán cơm bụi ≤ 1 tỷ/năm → MIỄN THUẾ hoàn toàn
  // ─────────────────────────────────────────────────────────────────────────
  {
    taxCode: 'DEMO001',
    businessName: 'Quán Cơm Bà Năm – Demo Nhóm 1',
    phone: '0901111001',
    address: '12 Ngõ 5 Đường Nguyễn Trãi, Thanh Xuân, Hà Nội',
    businessType: '3',        // Sản xuất, DV gắn hàng hoá (tự chế biến)
    revenueGoal: 66_700_000,  // ~66.7tr/tháng (800tr/năm)
    group: 1,
    targetAnnualRevenue: 800_000_000, // 800 triệu/năm → dưới ngưỡng 1 tỷ (miễn thuế)
    expenseMonthly: 40_000_000,
    items: [
      { name: 'Cơm thịt kho', price: 35_000, type: 'FOOD' },
      { name: 'Cơm gà luộc', price: 40_000, type: 'FOOD' },
      { name: 'Cơm sườn nướng', price: 45_000, type: 'FOOD' },
      { name: 'Canh chua cá', price: 15_000, type: 'FOOD' },
      { name: 'Rau muống xào', price: 10_000, type: 'FOOD' },
      { name: 'Trứng chiên', price: 12_000, type: 'FOOD' },
      { name: 'Nước ngọt lon', price: 15_000, type: 'FOOD' },
      { name: 'Trà đá', price: 5_000, type: 'FOOD' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Nhóm 2 – Tiệm cắt tóc ~2 tỷ/năm → Có thuế GTGT 5% + TNCN 2%
  // ─────────────────────────────────────────────────────────────────────────
  {
    taxCode: 'DEMO002',
    businessName: 'Barber Studio Minh Khoa – Demo Nhóm 2',
    phone: '0902222002',
    address: '85 Đường Hoàng Hoa Thám, Ba Đình, Hà Nội',
    businessType: '2',        // Dịch vụ thuần tuỳ
    revenueGoal: 166_700_000, // ~166.7tr/tháng (2 tỷ/năm)
    group: 2,
    targetAnnualRevenue: 2_000_000_000, // 2 tỷ/năm (Nhóm 2: 1-3 tỷ)
    expenseMonthly: 80_000_000,
    items: [
      { name: 'Cắt tóc nam cơ bản', price: 70_000, type: 'SERVICE' },
      { name: 'Cắt + gội đầu', price: 100_000, type: 'SERVICE' },
      { name: 'Cạo mặt + massage', price: 80_000, type: 'SERVICE' },
      { name: 'Nhuộm tóc', price: 350_000, type: 'SERVICE' },
      { name: 'Uốn / Duỗi tóc', price: 450_000, type: 'SERVICE' },
      { name: 'Gội đầu dưỡng sinh', price: 120_000, type: 'SERVICE' },
      { name: 'Wax lông mày nam', price: 50_000, type: 'SERVICE' },
      { name: 'Dầu gội Loreal 400ml', price: 180_000, type: 'PRODUCT' },
      { name: 'Sáp tạo kiểu tóc', price: 150_000, type: 'PRODUCT' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Nhóm 3 – Tiệm sửa xe có phụ tùng 5 tỷ/năm → Kê lợi nhuận, TNCN 17%
  // ─────────────────────────────────────────────────────────────────────────
  {
    taxCode: 'DEMO003',
    businessName: 'Garage Ô Tô & Xe Máy Tuấn Anh – Demo Nhóm 3',
    phone: '0903333003',
    address: '218 Quốc Lộ 1A, Hoàng Mai, Hà Nội',
    businessType: '3',
    revenueGoal: 416_000_000,
    group: 3,
    targetAnnualRevenue: 5_000_000_000, // 5 tỷ/năm
    expenseMonthly: 280_000_000,
    items: [
      { name: 'Thay nhớt xe máy', price: 120_000, type: 'SERVICE' },
      { name: 'Thay nhớt ô tô', price: 350_000, type: 'SERVICE' },
      { name: 'Vá xe – sửa ruột', price: 50_000, type: 'SERVICE' },
      { name: 'Thay lốp xe máy (công)', price: 80_000, type: 'SERVICE' },
      { name: 'Sửa động cơ – đại tu', price: 2_500_000, type: 'SERVICE' },
      { name: 'Kiểm tra hệ thống điện', price: 300_000, type: 'SERVICE' },
      { name: 'Rửa xe máy', price: 40_000, type: 'SERVICE' },
      { name: 'Rửa xe ô tô', price: 100_000, type: 'SERVICE' },
      { name: 'Lốp xe máy Michelin', price: 650_000, type: 'PRODUCT' },
      { name: 'Nhớt Castrol 10W40 (1L)', price: 130_000, type: 'PRODUCT' },
      { name: 'Nhớt Shell Helix (4L)', price: 480_000, type: 'PRODUCT' },
      { name: 'Nhông sên dĩa xe máy', price: 320_000, type: 'PRODUCT' },
      { name: 'Lọc gió xe máy', price: 85_000, type: 'PRODUCT' },
      { name: 'Bình ắc quy xe máy', price: 450_000, type: 'PRODUCT' },
      { name: 'Bình ắc quy ô tô', price: 1_800_000, type: 'PRODUCT' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Nhóm 4 – Chuỗi nhà hàng 80 tỷ/năm → Kê lợi nhuận, TNCN 20%
  // ─────────────────────────────────────────────────────────────────────────
  {
    taxCode: 'DEMO004',
    businessName: 'Chuỗi Nhà Hàng Phố Biển Sài Gòn – Demo Nhóm 4',
    phone: '0904444004',
    address: '120 Lê Văn Lương, Thanh Xuân, Hà Nội',
    businessType: '3',
    revenueGoal: 6_670_000_000,
    group: 4,
    targetAnnualRevenue: 80_000_000_000, // 80 tỷ/năm
    expenseMonthly: 4_500_000_000,
    items: [
      { name: 'Lẩu hải sản thập cẩm (2 người)', price: 420_000, type: 'FOOD' },
      { name: 'Lẩu bò kobe (2 người)', price: 580_000, type: 'FOOD' },
      { name: 'Gỏi cuốn tôm thịt (8 cuốn)', price: 95_000, type: 'FOOD' },
      { name: 'Cá lóc nướng trui', price: 320_000, type: 'FOOD' },
      { name: 'Tôm hùm hấp (500g)', price: 850_000, type: 'FOOD' },
      { name: 'Ghẹ rang muối (1kg)', price: 480_000, type: 'FOOD' },
      { name: 'Cơm chiên hải sản', price: 120_000, type: 'FOOD' },
      { name: 'Mực nướng sa tế', price: 280_000, type: 'FOOD' },
      { name: 'Ốc hương xào bơ tỏi', price: 220_000, type: 'FOOD' },
      { name: 'Nước ép trái cây tươi', price: 75_000, type: 'FOOD' },
      { name: 'Bia Tiger (két 24 lon)', price: 480_000, type: 'PRODUCT' },
      { name: 'Rượu vang đỏ (chai 750ml)', price: 680_000, type: 'PRODUCT' },
      { name: 'Tiệc buffet hải sản (người lớn)', price: 699_000, type: 'SERVICE' },
      { name: 'Tiệc buffet hải sản (trẻ em)', price: 349_000, type: 'SERVICE' },
      { name: 'Đặt bàn VIP (phòng riêng)', price: 500_000, type: 'SERVICE' },
    ],
  },
];

// ── Sinh hoá đơn cho 1 tháng để đạt doanh thu mục tiêu ──────────────────────
function buildInvoicesForMonth(
  userId: number,
  items: { id: string; name: string; price: number; type: string }[],
  monthStart: Date,
  targetMonthlyRevenue: number
) {
  const invoices: {
    id: string; userId: number; total: number; estimatedTax: number;
    itemsJson: string; paymentMethod: string; status: string; createdAt: Date;
  }[] = [];

  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const methods = ['CASH', 'CASH', 'CASH', 'QR_BANK', 'QR_BANK', 'CARD'];

  let accumulated = 0;
  let safety = 0;
  while (accumulated < targetMonthlyRevenue * 0.95 && safety < 5000) {
    safety++;
    const numItems = randInt(1, 4);
    const invoiceItems: { id: string; name: string; price: number; type: string; quantity: number }[] = [];
    let invoiceTotal = 0;

    for (let i = 0; i < numItems; i++) {
      const item = pick(items);
      const qty = randInt(1, 3);
      invoiceItems.push({ id: item.id, name: item.name, price: item.price, type: item.type, quantity: qty });
      invoiceTotal += item.price * qty;
    }

    invoices.push({
      id: `pi_dm_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      userId,
      total: invoiceTotal,
      estimatedTax: 0,
      itemsJson: JSON.stringify(invoiceItems),
      paymentMethod: pick(methods),
      status: 'PAID',
      createdAt: randDate(monthStart, monthEnd),
    });

    accumulated += invoiceTotal;
  }

  return invoices;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Bắt đầu tạo 4 account DEMO thuế...');
  console.log('══════════════════════════════════════════════════════════════');

  const yearStart  = new Date('2026-01-01T00:00:00+07:00');
  const today      = new Date('2026-07-15T00:00:00+07:00');

  for (const acc of DEMO_ACCOUNTS) {
    console.log(`\n📋 Nhóm ${acc.group}: ${acc.businessName}`);
    console.log(`   Mã đăng nhập: ${acc.taxCode} | Doanh thu năm mục tiêu: ${(acc.targetAnnualRevenue / 1e9).toFixed(2)} tỷ`);

    // 1. Tạo user ──────────────────────────────────────────────────────────
    let user = await prisma.user.findUnique({ where: { taxCode: acc.taxCode } });
    if (user) {
      console.log(`   ⏭  User đã tồn tại (id=${user.id})`);
    } else {
      const hashedPw = await bcrypt.hash(acc.taxCode, 10);
      user = await prisma.user.create({
        data: {
          taxCode:      acc.taxCode,
          businessName: acc.businessName,
          password:     hashedPw,
          phone:        acc.phone,
          address:      acc.address,
          businessType: acc.businessType,
          revenueGoal:  acc.revenueGoal,
          role:         'USER',
          status:       'ACTIVE',
          createdAt:    yearStart,
          lastActiveAt: today,
        },
      });
      console.log(`   ✅ Tạo user id=${user.id}`);
    }

    // 2. Xoá dữ liệu cũ (để chạy lại idempotent) ───────────────────────────
    await prisma.posInvoice.deleteMany({ where: { userId: user.id } });
    await prisma.posItem.deleteMany({ where: { userId: user.id } });
    await prisma.posExpense.deleteMany({ where: { userId: user.id } });

    // 3. Tạo PosItem ───────────────────────────────────────────────────────
    const createdItems: { id: string; name: string; price: number; type: string }[] = [];
    for (const itemDef of acc.items) {
      const item = await prisma.posItem.create({
        data: {
          id:       `item_dm_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          userId:   user.id,
          name:     itemDef.name,
          price:    itemDef.price,
          type:     itemDef.type,
          imageUrl: '',
        },
      });
      createdItems.push({ id: item.id, name: item.name, price: item.price, type: item.type });
    }
    console.log(`   📦 ${createdItems.length} sản phẩm/dịch vụ`);

    // 4. Tạo PosInvoice (6 tháng đầu 2026) ───────────────────────────────
    const monthlyTarget = acc.targetAnnualRevenue / 12;
    let totalInvoices = 0;
    let totalRevenue  = 0;

    for (let m = 0; m < 6; m++) {
      const monthStart = new Date('2026-01-01T00:00:00+07:00');
      monthStart.setMonth(monthStart.getMonth() + m);

      const invoices = buildInvoicesForMonth(user.id, createdItems, monthStart, monthlyTarget);
      if (invoices.length > 0) {
        // Chèn theo batch 500 hoá đơn để tránh quá tải
        for (let i = 0; i < invoices.length; i += 500) {
          await prisma.posInvoice.createMany({ data: invoices.slice(i, i + 500) });
        }
        totalRevenue  += invoices.reduce((s, inv) => s + inv.total, 0);
        totalInvoices += invoices.length;
      }
    }
    console.log(`   🧾 ${totalInvoices} hoá đơn | Doanh thu 6 tháng: ${(totalRevenue / 1e6).toFixed(1)} triệu đồng`);

    // 5. Tạo PosExpense ────────────────────────────────────────────────────
    const EXPENSE_CATEGORIES = [
      { category: 'MATERIAL',  title: 'Nguyên vật liệu / hàng nhập',           ratio: 0.50 },
      { category: 'SALARY',    title: 'Lương nhân viên',                         ratio: 0.25 },
      { category: 'OPERATING', title: 'Thuê mặt bằng + điện nước',              ratio: 0.15 },
      { category: 'OTHER',     title: 'Marketing, vận chuyển, chi phí khác',    ratio: 0.10 },
    ];

    let totalExpenses = 0;
    for (let m = 0; m < 6; m++) {
      const monthStart = new Date('2026-01-01T00:00:00+07:00');
      monthStart.setMonth(monthStart.getMonth() + m);
      const dateStr = monthStart.toISOString().slice(0, 10);

      for (const cat of EXPENSE_CATEGORIES) {
        const amount = Math.round(acc.expenseMonthly * cat.ratio / 10_000) * 10_000;
        await prisma.posExpense.create({
          data: {
            id:       `exp_dm_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
            userId:   user.id,
            title:    cat.title,
            amount,
            category: cat.category,
            date:     dateStr,
          },
        });
        totalExpenses += amount;
      }
    }
    console.log(`   💸 Chi phí 6 tháng: ${(totalExpenses / 1e6).toFixed(1)} triệu đồng`);

    // 6. In tóm tắt thuế ────────────────────────────────────────────────────
    const annualRevenue = totalRevenue * 2; // quy chiếu cả năm (×2 vì mới 6 tháng)
    const annualExpense = totalExpenses * 2;
    console.log(`\n   📊 ƯỚC TÍNH THUẾ CẢ NĂM:`);

    if (acc.group === 1) {
      console.log(`   Doanh thu ≈ ${(annualRevenue / 1e6).toFixed(0)} triệu ≤ 1 tỷ`);
      console.log(`   → MIỄN toàn bộ thuế GTGT & TNCN — Nộp: 0 đồng ✅`);
    } else if (acc.group === 2) {
      // Dịch vụ không bao thầu: GTGT 5%, TNCN 2% trên phần vượt 1 tỷ
      const vat  = annualRevenue * 0.05;
      const tncn = Math.max(0, annualRevenue - 1_000_000_000) * 0.02;
      console.log(`   Doanh thu ≈ ${(annualRevenue / 1e9).toFixed(2)} tỷ (Nhóm 2: 1–3 tỷ)`);
      console.log(`   GTGT = ${(annualRevenue/1e9).toFixed(2)}tỷ × 5% = ${(vat/1e6).toFixed(0)} triệu`);
      console.log(`   TNCN = (${(annualRevenue/1e9).toFixed(2)}tỷ − 1 tỷ) × 2% = ${(tncn/1e6).toFixed(0)} triệu`);
      console.log(`   → Tổng nộp: ${((vat + tncn)/1e6).toFixed(0)} triệu đồng/năm`);
    } else if (acc.group === 3) {
      // SX-DV hàng hoá: GTGT 3%; TNCN = lợi nhuận × 17%
      const vat    = annualRevenue * 0.03;
      const profit = Math.max(0, annualRevenue - annualExpense);
      const tncn   = profit * 0.17;
      console.log(`   Doanh thu ≈ ${(annualRevenue / 1e9).toFixed(2)} tỷ (Nhóm 3: 3–50 tỷ)`);
      console.log(`   GTGT = ${(annualRevenue/1e9).toFixed(2)}tỷ × 3% = ${(vat/1e6).toFixed(0)} triệu`);
      console.log(`   Lợi nhuận = ${(annualRevenue/1e9).toFixed(2)}tỷ − ${(annualExpense/1e9).toFixed(2)}tỷ = ${(profit/1e9).toFixed(2)} tỷ`);
      console.log(`   TNCN = lợi nhuận × 17% = ${(tncn/1e6).toFixed(0)} triệu`);
      console.log(`   → Tổng nộp: ${((vat + tncn)/1e6).toFixed(0)} triệu đồng/năm`);
    } else {
      // Nhóm 4: GTGT 3%; TNCN = lợi nhuận × 20%
      const vat    = annualRevenue * 0.03;
      const profit = Math.max(0, annualRevenue - annualExpense);
      const tncn   = profit * 0.20;
      console.log(`   Doanh thu ≈ ${(annualRevenue / 1e9).toFixed(0)} tỷ (Nhóm 4: > 50 tỷ)`);
      console.log(`   GTGT = ${(annualRevenue/1e9).toFixed(0)}tỷ × 3% = ${(vat/1e9).toFixed(2)} tỷ`);
      console.log(`   Lợi nhuận = ${(annualRevenue/1e9).toFixed(0)}tỷ − ${(annualExpense/1e9).toFixed(0)}tỷ = ${(profit/1e9).toFixed(2)} tỷ`);
      console.log(`   TNCN = lợi nhuận × 20% = ${(tncn/1e9).toFixed(2)} tỷ`);
      console.log(`   → Tổng nộp: ${((vat + tncn)/1e9).toFixed(2)} tỷ đồng/năm`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('✅ HOÀN TẤT! Thông tin đăng nhập 4 account demo:');
  console.log('──────────────────────────────────────────────────────────────');
  console.log('  Nhóm 1 | Quán Cơm Bà Năm           | login: DEMO001 / pw: DEMO001');
  console.log('  Nhóm 2 | Barber Studio Minh Khoa   | login: DEMO002 / pw: DEMO002');
  console.log('  Nhóm 3 | Garage Tuấn Anh            | login: DEMO003 / pw: DEMO003');
  console.log('  Nhóm 4 | Chuỗi Nhà Hàng Phố Biển   | login: DEMO004 / pw: DEMO004');
  console.log('══════════════════════════════════════════════════════════════');
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
