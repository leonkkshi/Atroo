import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getAiModel() {
  if (!API_KEY) return null;
  const ai = new GoogleGenerativeAI(API_KEY);
  return ai.getGenerativeModel({ model: GEMINI_MODEL });
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SalesItemSummary {
  itemId: string;
  name: string;
  type: string; // FOOD | PRODUCT | SERVICE
  currentPrice: number;
  unitsSold: number;   // tổng số lượng bán trong 3 tháng
  totalRevenue: number;
}

export interface PriceSuggestion {
  itemId: string;
  name: string;
  currentPrice: number;
  suggestedPrice: number;
  changePercent: number;
  direction: 'UP' | 'DOWN' | 'KEEP';
  reason: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MonthlyRevenueSummary {
  label: string; // "T1", "T2", ...
  revenue: number;
  expenses: number;
  txCount: number;
}

export interface RevenueForecast {
  forecastMonth: string;
  predicted: number;
  low: number;
  high: number;
  growthRate: number; // % so kỳ trước
  trend: 'UP' | 'DOWN' | 'STABLE';
  advice: string;
}

export interface TaxDeclarationInput {
  period: string;
  revenue: number;
  expenses: number;
  businessType: string;
  bizLabel: string;
  vatRate: number;
  tncnRate: number;
  vatAmount: number;
  tncnAmount: number;
  totalTax: number;
  isExempt: boolean;
  revenueGroup: number;
}

export interface AutoDeclarationResult {
  declaration: TaxDeclarationInput;
  aiComments: string[];
  warnings: string[];
}

// ─── 1. Gợi ý giá bán ────────────────────────────────────────────────────────

/**
 * Phân tích dữ liệu bán hàng và đề xuất giá tối ưu cho từng sản phẩm/dịch vụ.
 * Ưu tiên gọi Gemini API → fallback sang heuristic cục bộ nếu lỗi.
 */
export async function suggestPrices(items: SalesItemSummary[]): Promise<PriceSuggestion[]> {
  if (!items.length) return [];

  try {
    const model = getAiModel();
    if (!model) throw new Error('No API key');

    const summary = items.map(i => ({
      id: i.itemId,
      name: i.name,
      type: i.type,
      price: i.currentPrice,
      sold: i.unitsSold,
      revenue: i.totalRevenue,
    }));

    const prompt = `Bạn là chuyên gia tư vấn giá bán cho các hộ kinh doanh nhỏ tại Việt Nam (quán ăn, tiệm tóc, tiệm sửa xe).

Dữ liệu bán hàng 3 tháng gần nhất:
${JSON.stringify(summary, null, 2)}

Phân tích và gợi ý giá bán tối ưu. Quy tắc:
- Nếu sản phẩm bán chạy (sold cao), có thể tăng nhẹ 5-15% để tối ưu lợi nhuận
- Nếu sản phẩm ít bán (sold thấp hoặc 0), xem xét giảm giá để kích cầu
- Giữ nguyên nếu giá đã hợp lý
- Lý do phải ngắn gọn, thực tế (tối đa 80 ký tự)
- Giá đề xuất phải là số nguyên, bội số của 1000

Trả về CHÍNH XÁC JSON theo format sau (không có text khác):
{
  "suggestions": [
    {
      "itemId": "string",
      "suggestedPrice": number,
      "reason": "string"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON response');
    const parsed = JSON.parse(jsonMatch[0]);

    return parsed.suggestions.map((s: { itemId: string; suggestedPrice: number; reason: string }) => {
      const item = items.find(i => i.itemId === s.itemId);
      if (!item) return null;
      const diff = s.suggestedPrice - item.currentPrice;
      const pct = item.currentPrice > 0 ? (diff / item.currentPrice) * 100 : 0;
      return {
        itemId: s.itemId,
        name: item.name,
        currentPrice: item.currentPrice,
        suggestedPrice: Math.round(s.suggestedPrice / 1000) * 1000,
        changePercent: Math.round(pct * 10) / 10,
        direction: diff > 500 ? 'UP' : diff < -500 ? 'DOWN' : 'KEEP',
        reason: s.reason,
        confidence: item.unitsSold > 10 ? 'HIGH' : item.unitsSold > 3 ? 'MEDIUM' : 'LOW',
      } as PriceSuggestion;
    }).filter(Boolean) as PriceSuggestion[];

  } catch (err) {
    console.warn('[aiService] suggestPrices fallback (rule-based):', (err as Error).message);
    return fallbackPriceSuggestions(items);
  }
}

function fallbackPriceSuggestions(items: SalesItemSummary[]): PriceSuggestion[] {
  return items.map(item => {
    let suggestedPrice = item.currentPrice;
    let direction: 'UP' | 'DOWN' | 'KEEP' = 'KEEP';
    let reason = 'Giá hiện tại phù hợp với mức thị trường.';

    if (item.unitsSold === 0) {
      // Chưa có lịch sử bán: giữ nguyên
      reason = 'Chưa có dữ liệu bán hàng để đưa ra gợi ý.';
    } else if (item.unitsSold > 20) {
      // Bán rất chạy → tăng nhẹ
      suggestedPrice = Math.round((item.currentPrice * 1.10) / 1000) * 1000;
      direction = 'UP';
      reason = `Sản phẩm bán chạy (${item.unitsSold} cái/3 tháng), có thể tăng giá nhẹ.`;
    } else if (item.unitsSold <= 2 && item.currentPrice > 50000) {
      // Ít bán, giá cao → giảm nhẹ
      suggestedPrice = Math.round((item.currentPrice * 0.90) / 1000) * 1000;
      direction = 'DOWN';
      reason = `Lượng bán thấp, thử giảm giá để kích cầu.`;
    }

    const diff = suggestedPrice - item.currentPrice;
    const pct = item.currentPrice > 0 ? (diff / item.currentPrice) * 100 : 0;

    return {
      itemId: item.itemId,
      name: item.name,
      currentPrice: item.currentPrice,
      suggestedPrice,
      changePercent: Math.round(pct * 10) / 10,
      direction,
      reason,
      confidence: item.unitsSold > 10 ? 'MEDIUM' : 'LOW',
    };
  });
}

// ─── 2. Dự báo doanh thu ──────────────────────────────────────────────────────

/**
 * Dự báo doanh thu tháng tới dựa trên lịch sử 6 tháng gần nhất.
 */
export async function forecastRevenue(history: MonthlyRevenueSummary[]): Promise<RevenueForecast> {
  const forecastLabel = buildNextMonthLabel();

  try {
    const model = getAiModel();
    if (!model) throw new Error('No API key');

    const prompt = `Bạn là chuyên gia phân tích tài chính cho hộ kinh doanh nhỏ Việt Nam.

Dữ liệu doanh thu 6 tháng gần nhất (đơn vị: VNĐ):
${JSON.stringify(history, null, 2)}

Phân tích xu hướng và dự báo doanh thu tháng tới (${forecastLabel}).
- Xem xét tính mùa vụ, xu hướng tăng/giảm, biến động
- Đưa ra khoảng dự báo (low - high) dựa trên độ không chắc chắn
- Lời khuyên ngắn gọn, thực tế cho chủ hộ kinh doanh (tối đa 120 ký tự)

Trả về CHÍNH XÁC JSON (không có text khác):
{
  "predicted": number,
  "low": number,
  "high": number,
  "growthRate": number,
  "trend": "UP" | "DOWN" | "STABLE",
  "advice": "string"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON');
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      forecastMonth: forecastLabel,
      predicted: Math.round(parsed.predicted),
      low: Math.round(parsed.low),
      high: Math.round(parsed.high),
      growthRate: Math.round(parsed.growthRate * 10) / 10,
      trend: parsed.trend || 'STABLE',
      advice: parsed.advice || 'Duy trì hoạt động ổn định.',
    };

  } catch (err) {
    console.warn('[aiService] forecastRevenue fallback (linear regression):', (err as Error).message);
    return fallbackForecast(history, forecastLabel);
  }
}

function fallbackForecast(history: MonthlyRevenueSummary[], forecastLabel: string): RevenueForecast {
  if (!history.length) {
    return {
      forecastMonth: forecastLabel,
      predicted: 0,
      low: 0,
      high: 0,
      growthRate: 0,
      trend: 'STABLE',
      advice: 'Chưa có dữ liệu để dự báo. Hãy bắt đầu ghi nhận doanh thu.',
    };
  }

  // Simple linear regression on revenue values
  const n = history.length;
  const revenues = history.map(h => h.revenue);
  const sumX = (n * (n - 1)) / 2;
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY = revenues.reduce((a, b) => a + b, 0);
  const sumXY = revenues.reduce((acc, y, i) => acc + i * y, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const predicted = Math.max(0, Math.round(intercept + slope * n));

  const lastRevenue = revenues[revenues.length - 1] || 0;
  const growthRate = lastRevenue > 0 ? Math.round(((predicted - lastRevenue) / lastRevenue) * 1000) / 10 : 0;

  const stdDev = Math.sqrt(
    revenues.reduce((acc, r) => acc + Math.pow(r - sumY / n, 2), 0) / n
  );

  return {
    forecastMonth: forecastLabel,
    predicted,
    low: Math.max(0, Math.round(predicted - stdDev)),
    high: Math.round(predicted + stdDev),
    growthRate,
    trend: slope > 0 ? 'UP' : slope < 0 ? 'DOWN' : 'STABLE',
    advice: slope > 0
      ? 'Xu hướng tăng trưởng tốt. Duy trì và mở rộng dịch vụ.'
      : slope < 0
        ? 'Doanh thu có xu hướng giảm. Xem xét chạy khuyến mãi.'
        : 'Doanh thu ổn định. Tập trung tối ưu chi phí.',
  };
}

function buildNextMonthLabel(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const month = next.getMonth() + 1;
  const year = next.getFullYear();
  return `T${month}/${year}`;
}

// ─── 3. Tự động tạo tờ khai thuế ─────────────────────────────────────────────

/**
 * AI review tờ khai thuế đã tính và bổ sung nhận xét.
 */
export async function reviewTaxDeclaration(input: TaxDeclarationInput): Promise<AutoDeclarationResult> {
  try {
    const model = getAiModel();
    if (!model) throw new Error('No API key');

    const expenseRatio = input.revenue > 0
      ? Math.round((input.expenses / input.revenue) * 1000) / 10
      : 0;

    const prompt = `Bạn là chuyên gia kế toán thuế cho hộ kinh doanh nhỏ tại Việt Nam (Nghị định 68/2026/NĐ-CP).

Tờ khai thuế kỳ "${input.period}":
- Ngành: ${input.bizLabel} (loại ${input.businessType})
- Doanh thu: ${input.revenue.toLocaleString('vi-VN')} ₫
- Chi phí hợp lý: ${input.expenses.toLocaleString('vi-VN')} ₫ (tỷ lệ ${expenseRatio}%)
- Nhóm doanh thu: Nhóm ${input.revenueGroup}
- Thuế GTGT (${(input.vatRate * 100).toFixed(1)}%): ${input.vatAmount.toLocaleString('vi-VN')} ₫
- Thuế TNCN (${(input.tncnRate * 100).toFixed(1)}%): ${input.tncnAmount.toLocaleString('vi-VN')} ₫
- Tổng thuế: ${input.totalTax.toLocaleString('vi-VN')} ₫
- Miễn thuế: ${input.isExempt ? 'Có' : 'Không'}

Kiểm tra và đưa ra nhận xét (tối đa 3 mục, mỗi mục dưới 100 ký tự). Tập trung vào:
- Tỷ lệ chi phí có bất thường không?
- Có nên chuyển phương pháp khai thuế không?
- Cảnh báo nếu gần ngưỡng chuyển nhóm doanh thu

Trả về CHÍNH XÁC JSON (không có text khác):
{
  "comments": ["string", "string"],
  "warnings": ["string"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid JSON');
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      declaration: input,
      aiComments: parsed.comments || [],
      warnings: parsed.warnings || [],
    };

  } catch (err) {
    console.warn('[aiService] reviewTaxDeclaration fallback:', (err as Error).message);
    return fallbackTaxReview(input);
  }
}

function fallbackTaxReview(input: TaxDeclarationInput): AutoDeclarationResult {
  const comments: string[] = [];
  const warnings: string[] = [];

  if (input.isExempt) {
    comments.push('Doanh thu ≤ 500 triệu: được miễn thuế GTGT và TNCN.');
    comments.push('Vẫn phải nộp Tờ khai theo quy định trước ngày 31/01 năm sau.');
  } else {
    comments.push(`Thuế GTGT ${(input.vatRate * 100).toFixed(1)}% tính trên toàn bộ doanh thu.`);
    if (input.tncnAmount === 0 && input.revenueGroup === 2) {
      comments.push('Thuế TNCN miễn: doanh thu chưa vượt ngưỡng 1 tỷ đồng (Nghị định 68/2026).');
    }
  }

  // Cảnh báo gần ngưỡng nhóm
  const nearGroup3 = input.revenue > 2_500_000_000 && input.revenue <= 3_000_000_000;
  const nearGroup4 = input.revenue > 45_000_000_000 && input.revenue <= 50_000_000_000;
  if (nearGroup3) {
    warnings.push('Doanh thu gần ngưỡng 3 tỷ. Sắp phải áp dụng kê khai theo lợi nhuận (Nhóm 3).');
  }
  if (nearGroup4) {
    warnings.push('Doanh thu gần ngưỡng 50 tỷ. Chuẩn bị cho thuế suất TNCN 20% (Nhóm 4).');
  }

  const expenseRatio = input.revenue > 0 ? input.expenses / input.revenue : 0;
  if (expenseRatio < 0.10 && input.expenses > 0 && !input.isExempt) {
    warnings.push('Chi phí thấp bất thường (<10% DT). Kiểm tra có bỏ sót chi phí hợp lý không.');
  }

  return { declaration: input, aiComments: comments, warnings };
}
