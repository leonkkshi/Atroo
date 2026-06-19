import { useState, useEffect } from 'react';
import { taxApi } from '../api/client';
import { fmtMoney, fmtDate } from '../utils/format';

const TAX_TYPES = [
  { value: 'HKD',     label: '🏠 Hộ kinh doanh (VAT + TNCN)', badge: 'badge-hkd' },
  { value: 'VAT',     label: '📋 Thuế GTGT (VAT)',          badge: 'badge-vat' },
  { value: 'TNCN',    label: '👤 Thuế Thu nhập cá nhân',     badge: 'badge-tncn' },
  { value: 'TNDN',    label: '🏢 Thuế Thu nhập doanh nghiệp',badge: 'badge-tndn' },
  { value: 'MON_BAI', label: '📌 Lệ phí Môn bài',           badge: 'badge-mon-bai' },
];

// Gợi ý ngành nghề theo 3 loại hình mục tiêu
// Nghị định 68/2026: Ăn uống → Dịch vụ không bao thầu NVL (VAT 5%, TNCN 2%); Tiệm tóc/Sửa xe → Dịch vụ (VAT 5%, TNCN 2%)
const BIZ_PRESETS = [
  {
    key: 'food',
    icon: '🍜',
    label: 'Quán ăn',
    desc: 'Cơm bụi, bún phở...',
    bizType: '2', // Dịch vụ không bao thầu NVL (ăn uống) — VAT 5%, TNCN 2% (Nghị định 68/2026)
    taxType: 'HKD',
    hint: 'VAT 5% + TNCN 2% · miễn thuế nếu DT ≤ 500 triệu',
  },
  {
    key: 'hair',
    icon: '✂️',
    label: 'Tiệm tóc',
    desc: 'Cắt tóc, salon...',
    bizType: '2', // Dịch vụ thuần túy — VAT 5%, TNCN 2%
    taxType: 'HKD',
    hint: 'VAT 5% + TNCN 2% · miễn thuế nếu DT ≤ 500 triệu',
  },
  {
    key: 'bike',
    icon: '🔧',
    label: 'Sửa xe',
    desc: 'Sửa xe máy, garage...',
    bizType: '2', // Dịch vụ thuần túy — VAT 5%, TNCN 2%
    taxType: 'HKD',
    hint: 'VAT 5% + TNCN 2% · miễn thuế nếu DT ≤ 500 triệu',
  },
];

const BIZ_TYPES = [
  { value: '1', label: 'Phân phối, cung cấp hàng hóa (Bán buôn, bán lẻ, tạp hóa...)' },
  { value: '2', label: 'Dịch vụ không bao thầu NVL (Ăn uống, cắt tóc, sửa xe...)' },
  { value: '3', label: 'Sản xuất, vận tải, xây dựng có bao thầu nguyên vật liệu' },
  { value: '5', label: 'Cho thuê tài sản (Bất động sản, máy móc, thiết bị...)' },
  { value: '6', label: 'Dịch vụ thông tin số, quảng cáo số' },
  { value: '4', label: 'Hoạt động kinh doanh khác (2% GTGT + 1% TNCN)' },
];

const PERIODS = ['Tháng 01/2026','Tháng 02/2026','Tháng 03/2026','Tháng 04/2026','Tháng 05/2026','Tháng 06/2026','Quý 2/2026','Quý 3/2026','Năm 2026'];

function formatDecimalPct(r) {
  if (r === undefined || r === null) return '—';
  return (r * 100).toFixed(1) + '%';
}

function CountUp({ value, duration = 800 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const endValue = parseInt(value, 10);
    if (isNaN(endValue) || endValue === 0) {
      setDisplayValue(0);
      return;
    }

    let animationFrameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Easing function: easeOutQuad
      const easeProgress = progress * (2 - progress);
      setDisplayValue(Math.floor(easeProgress * endValue));

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  return <>{fmtMoney(displayValue)}</>;
}

export default function Tax() {
  const [taxType, setTaxType] = useState('HKD');
  const [bizType, setBizType] = useState('2');
  const [revenue, setRevenue] = useState('');
  const [expenses, setExpenses] = useState('');
  const [partsRevenue, setPartsRevenue] = useState('');
  const [methodGroup2, setMethodGroup2] = useState('DIRECT'); // 'DIRECT' | 'PROFIT'
  const [period, setPeriod] = useState('Tháng 05/2026');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [declarations, setDeclarations] = useState([]);
  const [loadingDecl, setLoadingDecl] = useState(true);
  const [tab, setTab] = useState('calc'); // 'calc' | 'history'

  // Stepper Animation State
  const [stepperIndex, setStepperIndex] = useState(null);
  const [stepperData, setStepperData] = useState(null);
  const [stepperRev, setStepperRev] = useState(0);
  const [stepperBiz, setStepperBiz] = useState('2');

  useEffect(() => {
    taxApi.getDeclarations()
      .then(data => setDeclarations(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoadingDecl(false));
  }, []);

  // Reset result and stepper when inputs change
  useEffect(() => {
    setResult(null);
    setSaved(false);
    setError('');
    setStepperIndex(null);
    setStepperData(null);
  }, [taxType, bizType, revenue, expenses, partsRevenue, methodGroup2]);

  // Handle sequential step increment
  useEffect(() => {
    if (stepperIndex === null || stepperIndex >= 8) return;

    const timer = setTimeout(() => {
      setStepperIndex(prev => {
        if (prev === 7) {
          // Finished the 8th step (index 7). Transition to showing the result!
          setTimeout(() => {
            setResult(stepperData);
            setStepperIndex(null);
          }, 350);
          return 8;
        }
        return prev + 1;
      });
    }, 180); // 180ms delay per step (matching R22)

    return () => clearTimeout(timer);
  }, [stepperIndex, stepperData]);

  const handleCalc = async (e) => {
    e.preventDefault();
    const revStr = String(revenue).replace(/\D/g, '');
    const rev = parseFloat(revStr);
    if (!rev) { setError('Vui lòng nhập doanh thu hợp lệ.'); return; }
    setLoading(true); setError(''); setResult(null); setStepperIndex(null); setStepperData(null);
    try {
      const data = await taxApi.calculate(
        taxType,
        rev,
        bizType,
        parseFloat(String(expenses).replace(/\D/g, '')) || 0,
        parseFloat(String(partsRevenue).replace(/\D/g, '')) || 0,
        methodGroup2
      );
      
      if (taxType === 'HKD') {
        setStepperData(data);
        setStepperRev(rev);
        setStepperBiz(bizType);
        setStepperIndex(0);
      } else {
        setResult(data);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await taxApi.saveDeclaration({
        taxType: result.taxType,
        period,
        revenue: result.revenue,
        expenses: result.expenses || 0,
        taxAmount: result.taxAmount,
        status: 'DRAFT',
      });
      setSaved(true);
      // Refresh list
      const data = await taxApi.getDeclarations();
      setDeclarations(Array.isArray(data) ? data : []);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const needsBizType = taxType === 'VAT' || taxType === 'TNCN' || taxType === 'HKD';
  const parsedRev = parseFloat(String(revenue).replace(/\D/g, '')) || 0;
  const isGroup2 = parsedRev > 500000000 && parsedRev <= 3000000000;
  const isGroup3Or4 = parsedRev > 3000000000;
  const needsExpenses = taxType === 'TNDN' || 
    ((taxType === 'HKD' || taxType === 'TNCN') && (isGroup3Or4 || (isGroup2 && methodGroup2 === 'PROFIT')));
  const isExempt = result && result.taxAmount === 0;

  const applyPreset = (preset) => {
    setTaxType(preset.taxType);
    setBizType(preset.bizType);
    setPartsRevenue('');
    setMethodGroup2('DIRECT');
    setResult(null);
    setSaved(false);
    setError('');
    setStepperIndex(null);
    setStepperData(null);
  };

  const TAX_BADGE_MAP = { HKD: 'badge-hkd', VAT: 'badge-vat', TNCN: 'badge-tncn', TNDN: 'badge-tndn', MON_BAI: 'badge-mon-bai' };
  const STATUS_BADGE  = { DRAFT: 'badge-draft', SUBMITTED: 'badge-submitted' };

  // Stepper state classes
  const getStepClass = (index) => {
    if (stepperIndex > index) return 'step-row completed';
    if (stepperIndex === index) return 'step-row active';
    return 'step-row pending';
  };

  const getStepCircleContent = (index) => {
    if (stepperIndex > index) return '✓';
    return index + 1;
  };

  return (
    <div className="page-container page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Hỗ trợ Thuế</div>
          <div className="page-sub">Tính thuế & quản lý tờ khai</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-6">
        <button id="tax-tab-calc" className={`tab-btn${tab === 'calc' ? ' active' : ''}`} onClick={() => setTab('calc')}>🧮 Tính thuế</button>
        <button id="tax-tab-history" className={`tab-btn${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>📂 Lịch sử tờ khai</button>
      </div>

      {tab === 'calc' && (
        <>
          {/* Business type presets */}
          <div className="section-title mb-3">Chọn nhanh theo loại hình</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
            {BIZ_PRESETS.map(p => (
              <button
                key={p.key}
                id={`preset-${p.key}`}
                onClick={() => applyPreset(p)}
                style={{
                  background: bizType === p.bizType && taxType === p.taxType ? 'var(--accent-dim)' : 'var(--surface)',
                  border: `1px solid ${bizType === p.bizType && taxType === p.taxType ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: '12px 8px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 150ms',
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 4 }}>{p.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{p.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.3 }}>{p.hint}</div>
              </button>
            ))}
          </div>

          {/* Tax type selector */}
          <div className="section-title mb-3">Loại thuế</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {TAX_TYPES.map(t => (
              <button
                key={t.value}
                id={`taxtype-${t.value.toLowerCase()}`}
                className={`pay-method-btn${taxType === t.value ? ' selected' : ''}`}
                onClick={() => setTaxType(t.value)}
                style={{ padding: '12px 10px', borderRadius: 12, flexDirection: 'row', justifyContent: 'flex-start', gap: 8, textAlign: 'left', fontSize: 12 }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form className="form-section mb-4" onSubmit={handleCalc}>
            {error && <div className="error-msg">⚠️ {error}</div>}

            <div className="input-group">
              <label className="input-label">Kỳ tính thuế</label>
              <select id="tax-period" className="input" value={period} onChange={e => setPeriod(e.target.value)}>
                {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Doanh thu (₫) *</label>
              <input
                id="tax-revenue"
                className="input"
                type="number"
                placeholder="Ví dụ: 50000000"
                value={revenue}
                onChange={e => setRevenue(e.target.value)}
                inputMode="numeric"
              />
            </div>

            {needsBizType && (
              <div className="input-group">
                <label className="input-label">Ngành nghề kinh doanh</label>
                <select id="tax-biztype" className="input" value={bizType} onChange={e => setBizType(e.target.value)}>
                  {BIZ_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
            )}

            {needsBizType && bizType === '2' && (
              <div className="input-group">
                <label className="input-label">Trong đó: Doanh thu bán phụ tùng (₫)</label>
                <input
                  id="tax-parts-revenue"
                  className="input"
                  type="number"
                  placeholder="Ví dụ: 10000000"
                  value={partsRevenue}
                  onChange={e => setPartsRevenue(e.target.value)}
                  inputMode="numeric"
                />
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
                  Phần doanh thu bán phụ tùng (lốp, nhớt, linh kiện...) được hưởng thuế suất ưu đãi 1.5% (1% GTGT + 0.5% TNCN).
                </div>
              </div>
            )}

            {needsBizType && isGroup2 && (
              <div className="input-group">
                <label className="input-label">Phương pháp tính thuế TNCN (Nhóm 2)</label>
                <select
                  id="tax-method-group2"
                  className="input"
                  value={methodGroup2}
                  onChange={e => setMethodGroup2(e.target.value)}
                >
                  <option value="DIRECT">Trực tiếp trên doanh thu (TNCN = (DT - 500tr) × % TNCN)</option>
                  <option value="PROFIT">Kê khai theo lợi nhuận (TNCN = (DT - Chi phí) × 15%)</option>
                </select>
              </div>
            )}

            {needsExpenses && (
              <div className="input-group">
                <label className="input-label">Chi phí hợp lệ (₫)</label>
                <input
                  id="tax-expenses"
                  className="input"
                  type="number"
                  placeholder="Tổng chi phí được khấu trừ"
                  value={expenses}
                  onChange={e => setExpenses(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            )}

            <button id="calc-tax-btn" className="btn btn-primary w-full" type="submit" disabled={loading || stepperIndex !== null}>
              {loading ? 'Đang tính toán...' : '🧮 Tính thuế ngay'}
            </button>
          </form>

          {/* 8-Step Stepper Processing Visualizer */}
          {stepperIndex !== null && (
            <div className="card card--accent mb-4" style={{ animation: 'fadeIn 250ms var(--ease)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span className="badge badge-hkd">HKD</span>
                <div className="font-syne" style={{ fontSize: 15, fontWeight: 700 }}>
                  ⚡ Quy trình xử lý thuế Hộ kinh doanh (8 bước)
                </div>
              </div>

              <div className="stepper-container">
                <div className={`stepper-line ${stepperIndex > 0 ? 'stepper-line-active' : ''}`} />
                
                {/* Step 1: Nhập doanh thu */}
                <div className={getStepClass(0)}>
                  <div className="step-circle">{getStepCircleContent(0)}</div>
                  <div className="step-content">
                    <div className="step-title">1. Nhập doanh thu</div>
                    <div className="step-desc">
                      {stepperIndex >= 0 ? `Doanh thu nhận vào: ${fmtMoney(stepperRev)}` : 'Chờ doanh thu đầu vào...'}
                    </div>
                  </div>
                </div>

                {/* Step 2: Xác định ngành nghề */}
                <div className={getStepClass(1)}>
                  <div className="step-circle">{getStepCircleContent(1)}</div>
                  <div className="step-content">
                    <div className="step-title">2. Xác định ngành nghề</div>
                    <div className="step-desc">
                      {stepperIndex >= 1 ? `Ngành: ${BIZ_TYPES.find(b => b.value === stepperBiz)?.label.split(' (')[0]}` : 'Đang nhận diện lĩnh vực hoạt động...'}
                    </div>
                  </div>
                </div>

                {/* Step 3: Lấy tỷ lệ thuế */}
                <div className={getStepClass(2)}>
                  <div className="step-circle">{getStepCircleContent(2)}</div>
                  <div className="step-content">
                    <div className="step-title">3. Lấy tỷ lệ thuế</div>
                    <div className="step-desc">
                      {stepperIndex >= 2 ? `Tỷ lệ: GTGT ${(stepperData?.rates.vatRate * 100).toFixed(1)}% · TNCN ${(stepperData?.rates.tncnRate * 100).toFixed(1)}%` : 'Đang truy xuất thuế suất Thông tư 40/2021/TT-BTC...'}
                    </div>
                  </div>
                </div>

                {/* Step 4: Kiểm tra miễn thuế */}
                <div className={getStepClass(3)}>
                  <div className="step-circle">{getStepCircleContent(3)}</div>
                  <div className="step-content">
                    <div className="step-title">4. Kiểm tra miễn thuế</div>
                    <div className="step-desc">
                      {stepperIndex >= 3 ? (stepperData?.isExempt ? '🎉 Doanh thu ≤ 500 triệu/năm: MIỄN THUẾ!' : `Doanh thu > 500 triệu/năm → Nhóm ${stepperData?.revenueGroup || 2}: Tính thuế.`) : 'Đang kiểm tra ngưỡng doanh thu 500 triệu...'}
                    </div>
                  </div>
                </div>

                {/* Step 5: Tính GTGT */}
                <div className={getStepClass(4)}>
                  <div className="step-circle">{getStepCircleContent(4)}</div>
                  <div className="step-content">
                    <div className="step-title">5. Tính GTGT</div>
                    <div className="step-desc">
                      {stepperIndex >= 4 ? (
                        stepperData?.isExempt ? 'GTGT phải nộp: 0 ₫' :
                        parseFloat(partsRevenue) > 0 ? `(DT dịch vụ × VAT% + DT phụ tùng × 1%) = ${fmtMoney(stepperData?.vatAmount)}` :
                        `Doanh thu × VAT% = ${fmtMoney(stepperData?.vatAmount)}`
                      ) : 'Đang tính toán thuế GTGT...'}
                    </div>
                  </div>
                </div>

                {/* Step 6: Tính TNCN */}
                <div className={getStepClass(5)}>
                  <div className="step-circle">{getStepCircleContent(5)}</div>
                  <div className="step-content">
                    <div className="step-title">6. Tính TNCN</div>
                    <div className="step-desc">
                      {stepperIndex >= 5 ? (
                        stepperData?.isExempt ? 'TNCN phải nộp: 0 ₫' :
                        stepperData?.revenueGroup === 1 ? 'Miễn TNCN' :
                        stepperData?.revenueGroup === 2 && methodGroup2 === 'PROFIT' ? `(DT - Chi phí) × 15% = ${fmtMoney(stepperData?.tncnAmount)}` :
                        stepperData?.revenueGroup === 2 ? `(DT - 1 tỷ) × TNCN% = ${fmtMoney(stepperData?.tncnAmount)}` :
                        stepperData?.revenueGroup === 3 ? `(DT - Chi phí) × 17% = ${fmtMoney(stepperData?.tncnAmount)}` :
                        stepperData?.revenueGroup === 4 ? `(DT - Chi phí) × 20% = ${fmtMoney(stepperData?.tncnAmount)}` :
                        `TNCN phải nộp: ${fmtMoney(stepperData?.tncnAmount)}`
                      ) : 'Đang tính toán thuế TNCN...'}
                    </div>
                  </div>
                </div>

                {/* Step 7: Tính tổng */}
                <div className={getStepClass(6)}>
                  <div className="step-circle">{getStepCircleContent(6)}</div>
                  <div className="step-content">
                    <div className="step-title">7. Tính tổng</div>
                    <div className="step-desc">
                      {stepperIndex >= 6 ? `Tổng thuế: GTGT + TNCN = ${fmtMoney(stepperData?.taxAmount)}` : 'Đang cộng dồn các loại thuế...'}
                    </div>
                  </div>
                </div>

                {/* Step 8: Xuất kết quả */}
                <div className={getStepClass(7)}>
                  <div className="step-circle">{getStepCircleContent(7)}</div>
                  <div className="step-content">
                    <div className="step-title">8. Xuất kết quả</div>
                    <div className="step-desc">
                      {stepperIndex >= 7 ? 'Hoàn thành!' : 'Đang kết xuất báo cáo tờ khai...'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="tax-result-card card card--accent" style={{ animation: 'fadeIn var(--dur-comp) var(--ease)' }}>
              <div className="flex items-center gap-3 mb-3">
                <span className={`badge ${TAX_BADGE_MAP[result.taxType] || 'badge-vat'}`}>{result.taxType === 'HKD' ? 'Hộ kinh doanh' : result.taxType}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{period}</span>
              </div>

              {isExempt ? (
                <div className="alert alert-success mb-3">
                  🎉 <strong>Được miễn thuế!</strong> Doanh thu năm ≤ 500.000.000 ₫ thuộc diện miễn thuế VAT và TNCN theo Thông tư 40/2021/TT-BTC. Kê khai doanh thu 1 lần trước 31/1 năm sau.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Số thuế phải nộp</div>
                  <div className="tax-amount-big accent-num" style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>
                    <CountUp value={result.taxAmount} />
                  </div>
                </>
              )}

              <div className="divider" style={{ margin: '16px 0' }} />

              {/* Nhóm doanh thu */}
              {result.revenueGroup && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
                  <span style={{ color: 'var(--text-2)' }}>Nhóm doanh thu</span>
                  <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                    {result.revenueGroup === 1 && 'Nhóm 1 — ≤ 500 triệu'}
                    {result.revenueGroup === 2 && 'Nhóm 2 — 500 triệu → 3 tỷ'}
                    {result.revenueGroup === 3 && 'Nhóm 3 — 3 tỷ → 50 tỷ'}
                    {result.revenueGroup === 4 && 'Nhóm 4 — > 50 tỷ'}
                  </span>
                </div>
              )}

              <div className="tax-detail-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span className="tax-detail-label" style={{ color: 'var(--text-2)' }}>Doanh thu</span>
                <span className="tax-detail-val" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmtMoney(result.revenue)}</span>
              </div>

              {result.taxType === 'HKD' && !isExempt && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
                  <div className="card" style={{ borderTop: '2px solid var(--cyan)', background: 'rgba(255, 255, 255, 0.65)', padding: 12, borderRadius: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Thuế GTGT (VAT)</div>
                    <div style={{ fontSize: 10, color: 'var(--cyan)' }}>Tỷ lệ: {formatDecimalPct(result.rates?.vatRate)}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cyan)', marginTop: 4 }}>
                      <CountUp value={result.vatAmount} />
                    </div>
                  </div>
                  <div className="card" style={{ borderTop: '2px solid var(--accent)', background: 'rgba(255, 255, 255, 0.65)', padding: 12, borderRadius: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Thuế TNCN</div>
                    <div style={{ fontSize: 10, color: 'var(--accent)' }}>
                      {result.revenueGroup === 2 ? (
                        methodGroup2 === 'PROFIT' ? '(DT - CP) × 15%' :
                        `(DT - 1 tỷ) × ${formatDecimalPct(result.rates?.tncnRate)}`
                       ) :
                       result.revenueGroup === 3 ? '(DT - CP) × 17%' :
                       result.revenueGroup === 4 ? '(DT - CP) × 20%' :
                       `Tỷ lệ: ${formatDecimalPct(result.rates?.tncnRate)}`}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
                      <CountUp value={result.tncnAmount} />
                    </div>
                  </div>
                </div>
              )}

              {result.expenses > 0 && (
                <div className="tax-detail-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                  <span className="tax-detail-label" style={{ color: 'var(--text-2)' }}>Chi phí khấu trừ</span>
                  <span className="tax-detail-val" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmtMoney(result.expenses)}</span>
                </div>
              )}

              {result.taxType !== 'HKD' && (
                <>
                  {result.rates?.vatRate > 0 && (
                    <div className="tax-detail-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                      <span className="tax-detail-label" style={{ color: 'var(--text-2)' }}>Tỷ lệ VAT</span>
                      <span className="tax-detail-val" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{formatDecimalPct(result.rates.vatRate)}</span>
                    </div>
                  )}
                  {result.rates?.tncnRate > 0 && (
                    <div className="tax-detail-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                      <span className="tax-detail-label" style={{ color: 'var(--text-2)' }}>Tỷ lệ TNCN</span>
                      <span className="tax-detail-val" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{formatDecimalPct(result.rates.tncnRate)}</span>
                    </div>
                  )}
                  {result.rates?.tndnRate > 0 && (
                    <div className="tax-detail-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                      <span className="tax-detail-label" style={{ color: 'var(--text-2)' }}>Thuế suất TNDN</span>
                      <span className="tax-detail-val" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{formatDecimalPct(result.rates.tndnRate)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="divider" style={{ margin: '16px 0' }} />

              {result.details && (
                <div className="alert alert-info mb-3" style={{ fontSize: 12 }}>
                  ℹ️ {result.details}
                </div>
              )}

              {saved ? (
                <div className="alert alert-success">✓ Đã lưu tờ khai vào lịch sử</div>
              ) : (
                <button id="save-declaration-btn" className="btn btn-ghost w-full" onClick={handleSave} disabled={saving}>
                  {saving ? 'Đang lưu...' : '💾 Lưu tờ khai'}
                </button>
              )}
            </div>
          )}

          {/* Info cards */}
          {!result && stepperIndex === null && (
            <div className="flex-col gap-3 mt-4">
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>📌 Ngưỡng miễn thuế HKD</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Hộ kinh doanh có doanh thu <strong style={{ color: 'var(--text-1)' }}>≤ 500.000.000 ₫/năm</strong> được <strong style={{ color: 'var(--accent)' }}>MIỄN HOÀN TOÀN</strong> thuế VAT và TNCN. Chỉ cần kê khai doanh thu 1 lần trước 31/1 năm sau.
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cyan)', marginBottom: 8 }}>📊 Phân nhóm doanh thu</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Nhóm 1</span> ≤ 500 triệu → Miễn thuế<br/>
                  <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Nhóm 2</span> 500 triệu–3 tỷ → TNCN trên phần vượt <strong>1 tỷ</strong><br/>
                  <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>Nhóm 3</span> 3 tỷ–50 tỷ → TNCN 17% × lợi nhuận<br/>
                  <span style={{ color: '#a78bfa', fontWeight: 600 }}>Nhóm 4</span> &gt; 50 tỷ → TNCN 20% × lợi nhuận
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>⚠️ Lệ phí Môn bài 2026</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Hạn nộp: <strong style={{ color: 'var(--text-1)' }}>30/01/2026</strong>. Mức: 300.000 – 1.000.000 ₫ tùy doanh thu (ngưỡng phân bậc: 100 triệu / 300 triệu / 500 triệu).
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="card">
            {loadingDecl ? (
              [1,2,3].map(i => (
                <div key={i} className="list-item">
                  <div style={{ flex: 1 }}>
                    <div className="skeleton skeleton-text mb-2" style={{ width: '60%' }} />
                    <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                  </div>
                </div>
              ))
            ) : declarations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon" style={{ fontSize: 48, color: 'var(--accent)', marginBottom: 12 }}>📋</div>
                <div className="empty-title" style={{ fontSize: 16, fontWeight: 600 }}>Chưa có tờ khai</div>
                <div className="empty-body" style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Tính thuế và lưu tờ khai từ tab Tính thuế.</div>
                <button className="btn btn-primary btn-sm" onClick={() => setTab('calc')}>Tính thuế ngay</button>
              </div>
            ) : (
              declarations.map(d => (
                <div key={d.id} className="list-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${TAX_BADGE_MAP[d.taxType] || 'badge-vat'}`}>{d.taxType === 'HKD' ? 'Hộ kinh doanh' : d.taxType}</span>
                      <span className={`badge ${STATUS_BADGE[d.status] || 'badge-draft'}`}>{d.status === 'DRAFT' ? 'Nháp' : 'Đã nộp'}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{d.period}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                      DT: {fmtMoney(d.revenue)} · {fmtDate(d.createdAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Syne', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                      {fmtMoney(d.taxAmount)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-2)' }}>thuế</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
