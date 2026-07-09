import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import prisma from '../utils/prisma';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Trả về [start, end] UTC của một tháng (month: 1–12) */
function monthRange(year: number, month: number): [Date, Date] {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end   = new Date(Date.UTC(year, month,     0, 23, 59, 59, 999));
  // Điều chỉnh về UTC+7 (lùi 7h để DB UTC cover đúng ngày VN)
  start.setUTCHours(start.getUTCHours() - 7);
  end.setUTCHours(end.getUTCHours() - 7 + 24);
  return [start, end];
}

/** Trả về [start, end] UTC của một quý (quarter: 1–4) */
function quarterRange(year: number, quarter: number): [Date, Date] {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth   = startMonth + 2;
  const [start]    = monthRange(year, startMonth);
  const [, end]    = monthRange(year, endMonth);
  return [start, end];
}

/** Trả về [start, end] UTC của cả năm */
function yearRange(year: number): [Date, Date] {
  const [start] = monthRange(year, 1);
  const [, end] = monthRange(year, 12);
  return [start, end];
}

/** Previous period ranges */
function prevMonthRange(year: number, month: number): [Date, Date] {
  return month === 1 ? monthRange(year - 1, 12) : monthRange(year, month - 1);
}
function prevQuarterRange(year: number, quarter: number): [Date, Date] {
  return quarter === 1 ? quarterRange(year - 1, 4) : quarterRange(year, quarter - 1);
}
function prevYearRange(year: number): [Date, Date] {
  return yearRange(year - 1);
}

interface InvoiceRow {
  total: number;
  estimatedTax: number;
  itemsJson: string;
  createdAt: Date;
}
interface ExpenseRow {
  amount: number;
  date: string;
}

function calcRevenue(invoices: InvoiceRow[]) {
  return invoices.reduce((s, inv) => s + inv.total, 0);
}
function calcTax(invoices: InvoiceRow[]) {
  return invoices.reduce((s, inv) => s + (inv.estimatedTax || 0), 0);
}
function calcExpenses(expenses: ExpenseRow[]) {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

/** Top products — aggregate across all invoices */
function buildTopProducts(invoices: InvoiceRow[]) {
  const map = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const inv of invoices) {
    let items: Array<{ name: string; price: number; quantity: number }> = [];
    try { items = JSON.parse(inv.itemsJson); } catch { continue; }
    for (const item of items) {
      const key = item.name;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue  += item.price * item.quantity;
      } else {
        map.set(key, { name: key, quantity: item.quantity, revenue: item.price * item.quantity });
      }
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
}

/**
 * Heatmap: ma trận [dayOfWeek 0=T2..6=CN][hour 0..23] tổng doanh thu
 * Chuyển đổi sang giờ VN (UTC+7) trước khi phân loại
 */
function buildHeatmap(invoices: InvoiceRow[]): number[][] {
  // 7 ngày × 24 giờ
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const inv of invoices) {
    const vnDate = new Date(inv.createdAt.getTime() + 7 * 3600 * 1000);
    // getUTCDay(): 0=CN → chuyển sang 0=T2..6=CN
    const rawDay = vnDate.getUTCDay();          // 0=Sun
    const dayIdx = rawDay === 0 ? 6 : rawDay - 1; // 0=Mon..6=Sun
    const hour   = vnDate.getUTCHours();
    matrix[dayIdx][hour] += inv.total;
  }
  return matrix;
}

/** Sub-periods cho biểu đồ trend (mảng { label, revenue, expenses, profit }) */
function buildSubPeriods(
  invoices: InvoiceRow[],
  expenses: ExpenseRow[],
  type: string,
  year: number,
  value: number,
) {
  if (type === 'year') {
    // 12 tháng trong năm
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const [start, end] = monthRange(year, m);
      const inv  = invoices.filter(x => x.createdAt >= start && x.createdAt <= end);
      const exp  = expenses.filter(x => {
        const d = new Date(x.date);
        return d >= start && d <= end;
      });
      const rev  = calcRevenue(inv);
      const tax  = calcTax(inv);
      const cost = calcExpenses(exp);
      return {
        label: `T${m}`,
        revenue: rev,
        expenses: cost,
        profit: rev - tax - cost,
      };
    });
  }

  if (type === 'quarter') {
    // 3 tháng trong quý
    const startMonth = (value - 1) * 3 + 1;
    return Array.from({ length: 3 }, (_, i) => {
      const m = startMonth + i;
      const [start, end] = monthRange(year, m);
      const inv  = invoices.filter(x => x.createdAt >= start && x.createdAt <= end);
      const exp  = expenses.filter(x => {
        const d = new Date(x.date);
        return d >= start && d <= end;
      });
      const rev  = calcRevenue(inv);
      const tax  = calcTax(inv);
      const cost = calcExpenses(exp);
      return {
        label: `T${m}`,
        revenue: rev,
        expenses: cost,
        profit: rev - tax - cost,
      };
    });
  }

  // month → 4 tuần
  const [pStart] = monthRange(year, value);
  return Array.from({ length: 4 }, (_, i) => {
    const wStart = new Date(pStart.getTime() + i * 7 * 86400000);
    const wEnd   = new Date(pStart.getTime() + (i + 1) * 7 * 86400000 - 1);
    const inv  = invoices.filter(x => x.createdAt >= wStart && x.createdAt <= wEnd);
    const exp  = expenses.filter(x => {
      const d = new Date(x.date);
      return d >= wStart && d <= wEnd;
    });
    const rev  = calcRevenue(inv);
    const tax  = calcTax(inv);
    const cost = calcExpenses(exp);
    return {
      label: `Tuần ${i + 1}`,
      revenue: rev,
      expenses: cost,
      profit: rev - tax - cost,
    };
  });
}

// ─── GET /pos/report ─────────────────────────────────────────────────────────
export const getReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Parse params
    const type  = (req.query.type  as string) || 'month';  // month | quarter | year
    const value = parseInt((req.query.value as string) || '0', 10); // month 1–12, quarter 1–4, year e.g. 2026
    const yearQ = parseInt((req.query.year  as string) || '0', 10);

    const now   = new Date();
    const vnNow = new Date(now.getTime() + 7 * 3600 * 1000);
    const curYear  = vnNow.getUTCFullYear();
    const curMonth = vnNow.getUTCMonth() + 1;
    const curQuarter = Math.ceil(curMonth / 3);

    let year: number;
    let periodValue: number;
    let [start, end]: [Date, Date] = [new Date(0), new Date()];
    let [prevStart, prevEnd]: [Date, Date] = [new Date(0), new Date()];

    if (type === 'year') {
      year = value || curYear;
      periodValue = year;
      [start, end]       = yearRange(year);
      [prevStart, prevEnd] = prevYearRange(year);
    } else if (type === 'quarter') {
      year = yearQ || curYear;
      periodValue = value || curQuarter;
      [start, end]       = quarterRange(year, periodValue);
      [prevStart, prevEnd] = prevQuarterRange(year, periodValue);
    } else {
      // month
      year = yearQ || curYear;
      periodValue = value || curMonth;
      [start, end]       = monthRange(year, periodValue);
      [prevStart, prevEnd] = prevMonthRange(year, periodValue);
    }

    // ── Fetch current period ──────────────────────────────────────────────
    const [invoices, expenses, prevInvoices, prevExpenses] = await Promise.all([
      prisma.posInvoice.findMany({
        where: { userId, status: 'PAID', createdAt: { gte: start, lte: end } },
        select: { total: true, estimatedTax: true, itemsJson: true, createdAt: true, paymentMethod: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.posExpense.findMany({
        where: { userId },
        select: { amount: true, date: true },
      }),
      prisma.posInvoice.findMany({
        where: { userId, status: 'PAID', createdAt: { gte: prevStart, lte: prevEnd } },
        select: { total: true, estimatedTax: true, itemsJson: true, createdAt: true, paymentMethod: true },
      }),
      prisma.posExpense.findMany({
        where: { userId },
        select: { amount: true, date: true },
      }),
    ]);

    // ── Filter expenses JS-side by date range ────────────────────────────
    const startStr = start.toISOString().slice(0, 10);
    const endStr   = end.toISOString().slice(0, 10);
    const filteredExpenses     = expenses.filter(e => e.date >= startStr && e.date <= endStr);
    const prevStartStr = prevStart.toISOString().slice(0, 10);
    const prevEndStr   = prevEnd.toISOString().slice(0, 10);
    const filteredPrevExpenses = prevExpenses.filter(e => e.date >= prevStartStr && e.date <= prevEndStr);

    // ── Current period metrics ────────────────────────────────────────────
    const revenue  = calcRevenue(invoices);
    const taxTotal = calcTax(invoices);
    const totalExp = calcExpenses(filteredExpenses);
    const profit   = revenue - taxTotal - totalExp;
    const txCount  = invoices.length;

    // ── Previous period metrics ───────────────────────────────────────────
    const prevRevenue  = calcRevenue(prevInvoices);
    const prevTax      = calcTax(prevInvoices);
    const prevTotalExp = calcExpenses(filteredPrevExpenses);
    const prevProfit   = prevRevenue - prevTax - prevTotalExp;

    // ── Top products ─────────────────────────────────────────────────────
    const topProducts = buildTopProducts(invoices);

    // ── Hourly heatmap ───────────────────────────────────────────────────
    const hourlyHeatmap = buildHeatmap(invoices);

    // ── Sub-periods for trend chart ───────────────────────────────────────
    const subPeriods = buildSubPeriods(invoices, filteredExpenses, type, year, periodValue);

    // ── Payment breakdown ─────────────────────────────────────────────────
    const invWithPm = invoices as Array<InvoiceRow & { paymentMethod: string }>;
    const paymentBreakdown = {
      cash:   invWithPm.filter(i => i.paymentMethod === 'CASH').reduce((s, i) => s + i.total, 0),
      qr:     invWithPm.filter(i => i.paymentMethod === 'QR_BANK').reduce((s, i) => s + i.total, 0),
      card:   invWithPm.filter(i => i.paymentMethod === 'CARD').reduce((s, i) => s + i.total, 0),
    };

    res.json({
      period: { type, year, value: periodValue },
      revenue,
      taxTotal,
      expenses: totalExp,
      profit,
      txCount,
      prevRevenue,
      prevExpenses: prevTotalExp,
      prevProfit,
      topProducts,
      hourlyHeatmap,
      subPeriods,
      paymentBreakdown,
    });
  } catch (err) {
    console.error('[Report] getReport error:', err);
    res.status(500).json({ error: 'Không thể tạo báo cáo.' });
  }
};
