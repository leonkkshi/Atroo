import { useState, useEffect } from 'react';
import { taxApi } from '../api/client';
import { fmtMoney, fmtDate } from '../utils/format';

const TAX_TYPES = [
  { value: 'VAT',     label: '📋 Thuế GTGT (VAT)',          badge: 'badge-vat' },
  { value: 'TNCN',    label: '👤 Thuế Thu nhập cá nhân',     badge: 'badge-tncn' },
  { value: 'TNDN',    label: '🏢 Thuế Thu nhập doanh nghiệp',badge: 'badge-tndn' },
  { value: 'MON_BAI', label: '📌 Lệ phí Môn bài',           badge: 'badge-mon-bai' },
];

// Gợi ý ngành nghề theo 3 loại hình mục tiêu
const BIZ_PRESETS = [
  {
    key: 'food',
    icon: '🍜',
    label: 'Quán ăn',
    desc: 'Cơm bụi, bún phở...',
    bizType: '3', // Sản xuất, ăn uống
    taxType: 'VAT',
    hint: 'VAT 3% + TNCN 1.5% trên doanh thu',
  },
  {
    key: 'hair',
    icon: '✂️',
    label: 'Tiệm tóc',
    desc: 'Cắt tóc, salon...',
    bizType: '2', // Dịch vụ
    taxType: 'VAT',
    hint: 'VAT 5% + TNCN 2% trên doanh thu',
  },
  {
    key: 'bike',
    icon: '🔧',
    label: 'Sửa xe',
    desc: 'Sửa xe máy, garage...',
    bizType: '2', // Dịch vụ
    taxType: 'VAT',
    hint: 'VAT 5% + TNCN 2% trên doanh thu',
  },
];

const BIZ_TYPES = [
  { value: '1', label: 'Phân phối, cung cấp hàng hóa (Đại lý, tạp hóa...)' },
  { value: '2', label: 'Dịch vụ thuần túy (Tiệm tóc, sửa xe, giặt ủi...)' },
  { value: '3', label: 'Sản xuất, vận tải, ăn uống (Quán cơm, bún phở...)' },
  { value: '4', label: 'Hoạt động kinh doanh khác' },
];

const PERIODS = ['Tháng 01/2026','Tháng 02/2026','Tháng 03/2026','Tháng 04/2026','Tháng 05/2026','Tháng 06/2026','Quý 2/2026','Quý 3/2026','Năm 2026'];

function formatDecimalPct(r) {
  if (!r) return '—';
  return (r * 100).toFixed(1) + '%';
}

export default function Tax() {
  const [taxType, setTaxType] = useState('VAT');
  const [bizType, setBizType] = useState('2');
  const [revenue, setRevenue] = useState('');
  const [expenses, setExpenses] = useState('');
  const [period, setPeriod] = useState('Tháng 05/2026');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [declarations, setDeclarations] = useState([]);
  const [loadingDecl, setLoadingDecl] = useState(true);
  const [tab, setTab] = useState('calc'); // 'calc' | 'history'

  useEffect(() => {
    taxApi.getDeclarations()
      .then(data => setDeclarations(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoadingDecl(false));
  }, []);

  // Reset result when inputs change
  useEffect(() => { setResult(null); setSaved(false); setError(''); }, [taxType, bizType, revenue, expenses]);

  const handleCalc = async (e) => {
    e.preventDefault();
    const rev = parseFloat(revenue.replace(/\D/g, ''));
    if (!rev) { setError('Vui lòng nhập doanh thu hợp lệ.'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const data = await taxApi.calculate(taxType, rev, bizType, parseFloat(expenses.replace(/\D/g, '')) || 0);
      setResult(data);
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

  const needsBizType = taxType === 'VAT' || taxType === 'TNCN';
  const needsExpenses = taxType === 'TNDN';
  const isExempt = result && result.taxAmount === 0;

  const applyPreset = (preset) => {
    setTaxType(preset.taxType);
    setBizType(preset.bizType);
    setResult(null);
    setSaved(false);
    setError('');
  };

  const TAX_BADGE_MAP = { VAT: 'badge-vat', TNCN: 'badge-tncn', TNDN: 'badge-tndn', MON_BAI: 'badge-mon-bai' };
  const STATUS_BADGE  = { DRAFT: 'badge-draft', SUBMITTED: 'badge-submitted' };

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

            <button id="calc-tax-btn" className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? 'Đang tính toán...' : '🧮 Tính thuế ngay'}
            </button>
          </form>

          {/* Result */}
          {result && (
            <div className="tax-result-card">
              <div className="flex items-center gap-3 mb-3">
                <span className={`badge ${TAX_BADGE_MAP[result.taxType] || 'badge-vat'}`}>{result.taxType}</span>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{period}</span>
              </div>

              {isExempt ? (
                <div className="alert alert-success mb-3">
                  🎉 <strong>Được miễn thuế!</strong> Doanh thu dưới ngưỡng chịu thuế theo quy định.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Số thuế phải nộp</div>
                  <div className="tax-amount-big">{fmtMoney(result.taxAmount)}</div>
                </>
              )}

              <div className="divider" />

              <div className="tax-detail-row">
                <span className="tax-detail-label">Doanh thu</span>
                <span className="tax-detail-val">{fmtMoney(result.revenue)}</span>
              </div>
              {result.expenses > 0 && (
                <div className="tax-detail-row">
                  <span className="tax-detail-label">Chi phí khấu trừ</span>
                  <span className="tax-detail-val">{fmtMoney(result.expenses)}</span>
                </div>
              )}
              {result.rates?.vatRate > 0 && (
                <div className="tax-detail-row">
                  <span className="tax-detail-label">Tỷ lệ VAT</span>
                  <span className="tax-detail-val">{formatDecimalPct(result.rates.vatRate)}</span>
                </div>
              )}
              {result.rates?.tncnRate > 0 && (
                <div className="tax-detail-row">
                  <span className="tax-detail-label">Tỷ lệ TNCN</span>
                  <span className="tax-detail-val">{formatDecimalPct(result.rates.tncnRate)}</span>
                </div>
              )}
              {result.rates?.tndnRate > 0 && (
                <div className="tax-detail-row">
                  <span className="tax-detail-label">Thuế suất TNDN</span>
                  <span className="tax-detail-val">{formatDecimalPct(result.rates.tndnRate)}</span>
                </div>
              )}

              <div className="divider" />

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
          {!result && (
            <div className="flex-col gap-3 mt-4">
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>📌 Ngưỡng miễn thuế</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Hộ kinh doanh có doanh thu dưới <strong style={{ color: 'var(--text-1)' }}>100.000.000 ₫/năm</strong> được miễn thuế VAT và TNCN theo Thông tư 40/2021/TT-BTC.
                </div>
              </div>
              <div className="card">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>⚠️ Lệ phí Môn bài 2026</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Hạn nộp: <strong style={{ color: 'var(--text-1)' }}>30/01/2026</strong>. Mức: 300.000 – 1.000.000 ₫ tùy doanh thu.
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
                <div className="empty-icon">📋</div>
                <div className="empty-title">Chưa có tờ khai</div>
                <div className="empty-body">Tính thuế và lưu tờ khai từ tab Tính thuế.</div>
                <button className="btn btn-primary btn-sm mt-3" onClick={() => setTab('calc')}>Tính thuế ngay</button>
              </div>
            ) : (
              declarations.map(d => (
                <div key={d.id} className="list-item">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${TAX_BADGE_MAP[d.taxType] || 'badge-vat'}`}>{d.taxType}</span>
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
