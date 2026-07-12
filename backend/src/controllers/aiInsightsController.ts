import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';
import {
  suggestPrices,
  forecastRevenue,
  reviewTaxDeclaration,
  SalesItemSummary,
  MonthlyRevenueSummary,
  TaxDeclarationInput,
} from '../utils/aiService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tính [start, end] UTC cho một tháng */
function monthRange(year: number, month: number): [Date, Date] {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end   = new Date(Date.UTC(year, month,     0, 23, 59, 59, 999));
  start.setUTCHours(start.getUTCHours() - 7);
  end.setUTCHours(end.getUTCHours() - 7 + 24);
  return [start, end];
}

function getBizRates(businessType: string): { vatRate: number; tncnRate: number; bizLabel: string } {
  switch (businessType) {
    case '1': return { vatRate: 0.01, tncnRate: 0.005, bizLabel: 'Phân phối, cung cấp hàng hóa' };
    case '2': return { vatRate: 0.05, tncnRate: 0.02,  bizLabel: 'Dịch vụ không bao thầu NVL (Ăn uống, cắt tóc, sửa xe...)' };
    case '3': return { vatRate: 0.03, tncnRate: 0.015, bizLabel: 'Sản xuất, vận tải, xây dựng có bao thầu NVL' };
    case '5': return { vatRate: 0.05, tncnRate: 0.05,  bizLabel: 'Cho thuê tài sản' };
    case '6': return { vatRate: 0.05, tncnRate: 0.05,  bizLabel: 'Dịch vụ thông tin số, quảng cáo số' };
    case '4':
    default:  return { vatRate: 0.02, tncnRate: 0.01,  bizLabel: 'Hoạt động kinh doanh khác' };
  }
}

// ─── POST /ai/price-suggestions ──────────────────────────────────────────────
/**
 * Phân tích dữ liệu POS 3 tháng gần nhất → gợi ý giá bán tối ưu.
 * Body: { itemIds?: string[] }
 */
export const priceSuggestions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { itemIds } = req.body as { itemIds?: string[] };

    // 1. Lấy danh mục sản phẩm của user
    const itemsWhere = itemIds?.length
      ? { userId, id: { in: itemIds } }
      : { userId };

    const posItems = await prisma.posItem.findMany({ where: itemsWhere });
    if (!posItems.length) {
      return res.json({ suggestions: [] });
    }

    // 2. Lấy hóa đơn 3 tháng gần nhất
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const invoices = await prisma.posInvoice.findMany({
      where: { userId, status: 'PAID', createdAt: { gte: threeMonthsAgo } },
      select: { itemsJson: true },
    });

    // 3. Aggregate sales data per item
    const salesMap = new Map<string, { unitsSold: number; totalRevenue: number }>();
    for (const inv of invoices) {
      let items: Array<{ id: string; price: number; quantity: number }> = [];
      try { items = JSON.parse(inv.itemsJson); } catch { continue; }
      for (const item of items) {
        const existing = salesMap.get(item.id);
        if (existing) {
          existing.unitsSold  += item.quantity;
          existing.totalRevenue += item.price * item.quantity;
        } else {
          salesMap.set(item.id, { unitsSold: item.quantity, totalRevenue: item.price * item.quantity });
        }
      }
    }

    const summaries: SalesItemSummary[] = posItems.map(it => ({
      itemId: it.id,
      name: it.name,
      type: it.type,
      currentPrice: it.price,
      unitsSold: salesMap.get(it.id)?.unitsSold   ?? 0,
      totalRevenue: salesMap.get(it.id)?.totalRevenue ?? 0,
    }));

    // 4. Gọi AI service
    const suggestions = await suggestPrices(summaries);

    res.json({ suggestions, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[aiInsights] priceSuggestions error:', err);
    res.status(500).json({ error: 'Không thể tạo gợi ý giá: ' + err.message });
  }
};

// ─── POST /ai/revenue-forecast ───────────────────────────────────────────────
/**
 * Dự báo doanh thu tháng tới dựa trên lịch sử 6 tháng.
 * Body: { months?: number }
 */
export const revenueForecast = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // 1. Lấy dữ liệu 6 tháng gần nhất
    const now     = new Date();
    const vnNow   = new Date(now.getTime() + 7 * 3600 * 1000);
    const curYear = vnNow.getUTCFullYear();
    const curMonth = vnNow.getUTCMonth() + 1;

    const history: MonthlyRevenueSummary[] = [];

    for (let i = 5; i >= 0; i--) {
      let m = curMonth - i;
      let y = curYear;
      if (m <= 0) { m += 12; y -= 1; }

      const [start, end] = monthRange(y, m);
      const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
      const endStr   = end.toISOString().slice(0, 10);

      const [invoices, expenses] = await Promise.all([
        prisma.posInvoice.findMany({
          where: { userId, status: 'PAID', createdAt: { gte: start, lte: end } },
          select: { total: true },
        }),
        prisma.posExpense.findMany({
          where: { userId, date: { gte: startStr, lte: endStr } },
          select: { amount: true },
        }),
      ]);

      const revenue  = invoices.reduce((s, inv) => s + inv.total, 0);
      const expTotal = expenses.reduce((s, e)   => s + e.amount, 0);

      history.push({
        label: `T${m}/${y}`,
        revenue,
        expenses: expTotal,
        txCount: invoices.length,
      });
    }

    // 2. Gọi AI service
    const forecast = await forecastRevenue(history);

    res.json({ forecast, history, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[aiInsights] revenueForecast error:', err);
    res.status(500).json({ error: 'Không thể dự báo doanh thu: ' + err.message });
  }
};

// ─── POST /ai/auto-declaration ────────────────────────────────────────────────
/**
 * Đọc dữ liệu POS → tính thuế → AI review → lưu TaxDeclaration DRAFT.
 * Body: { period: string, saveAsDraft?: boolean }
 */
export const autoDeclaration = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { period, saveAsDraft = false } = req.body as { period: string; saveAsDraft?: boolean };

    if (!period) {
      return res.status(400).json({ error: 'Vui lòng cung cấp kỳ khai thuế (period).' });
    }

    // 1. Parse period → date range
    const { start, end } = parsePeriod(period);
    if (!start || !end) {
      return res.status(400).json({ error: 'Kỳ khai thuế không hợp lệ. VD: "Tháng 07/2026" hoặc "Quý 2/2026"' });
    }

    const startStr = start.toISOString().slice(0, 10);
    const endStr   = end.toISOString().slice(0, 10);

    // 2. Fetch user profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { businessType: true },
    });
    const businessType = user?.businessType ?? '4';

    // 3. Aggregate revenue & expenses
    const [invoices, expenses] = await Promise.all([
      prisma.posInvoice.findMany({
        where: { userId, status: 'PAID', createdAt: { gte: start, lte: end } },
        select: { total: true, estimatedTax: true },
      }),
      prisma.posExpense.findMany({
        where: { userId, date: { gte: startStr, lte: endStr } },
        select: { amount: true },
      }),
    ]);

    const revenue  = invoices.reduce((s, inv) => s + inv.total, 0);
    const expenses_ = expenses.reduce((s, e) => s + e.amount, 0);

    // 4. Tính thuế (logic từ taxController)
    const EXEMPT_THRESHOLD        = 500_000_000;
    const TNCN_GROUP2_THRESHOLD   = 1_000_000_000;
    const GROUP3_THRESHOLD        = 3_000_000_000;
    const GROUP4_THRESHOLD        = 50_000_000_000;

    const { vatRate, tncnRate, bizLabel } = getBizRates(businessType);

    let vatAmount   = 0;
    let tncnAmount  = 0;
    let isExempt    = false;
    let revenueGroup = 1;

    if (revenue <= EXEMPT_THRESHOLD) {
      isExempt = true;
      revenueGroup = 1;
    } else if (revenue <= GROUP3_THRESHOLD) {
      revenueGroup = 2;
      vatAmount  = revenue * vatRate;
      const taxableIncomeTNCN = Math.max(revenue - TNCN_GROUP2_THRESHOLD, 0);
      tncnAmount = taxableIncomeTNCN * tncnRate;
    } else if (revenue <= GROUP4_THRESHOLD) {
      revenueGroup = 3;
      vatAmount  = revenue * vatRate;
      tncnAmount = Math.max(revenue - expenses_, 0) * 0.17;
    } else {
      revenueGroup = 4;
      vatAmount  = revenue * vatRate;
      tncnAmount = Math.max(revenue - expenses_, 0) * 0.20;
    }

    const totalTax = Math.round(vatAmount + tncnAmount);

    const declarationInput: TaxDeclarationInput = {
      period,
      revenue: Math.round(revenue),
      expenses: Math.round(expenses_),
      businessType,
      bizLabel,
      vatRate,
      tncnRate,
      vatAmount: Math.round(vatAmount),
      tncnAmount: Math.round(tncnAmount),
      totalTax,
      isExempt,
      revenueGroup,
    };

    // 5. AI review
    const aiResult = await reviewTaxDeclaration(declarationInput);

    // 6. Optionally save as DRAFT
    let savedDeclaration = null;
    if (saveAsDraft) {
      savedDeclaration = await prisma.taxDeclaration.create({
        data: {
          userId,
          taxType: 'HKD',
          period,
          revenue: declarationInput.revenue,
          expenses: declarationInput.expenses,
          taxAmount: totalTax,
          status: 'DRAFT',
        },
      });
    }

    res.json({
      ...aiResult,
      savedDeclaration,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[aiInsights] autoDeclaration error:', err);
    res.status(500).json({ error: 'Không thể tạo tờ khai tự động: ' + err.message });
  }
};

// ─── Helper: parse period string → date range ────────────────────────────────
function parsePeriod(period: string): { start: Date | null; end: Date | null } {
  // "Tháng 07/2026"
  const monthMatch = period.match(/Tháng\s+(\d{1,2})\/(\d{4})/i);
  if (monthMatch) {
    const m = parseInt(monthMatch[1]);
    const y = parseInt(monthMatch[2]);
    const [start, end] = monthRange(y, m);
    return { start, end };
  }

  // "Quý 2/2026"
  const quarterMatch = period.match(/Quý\s+(\d)\/(\d{4})/i);
  if (quarterMatch) {
    const q = parseInt(quarterMatch[1]);
    const y = parseInt(quarterMatch[2]);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth   = startMonth + 2;
    const [start]    = monthRange(y, startMonth);
    const [, end]    = monthRange(y, endMonth);
    return { start, end };
  }

  // "Năm 2026"
  const yearMatch = period.match(/Năm\s+(\d{4})/i);
  if (yearMatch) {
    const y = parseInt(yearMatch[1]);
    const [start] = monthRange(y, 1);
    const [, end] = monthRange(y, 12);
    return { start, end };
  }

  return { start: null, end: null };
}
