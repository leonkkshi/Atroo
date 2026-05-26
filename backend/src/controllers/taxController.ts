import { Response } from 'express';
import prisma from '../utils/prisma';

// Định nghĩa công thức tính thuế cho hộ kinh doanh Việt Nam
// Theo Thông tư 40/2021/TT-BTC
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

    if (taxType === 'VAT' || taxType === 'TNCN' || taxType === 'HKD') {
      // Xác định tỷ lệ thuế theo ngành nghề (Thông tư 40)
      // 1: Phân phối, cung cấp hàng hóa (Thương mại)
      // 2: Dịch vụ, xây dựng không bao thầu nguyên vật liệu
      // 3: Sản xuất, vận tải, dịch vụ có gắn với hàng hóa, xây dựng có bao thầu
      // 4: Hoạt động kinh doanh khác
      switch (businessType) {
        case '1': // Thương mại
          vatRate = 0.01; // 1%
          tncnRate = 0.005; // 0.5%
          details = 'Ngành Phân phối, cung cấp hàng hóa (Thương mại): Tỷ lệ VAT 1%, TNCN 0.5%.';
          break;
        case '2': // Dịch vụ
          vatRate = 0.05; // 5%
          tncnRate = 0.02; // 2%
          details = 'Ngành Dịch vụ, xây dựng không bao thầu nguyên vật liệu: Tỷ lệ VAT 5%, TNCN 2%.';
          break;
        case '3': // Sản xuất, vận tải
          vatRate = 0.03; // 3%
          tncnRate = 0.015; // 1.5%
          details = 'Ngành Sản xuất, vận tải, dịch vụ kèm hàng hóa, xây dựng có bao thầu: Tỷ lệ VAT 3%, TNCN 1.5%.';
          break;
        case '4':
        default: // Khác
          vatRate = 0.02; // 2%
          tncnRate = 0.01; // 1%
          details = 'Ngành hoạt động kinh doanh khác: Tỷ lệ VAT 2%, TNCN 1%.';
          break;
      }

      // Kiểm tra miễn thuế (Doanh thu năm từ 100 triệu trở xuống)
      if (rev <= 100000000) {
        isExempt = true;
        vatAmount = 0;
        tncnAmount = 0;
        taxAmount = 0;
        details += ' Doanh thu từ 100 triệu ₫/năm trở xuống thuộc diện được miễn thuế VAT & TNCN.';
      } else {
        vatAmount = rev * vatRate;
        tncnAmount = rev * tncnRate;
        
        if (taxType === 'VAT') {
          taxAmount = vatAmount;
        } else if (taxType === 'TNCN') {
          taxAmount = tncnAmount;
        } else {
          taxAmount = vatAmount + tncnAmount;
          details += ` Tính GTGT: ${rev.toLocaleString('vi-VN')} ₫ × ${vatRate * 100}% = ${Math.round(vatAmount).toLocaleString('vi-VN')} ₫. Tính TNCN: ${rev.toLocaleString('vi-VN')} ₫ × ${tncnRate * 100}% = ${Math.round(tncnAmount).toLocaleString('vi-VN')} ₫.`;
        }
      }
    } else if (taxType === 'TNDN') {
      // Đối với Doanh nghiệp siêu nhỏ áp dụng thuế suất TNDN 20% trên thu nhập tính thuế
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
      if (rev > 500000000) {
        taxAmount = 1000000;
        details = 'Mức lệ phí môn bài bậc 1 (Doanh thu > 500 triệu ₫/năm): 1.000.000 ₫/năm.';
      } else if (rev > 300000000) {
        taxAmount = 500000;
        details = 'Mức lệ phí môn bài bậc 2 (Doanh thu từ 300 đến 500 triệu ₫/năm): 500.000 ₫/năm.';
      } else if (rev > 100000000) {
        taxAmount = 300000;
        details = 'Mức lệ phí môn bài bậc 3 (Doanh thu từ 100 đến 300 triệu ₫/năm): 300.000 ₫/năm.';
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
