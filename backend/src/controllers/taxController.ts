import { Response } from 'express';
import prisma from '../utils/prisma';

// =====================================================================
// Tính thuế hộ kinh doanh Việt Nam theo Thông tư 40/2021/TT-BTC
// + Tax-rule bổ sung (phân nhóm doanh thu)
//
// NHÓM 1: DT ≤ 500 triệu/năm → Miễn thuế VAT & TNCN
// NHÓM 2: DT 500 triệu → 3 tỷ  → TNCN = (DT - 500tr) × tỷ lệ%
// NHÓM 3: DT 3 tỷ → 50 tỷ      → TNCN = (DT - chi phí) × 17%
// NHÓM 4: DT > 50 tỷ            → TNCN = (DT - chi phí) × 20%
//
// Tỷ lệ VAT theo ngành nghề (không thay đổi theo nhóm DT):
//   1: Thương mại (hàng hóa)               → VAT 1%,  TNCN 0.5%
//   2: Dịch vụ thuần túy (tiệm tóc, sửa xe) → VAT 5%,  TNCN 2%
//   3: Sản xuất/ăn uống/vận tải có hàng hóa → VAT 3%,  TNCN 1.5%
//   4: Hoạt động kinh doanh khác            → VAT 2%,  TNCN 1%
// =====================================================================

const EXEMPT_THRESHOLD = 500_000_000;   // 500 triệu
const GROUP3_THRESHOLD = 3_000_000_000; // 3 tỷ
const GROUP4_THRESHOLD = 50_000_000_000; // 50 tỷ

// Tỷ lệ TNCN theo lợi nhuận cho nhóm 3 & 4
const TNCN_PROFIT_RATE_GROUP3 = 0.17; // 17%
const TNCN_PROFIT_RATE_GROUP4 = 0.20; // 20%

function getBizRates(businessType: string): { vatRate: number; tncnRate: number; bizLabel: string } {
  switch (businessType) {
    case '1':
      return { vatRate: 0.01, tncnRate: 0.005, bizLabel: 'Phân phối, cung cấp hàng hóa (Thương mại)' };
    case '2':
      return { vatRate: 0.05, tncnRate: 0.02, bizLabel: 'Dịch vụ, xây dựng không bao thầu nguyên vật liệu' };
    case '3':
      return { vatRate: 0.03, tncnRate: 0.015, bizLabel: 'Sản xuất, vận tải, dịch vụ có gắn với hàng hóa, xây dựng có bao thầu' };
    case '4':
    default:
      return { vatRate: 0.02, tncnRate: 0.01, bizLabel: 'Hoạt động kinh doanh khác' };
  }
}

export const calculateTax = async (req: any, res: Response) => {
  try {
    const { taxType, revenue, businessType, expenses = 0 } = req.body;

    if (!taxType || revenue === undefined) {
      return res.status(400).json({ error: 'Thiếu thông tin loại thuế hoặc doanh thu để tính toán.' });
    }

    const rev = parseFloat(revenue);
    const exp = parseFloat(expenses);

    let vatRate = 0;
    let tncnRate = 0;
    let taxAmount = 0;
    let details = '';
    let vatAmount = 0;
    let tncnAmount = 0;
    let isExempt = false;
    let revenueGroup = 1; // nhóm doanh thu

    if (taxType === 'VAT' || taxType === 'TNCN' || taxType === 'HKD') {
      const { vatRate: vr, tncnRate: tr, bizLabel } = getBizRates(businessType);
      vatRate = vr;
      tncnRate = tr;

      // ── Xác định nhóm doanh thu ──────────────────────────────────────
      if (rev <= EXEMPT_THRESHOLD) {
        // NHÓM 1: ≤ 500 triệu/năm → Miễn thuế
        revenueGroup = 1;
        isExempt = true;
        vatAmount = 0;
        tncnAmount = 0;
        taxAmount = 0;
        details = `Ngành: ${bizLabel}. Doanh thu ≤ 500.000.000 ₫/năm thuộc diện MIỄN thuế VAT và TNCN theo Thông tư 40/2021/TT-BTC. Kê khai doanh thu 1 lần trước 31/1 năm sau.`;

      } else if (rev <= GROUP3_THRESHOLD) {
        // NHÓM 2: 500 triệu → 3 tỷ
        // VAT = DT × tỷ lệ VAT
        // TNCN = (DT - 500 triệu) × tỷ lệ TNCN
        revenueGroup = 2;
        vatAmount = rev * vatRate;
        const taxableIncomeTNCN = rev - EXEMPT_THRESHOLD;
        tncnAmount = taxableIncomeTNCN * tncnRate;

        details = `Ngành: ${bizLabel}. VAT ${vatRate * 100}%: ${rev.toLocaleString('vi-VN')} ₫ × ${vatRate * 100}% = ${Math.round(vatAmount).toLocaleString('vi-VN')} ₫. TNCN ${tncnRate * 100}%: (${rev.toLocaleString('vi-VN')} ₫ - 500.000.000 ₫) × ${tncnRate * 100}% = ${Math.round(tncnAmount).toLocaleString('vi-VN')} ₫.`;

      } else if (rev <= GROUP4_THRESHOLD) {
        // NHÓM 3: 3 tỷ → 50 tỷ (phương pháp lợi nhuận bắt buộc)
        // VAT = DT × tỷ lệ VAT (trực tiếp)
        // TNCN = (DT - chi phí) × 17%
        revenueGroup = 3;
        vatAmount = rev * vatRate;
        const profitTNCN3 = Math.max(rev - exp, 0);
        tncnAmount = profitTNCN3 * TNCN_PROFIT_RATE_GROUP3;

        details = `Ngành: ${bizLabel}. Doanh thu 3 tỷ–50 tỷ: áp dụng phương pháp kê khai theo lợi nhuận. VAT ${vatRate * 100}%: ${Math.round(vatAmount).toLocaleString('vi-VN')} ₫. TNCN 17% × (DT - Chi phí): ${Math.round(tncnAmount).toLocaleString('vi-VN')} ₫.`;

      } else {
        // NHÓM 4: > 50 tỷ
        // VAT = DT × tỷ lệ VAT (trực tiếp)
        // TNCN = (DT - chi phí) × 20%
        revenueGroup = 4;
        vatAmount = rev * vatRate;
        const profitTNCN4 = Math.max(rev - exp, 0);
        tncnAmount = profitTNCN4 * TNCN_PROFIT_RATE_GROUP4;

        details = `Ngành: ${bizLabel}. Doanh thu > 50 tỷ. VAT ${vatRate * 100}%: ${Math.round(vatAmount).toLocaleString('vi-VN')} ₫. TNCN 20% × (DT - Chi phí): ${Math.round(tncnAmount).toLocaleString('vi-VN')} ₫.`;
      }

      // Tổng hợp theo taxType
      if (taxType === 'VAT') {
        taxAmount = vatAmount;
      } else if (taxType === 'TNCN') {
        taxAmount = tncnAmount;
      } else {
        // HKD = VAT + TNCN
        taxAmount = vatAmount + tncnAmount;
      }

    } else if (taxType === 'TNDN') {
      // Thuế TNDN doanh nghiệp siêu nhỏ: 20% trên thu nhập chịu thuế
      const taxableIncome = rev - exp;
      if (taxableIncome > 0) {
        taxAmount = taxableIncome * 0.20;
        details = 'Thuế Thu nhập Doanh nghiệp (TNDN) siêu nhỏ: Thuế suất 20% trên thu nhập chịu thuế (Doanh thu - Chi phí).';
      } else {
        taxAmount = 0;
        details = 'Thu nhập chịu thuế nhỏ hơn hoặc bằng 0. Không phải nộp thuế TNDN.';
      }

    } else if (taxType === 'MON_BAI') {
      // Lệ phí môn bài hộ kinh doanh theo Nghị định 139/2016/NĐ-CP
      // Bậc 1: DT > 500 triệu → 1.000.000 ₫/năm
      // Bậc 2: DT 300–500 triệu → 500.000 ₫/năm
      // Bậc 3: DT 100–300 triệu → 300.000 ₫/năm
      // Miễn: DT ≤ 100 triệu
      if (rev > 500_000_000) {
        taxAmount = 1_000_000;
        details = 'Lệ phí môn bài bậc 1 (Doanh thu > 500 triệu ₫/năm): 1.000.000 ₫/năm.';
      } else if (rev > 300_000_000) {
        taxAmount = 500_000;
        details = 'Lệ phí môn bài bậc 2 (Doanh thu từ 300–500 triệu ₫/năm): 500.000 ₫/năm.';
      } else if (rev > 100_000_000) {
        taxAmount = 300_000;
        details = 'Lệ phí môn bài bậc 3 (Doanh thu từ 100–300 triệu ₫/năm): 300.000 ₫/năm.';
      } else {
        taxAmount = 0;
        details = 'Doanh thu dưới 100 triệu ₫/năm: Được miễn lệ phí môn bài.';
      }

    } else {
      return res.status(400).json({ error: 'Loại thuế không hợp lệ. Chỉ hỗ trợ VAT, TNCN, TNDN, MON_BAI, HKD.' });
    }

    res.json({
      taxType,
      revenue: rev,
      expenses: exp,
      taxAmount: Math.round(taxAmount),
      revenueGroup,
      rates: {
        vatRate,
        tncnRate,
        tndnRate: taxType === 'TNDN' ? 0.20 : 0
      },
      vatAmount: Math.round(vatAmount),
      tncnAmount: Math.round(tncnAmount),
      isExempt,
      details
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Lỗi tính toán thuế: ' + error.message });
  }
};

export const saveDeclaration = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { taxType, period, revenue, expenses = 0, taxAmount, status = 'DRAFT' } = req.body;

    if (!taxType || !period || revenue === undefined || taxAmount === undefined) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin để lưu tờ khai thuế.' });
    }

    const declaration = await prisma.taxDeclaration.create({
      data: {
        userId,
        taxType,
        period,
        revenue: parseFloat(revenue),
        expenses: parseFloat(expenses),
        taxAmount: parseFloat(taxAmount),
        status
      }
    });

    res.status(201).json({
      message: 'Lưu tờ khai thuế thành công.',
      declaration
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Không thể lưu tờ khai thuế: ' + error.message });
  }
};

export const getDeclarations = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const declarations = await prisma.taxDeclaration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(declarations);
  } catch (error: any) {
    res.status(500).json({ error: 'Lấy danh sách tờ khai thất bại: ' + error.message });
  }
};
