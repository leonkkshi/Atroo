import { Response } from 'express';
import prisma from '../utils/prisma';

// =====================================================================
// Tính thuế hộ kinh doanh Việt Nam theo Nghị định 68/2026/NĐ-CP
//
// NHÓM 1: DT ≤ 500 triệu/năm → Miễn thuế VAT & TNCN
// NHÓM 2: DT 500 triệu → 3 tỷ  → TNCN = (DT vượt 1 tỷ) × tỷ lệ%
//                                  (hoặc (DT - CP) × 15% nếu chọn PP lợi nhuận)
// NHÓM 3: DT 3 tỷ → 50 tỷ      → TNCN = (DT - chi phí) × 17%
// NHÓM 4: DT > 50 tỷ            → TNCN = (DT - chi phí) × 20%
//
// Tỷ lệ VAT/TNCN theo ngành nghề (Nghị định 68/2026):
//   1: Phân phối, cung cấp hàng hóa          → VAT 1%,  TNCN 0.5%
//   2: Dịch vụ không bao thầu NVL (ĂN UỐNG, cắt tóc, sửa xe) → VAT 5%, TNCN 2%
//   3: Sản xuất, vận tải, xây dựng có bao thầu NVL → VAT 3%, TNCN 1.5%
//   4: Hoạt động kinh doanh khác            → VAT 2%,  TNCN 1%
//   5: Cho thuê tài sản (BĐS, máy móc...)   → VAT 5%,  TNCN 5%
//   6: Dịch vụ thông tin số, quảng cáo số   → VAT 5%,  TNCN 5%
// =====================================================================

const EXEMPT_THRESHOLD = 500_000_000;       // 500 triệu — ngưỡng miễn thuế
const TNCN_GROUP2_THRESHOLD = 1_000_000_000; // 1 tỷ — ngưỡng tính TNCN Nhóm 2 (Nghị định 68/2026)
const GROUP3_THRESHOLD = 3_000_000_000;      // 3 tỷ
const GROUP4_THRESHOLD = 50_000_000_000;     // 50 tỷ

// Tỷ lệ TNCN theo lợi nhuận cho nhóm 3 & 4
const TNCN_PROFIT_RATE_GROUP3 = 0.17; // 17%
const TNCN_PROFIT_RATE_GROUP4 = 0.20; // 20%

function getBizRates(businessType: string): { vatRate: number; tncnRate: number; bizLabel: string } {
  switch (businessType) {
    case '1':
      return { vatRate: 0.01, tncnRate: 0.005, bizLabel: 'Phân phối, cung cấp hàng hóa (Bán buôn, bán lẻ)' };
    case '2':
      return { vatRate: 0.05, tncnRate: 0.02, bizLabel: 'Dịch vụ không bao thầu NVL (Ăn uống, cắt tóc, sửa xe...)' };
    case '3':
      return { vatRate: 0.03, tncnRate: 0.015, bizLabel: 'Sản xuất, vận tải, xây dựng có bao thầu nguyên vật liệu' };
    case '5':
      return { vatRate: 0.05, tncnRate: 0.05, bizLabel: 'Cho thuê tài sản (Bất động sản, máy móc, thiết bị...)' };
    case '6':
      return { vatRate: 0.05, tncnRate: 0.05, bizLabel: 'Dịch vụ thông tin số, quảng cáo số' };
    case '4':
    default:
      return { vatRate: 0.02, tncnRate: 0.01, bizLabel: 'Hoạt động kinh doanh khác' };
  }
}

export const calculateTax = async (req: any, res: Response) => {
  try {
    const { taxType, revenue, businessType, expenses = 0, partsRevenue = 0, methodGroup2 = 'DIRECT' } = req.body;

    if (!taxType || revenue === undefined) {
      return res.status(400).json({ error: 'Thiếu thông tin loại thuế hoặc doanh thu để tính toán.' });
    }

    const rev = parseFloat(revenue);
    const exp = parseFloat(expenses);
    const partsRev = parseFloat(partsRevenue) || 0;

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
        details = `Ngành: ${bizLabel}. Doanh thu ≤ 500.000.000 ₫/năm thuộc diện MIỄN thuế GTGT và TNCN theo Nghị định 68/2026/NĐ-CP. Vẫn phải nộp Tờ khai thuế theo quy định.`;

      } else if (rev <= GROUP3_THRESHOLD) {
        // NHÓM 2: 500 triệu → 3 tỷ
        revenueGroup = 2;
        const serviceRev = Math.max(rev - partsRev, 0);
        vatAmount = serviceRev * vatRate + partsRev * 0.01;

        if (methodGroup2 === 'PROFIT') {
          // B. Phương pháp theo lợi nhuận (nếu chọn)
          tncnAmount = Math.max(rev - exp, 0) * 0.15;
          details = `Ngành: ${bizLabel}${partsRev > 0 ? ` & Phụ tùng` : ''}. Nhóm 2 (500tr–3 tỷ) kê khai theo lợi nhuận: VAT trực tiếp: ${Math.round(vatAmount).toLocaleString('vi-VN')} ₫. TNCN 15% × (DT - Chi phí): ${Math.round(tncnAmount).toLocaleString('vi-VN')} ₫.`;
        } else {
          // A. Phương pháp trực tiếp trên doanh thu (Nghị định 68/2026: TNCN trên phần vượt 1 tỷ)
          const weightedTncnRate = (serviceRev * tncnRate + partsRev * 0.005) / rev;
          const taxableIncomeTNCN = Math.max(rev - TNCN_GROUP2_THRESHOLD, 0); // vượt 1 tỷ
          tncnAmount = taxableIncomeTNCN * weightedTncnRate;

          if (partsRev > 0) {
            details = `Ngành: ${bizLabel} (DT: ${serviceRev.toLocaleString('vi-VN')} ₫) & Phụ tùng (DT: ${partsRev.toLocaleString('vi-VN')} ₫). VAT: ${Math.round(vatAmount).toLocaleString('vi-VN')} ₫. TNCN trên phần vượt 1 tỷ (tỷ lệ TB ${(weightedTncnRate * 100).toFixed(2)}%): (${rev.toLocaleString('vi-VN')} ₫ - 1.000.000.000 ₫) × ${(weightedTncnRate * 100).toFixed(2)}% = ${Math.round(tncnAmount).toLocaleString('vi-VN')} ₫.`;
          } else {
            const tncnNote = taxableIncomeTNCN > 0
              ? `TNCN ${tncnRate * 100}%: (${rev.toLocaleString('vi-VN')} ₫ - 1.000.000.000 ₫) × ${tncnRate * 100}% = ${Math.round(tncnAmount).toLocaleString('vi-VN')} ₫.`
              : `TNCN: Miễn (DT chưa vượt ngưỡng 1.000.000.000 ₫).`;
            details = `Ngành: ${bizLabel}. VAT ${vatRate * 100}%: ${rev.toLocaleString('vi-VN')} ₫ × ${vatRate * 100}% = ${Math.round(vatAmount).toLocaleString('vi-VN')} ₫. ${tncnNote}`;
          }
        }

      } else if (rev <= GROUP4_THRESHOLD) {
        // NHÓM 3: 3 tỷ → 50 tỷ (phương pháp lợi nhuận bắt buộc)
        revenueGroup = 3;
        const serviceRev = Math.max(rev - partsRev, 0);
        vatAmount = serviceRev * vatRate + partsRev * 0.01;
        const profitTNCN3 = Math.max(rev - exp, 0);
        tncnAmount = profitTNCN3 * TNCN_PROFIT_RATE_GROUP3;

        details = `Ngành: ${bizLabel}${partsRev > 0 ? ` & Phụ tùng` : ''}. Doanh thu 3 tỷ–50 tỷ: áp dụng phương pháp kê khai theo lợi nhuận. VAT trực tiếp: ${Math.round(vatAmount).toLocaleString('vi-VN')} ₫. TNCN 17% × (DT - Chi phí): ${Math.round(tncnAmount).toLocaleString('vi-VN')} ₫.`;

      } else {
        // NHÓM 4: > 50 tỷ
        revenueGroup = 4;
        const serviceRev = Math.max(rev - partsRev, 0);
        vatAmount = serviceRev * vatRate + partsRev * 0.01;
        const profitTNCN4 = Math.max(rev - exp, 0);
        tncnAmount = profitTNCN4 * TNCN_PROFIT_RATE_GROUP4;

        details = `Ngành: ${bizLabel}${partsRev > 0 ? ` & Phụ tùng` : ''}. Doanh thu > 50 tỷ: áp dụng phương pháp kê khai theo lợi nhuận. VAT trực tiếp: ${Math.round(vatAmount).toLocaleString('vi-VN')} ₫. TNCN 20% × (DT - Chi phí): ${Math.round(tncnAmount).toLocaleString('vi-VN')} ₫.`;
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
