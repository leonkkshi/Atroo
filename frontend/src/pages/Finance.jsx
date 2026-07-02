import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { posApi } from '../api/client';
import { fmtMoney, fmtDate } from '../utils/format';
import { useAuth } from '../store/authStore';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, LineElement, PointElement,
  BarElement, Tooltip, Filler, Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, Tooltip, Filler, Legend);

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS_VN = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const HOURS   = Array.from({ length: 24 }, (_, i) => `${i}h`);

const CHART_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1C2340',
      borderColor: '#2A3356',
      borderWidth: 1,
      titleColor: '#8892B0',
      bodyColor: '#FFFFFF',
      callbacks: { label: (ctx) => ' ' + new Intl.NumberFormat('vi-VN').format(ctx.raw) + ' ₫' },
    },
  },
  scales: {
    x: { grid: { color: 'rgba(42,51,86,0.4)' }, ticks: { color: '#8892B0', font: { size: 10 } } },
    y: {
      grid: { color: 'rgba(42,51,86,0.4)' },
      ticks: {
        color: '#8892B0', font: { size: 10 },
        callback: (v) => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(v),
      },
    },
  },
};

const CHART_BASE_GROUPED = {
  ...CHART_BASE,
  plugins: {
    ...CHART_BASE.plugins,
    legend: {
      display: true,
      labels: { color: '#8892B0', font: { size: 11 }, boxWidth: 12, padding: 16 },
    },
  },
};

const EXPENSE_CATEGORIES = {
  OPERATING: { label: '🏢 Vận hành',     badge: 'badge-tndn',    icon: '🏢' },
  MATERIAL:  { label: '📦 Nguyên liệu',  badge: 'badge-product', icon: '📦' },
  SALARY:    { label: '👥 Nhân sự',      badge: 'badge-service', icon: '👥' },
  OTHER:     { label: '🌀 Khác',         badge: 'badge-draft',   icon: '🌀' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtNum = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0));
const pct = (cur, prev) => {
  if (!prev) return null;
  const delta = ((cur - prev) / Math.abs(prev)) * 100;
  return delta;
};

function buildLast30Days(invoices) {
  const map = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map[d.toISOString().slice(0, 10)] = 0;
  }
  invoices.forEach(inv => {
    const key = new Date(inv.createdAt).toISOString().slice(0, 10);
    if (key in map) map[key] += inv.total;
  });
  return map;
}

// ─── Components ───────────────────────────────────────────────────────────────

/** Badge % so sánh kỳ trước */
function DeltaBadge({ cur, prev }) {
  const delta = pct(cur, prev);
  if (delta === null) return null;
  const up = delta >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: up ? 'rgba(0,229,160,0.12)' : 'rgba(255,80,80,0.12)',
      color: up ? 'var(--accent)' : '#FF5050',
    }}>
      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

/** Skeleton bar */
function Skeleton({ h = 90 }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 12 }} />;
}

// ─── AddExpenseModal ──────────────────────────────────────────────────────────
function AddExpenseModal({ onClose, onAdded }) {
  const [title,    setTitle]    = useState('');
  const [amount,   setAmount]   = useState('');
  const [category, setCategory] = useState('OPERATING');
  const [date,     setDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [err,      setErr]      = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const parsed = parseFloat(amount);
    if (!cleanTitle) { setErr('Vui lòng nhập tên chi phí.'); return; }
    if (isNaN(parsed) || parsed <= 0) { setErr('Vui lòng nhập số tiền chi phí.'); return; }
    onAdded({ id: `exp_${Date.now()}`, title: cleanTitle, amount: parsed, category, date });
    onClose();
  };

  return createPortal(
    <>
      <div className="backdrop" onClick={onClose} style={{ zIndex: 110 }} />
      <div className="bottom-sheet" style={{ zIndex: 111 }}>
        <div className="bottom-sheet-handle" />
        <div style={{ padding: '20px 20px 40px' }}>
          <div className="h2 mb-4">💸 Thêm chi phí phát sinh</div>
          <form className="form-section" onSubmit={handleSubmit}>
            {err && <div className="error-msg">⚠️ {err}</div>}
            <div className="input-group">
              <label className="input-label">Tên khoản chi</label>
              <input className="input" placeholder="Ví dụ: Tiền mặt bằng, điện nước..." value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Số tiền (₫)</label>
                <input className="input" type="number" placeholder="500000" value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" />
              </div>
              <div className="input-group">
                <label className="input-label">Danh mục</label>
                <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="OPERATING">🏢 Vận hành</option>
                  <option value="MATERIAL">📦 Hàng hóa / Nguyên liệu</option>
                  <option value="SALARY">👥 Lương / Nhân sự</option>
                  <option value="OTHER">🌀 Khác / Phát sinh</option>
                </select>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Ngày chi trả</label>
              <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button className="btn btn-primary w-full mt-4" type="submit" style={{ height: 52 }}>✓ Xác nhận chi</button>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Tab: Tổng quan ───────────────────────────────────────────────────────────
function TabOverview({ invoices, expenses, loading }) {
  const [period, setPeriod] = useState('month');

  const now = new Date();
  const periodStart = new Date();
  if (period === 'day') { periodStart.setHours(0, 0, 0, 0); }
  else if (period === 'month') { periodStart.setDate(1); periodStart.setHours(0, 0, 0, 0); }
  else if (period === 'year') { periodStart.setMonth(0); periodStart.setDate(1); periodStart.setHours(0, 0, 0, 0); }

  const todayStr = now.toISOString().slice(0, 10);
  const filteredInvoices = invoices.filter(inv => new Date(inv.createdAt) >= periodStart);
  const filteredExpenses = expenses.filter(exp => {
    if (period === 'day') return exp.date === todayStr;
    const d = new Date(exp.date); d.setHours(0, 0, 0, 0);
    return d >= periodStart;
  });

  const totalRevenue  = filteredInvoices.reduce((s, i) => s + i.total, 0);
  const totalTax      = filteredInvoices.reduce((s, i) => s + (i.estimatedTax || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const profit        = totalRevenue - totalTax - totalExpenses;
  const txCount       = filteredInvoices.length;

  // Cashflow 30 ngày
  const dayMap    = buildLast30Days(invoices);
  const dayLabels = Object.keys(dayMap).map(k => new Date(k).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }));
  const lineData  = {
    labels: dayLabels,
    datasets: [{
      data: Object.values(dayMap),
      borderColor: '#00E5A0', backgroundColor: 'rgba(0,229,160,0.08)',
      tension: 0.4, fill: true, pointRadius: 0, pointHoverRadius: 4,
    }],
  };

  // Payment breakdown
  const pmCash = filteredInvoices.filter(i => i.paymentMethod === 'CASH').reduce((s, i) => s + i.total, 0);
  const pmQR   = filteredInvoices.filter(i => i.paymentMethod === 'QR_BANK').reduce((s, i) => s + i.total, 0);
  const pmCard = filteredInvoices.filter(i => i.paymentMethod === 'CARD').reduce((s, i) => s + i.total, 0);
  const payData = {
    labels: ['Tiền mặt', 'QR Bank', 'Thẻ'],
    datasets: [{
      data: [pmCash, pmQR, pmCard],
      backgroundColor: ['rgba(0,229,160,0.7)', 'rgba(0,196,255,0.7)', 'rgba(168,85,247,0.7)'],
      borderColor: ['#00E5A0', '#00C4FF', '#A855F7'], borderWidth: 1, borderRadius: 8,
    }],
  };

  return (
    <>
      {/* Period tabs */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div className="tabs" style={{ width: 'auto' }}>
          {[['day','Hôm nay'],['month','Tháng này'],['year','Năm nay']].map(([v, l]) => (
            <button key={v} className={`tab-btn${period === v ? ' active' : ''}`} onClick={() => setPeriod(v)} style={{ padding: '8px 10px', fontSize: 12 }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="stats-grid mb-6">{[1,2,3,4].map(i => <Skeleton key={i} />)}</div>
      ) : (
        <div className="stats-grid mb-6">
          <div className="card stat-card">
            <div className="stat-label">Doanh thu bán hàng</div>
            <div className="stat-value">{fmtNum(totalRevenue)} ₫</div>
            <div className="stat-change">{txCount} giao dịch</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Chi phí đã nhập</div>
            <div className="stat-value" style={{ color: 'var(--amber)' }}>{fmtNum(totalExpenses)} ₫</div>
            <div className="stat-change">{filteredExpenses.length} khoản chi</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Thuế ước tính</div>
            <div className="stat-value" style={{ color: 'var(--text-2)' }}>{fmtNum(totalTax)} ₫</div>
            <div className="stat-change">VAT + TNCN</div>
          </div>
          <div className="card card--accent stat-card" style={{ borderTop: '2px solid var(--accent)' }}>
            <div className="stat-label" style={{ fontWeight: 600 }}>Lợi nhuận thực tế</div>
            <div className="stat-value" style={{ color: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>{fmtNum(profit)} ₫</div>
            <div className="stat-change">Sau thuế &amp; chi phí</div>
          </div>
        </div>
      )}

      {/* Cashflow chart */}
      <div className="chart-container mb-4">
        <div className="chart-header">
          <div className="h3">Biến động doanh thu</div>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Cashflow 30 ngày</span>
        </div>
        {loading ? <Skeleton h={200} /> : <div style={{ height: 200 }}><Line data={lineData} options={CHART_BASE} /></div>}
      </div>

      {/* Payment breakdown */}
      <div className="chart-container mb-4">
        <div className="chart-header"><div className="h3">Phương thức thanh toán</div></div>
        {loading ? <Skeleton h={160} /> : <div style={{ height: 160 }}><Bar data={payData} options={CHART_BASE} /></div>}
      </div>

      {/* Recent transactions */}
      <div className="section-title mb-3">📋 Giao dịch bán hàng gần đây</div>
      <div className="card">
        {loading ? [1,2,3,4,5].map(i => (
          <div key={i} className="list-item">
            <div className="skeleton skeleton-avatar" />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text mb-2" style={{ width: '55%' }} />
              <div className="skeleton skeleton-text" style={{ width: '35%' }} />
            </div>
          </div>
        )) : filteredInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Chưa có giao dịch bán hàng</div>
            <div className="empty-body">Thực hiện bán lẻ qua hệ thống POS để thống kê doanh thu.</div>
          </div>
        ) : (
          filteredInvoices.slice(0, 30).map(inv => {
            const items  = inv.items || [];
            const pmIcon = inv.paymentMethod === 'CASH' ? '💵' : inv.paymentMethod === 'QR_BANK' ? '📱' : '💳';
            return (
              <div key={inv.id} className="list-item">
                <div className="list-icon">{pmIcon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>
                    {items.slice(0, 2).map(it => it.name).join(', ') || 'Hóa đơn bán lẻ'}
                    {items.length > 2 && ` +${items.length - 2}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {fmtDate(inv.createdAt)} · {items.reduce((s, it) => s + it.quantity, 0)} món
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--accent)', textAlign: 'right' }}>{fmtMoney(inv.total)}</div>
                  {inv.estimatedTax > 0 && <div style={{ fontSize: 10, color: 'var(--amber)', textAlign: 'right' }}>Thuế: {fmtMoney(inv.estimatedTax)}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

// ─── Tab: Báo cáo kỳ ─────────────────────────────────────────────────────────
function TabReport({ reportData, loading, reportParams, setReportParams }) {
  const now    = new Date();
  const curYear  = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const curQ     = Math.ceil(curMonth / 3);

  const years = [curYear, curYear - 1, curYear - 2];

  const { type, value, year } = reportParams;

  const data = reportData;

  // Grouped bar chart cho subPeriods
  const subData = data ? {
    labels: data.subPeriods.map(p => p.label),
    datasets: [
      {
        label: 'Doanh thu',
        data: data.subPeriods.map(p => p.revenue),
        backgroundColor: 'rgba(0,229,160,0.7)',
        borderColor: '#00E5A0', borderWidth: 1, borderRadius: 6,
      },
      {
        label: 'Chi phí',
        data: data.subPeriods.map(p => p.expenses),
        backgroundColor: 'rgba(255,179,71,0.7)',
        borderColor: '#FFB347', borderWidth: 1, borderRadius: 6,
      },
      {
        label: 'Lợi nhuận',
        data: data.subPeriods.map(p => p.profit),
        backgroundColor: 'rgba(0,196,255,0.7)',
        borderColor: '#00C4FF', borderWidth: 1, borderRadius: 6,
      },
    ],
  } : null;

  const typeLabels = { month: 'Tháng', quarter: 'Quý', year: 'Năm' };

  return (
    <>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div className="tabs" style={{ width: 'auto' }}>
          {['month','quarter','year'].map(t => (
            <button key={t} className={`tab-btn${type === t ? ' active' : ''}`}
              onClick={() => setReportParams(p => ({
                ...p, type: t,
                value: t === 'month' ? curMonth : t === 'quarter' ? curQ : curYear,
              }))}
              style={{ padding: '8px 12px', fontSize: 12 }}>
              {typeLabels[t]}
            </button>
          ))}
        </div>

        {type !== 'year' && (
          <select className="input" value={value}
            onChange={e => setReportParams(p => ({ ...p, value: Number(e.target.value) }))}
            style={{ width: 'auto', minWidth: 100, height: 36, fontSize: 12, padding: '0 10px' }}>
            {type === 'month'
              ? Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)
              : [1,2,3,4].map(q => <option key={q} value={q}>Quý {q}</option>)
            }
          </select>
        )}

        <select className="input" value={year}
          onChange={e => setReportParams(p => ({ ...p, year: Number(e.target.value) }))}
          style={{ width: 'auto', minWidth: 80, height: 36, fontSize: 12, padding: '0 10px' }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPIs with comparison */}
      {loading ? (
        <div className="stats-grid mb-6">{[1,2,3,4].map(i => <Skeleton key={i} />)}</div>
      ) : data ? (
        <div className="stats-grid mb-6">
          {[
            { label: 'Doanh thu', cur: data.revenue, prev: data.prevRevenue, color: 'var(--accent)' },
            { label: 'Chi phí',   cur: data.expenses, prev: data.prevExpenses, color: 'var(--amber)' },
            { label: 'Thuế',      cur: data.taxTotal, prev: null, color: 'var(--text-2)' },
            { label: 'Lợi nhuận', cur: data.profit,   prev: data.prevProfit, color: '#00C4FF', accent: true },
          ].map(({ label, cur, prev, color, accent }) => (
            <div key={label} className={`card stat-card${accent ? ' card--accent' : ''}`}
              style={accent ? { borderTop: '2px solid #00C4FF' } : {}}>
              <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{label}</span>
                {prev !== null && <DeltaBadge cur={cur} prev={prev} />}
              </div>
              <div className="stat-value" style={{ color }}>{fmtNum(cur)} ₫</div>
              {prev !== null && (
                <div className="stat-change" style={{ fontSize: 11 }}>Kỳ trước: {fmtNum(prev)} ₫</div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Profit trend chart */}
      <div className="chart-container mb-4" id="profit-chart">
        <div className="chart-header">
          <div className="h3">📈 Biểu đồ lợi nhuận</div>
          {data && <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{data.txCount} giao dịch</span>}
        </div>
        {loading ? <Skeleton h={220} /> : data && subData ? (
          <div style={{ height: 220 }}>
            <Bar data={subData} options={{
              ...CHART_BASE_GROUPED,
              plugins: { ...CHART_BASE_GROUPED.plugins, legend: { ...CHART_BASE_GROUPED.plugins.legend, display: true } },
            }} />
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-icon">📊</div>
            <div className="empty-title">Không có dữ liệu</div>
          </div>
        )}
      </div>

      {/* Payment breakdown */}
      {data && (
        <div className="card mb-4">
          <div style={{ padding: '14px 16px 4px', fontWeight: 700, fontSize: 13 }}>💳 Phương thức thanh toán</div>
          {[
            { label: 'Tiền mặt', val: data.paymentBreakdown?.cash || 0, color: '#00E5A0' },
            { label: 'QR Bank',  val: data.paymentBreakdown?.qr   || 0, color: '#00C4FF' },
            { label: 'Thẻ',      val: data.paymentBreakdown?.card || 0, color: '#A855F7' },
          ].map(({ label, val, color }) => {
            const total = data.revenue || 1;
            const pctVal = Math.round((val / total) * 100);
            return (
              <div key={label} style={{ padding: '10px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{fmtNum(val)} ₫ ({pctVal}%)</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pctVal}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Tab: Top sản phẩm ────────────────────────────────────────────────────────
function TabTopProducts({ reportData, loading }) {
  const products = reportData?.topProducts || [];
  const maxQty   = products[0]?.quantity || 1;

  const barData = {
    labels: products.map(p => p.name),
    datasets: [{
      label: 'Số lượng',
      data: products.map(p => p.quantity),
      backgroundColor: products.map((_, i) => `hsla(${160 - i * 15}, 80%, 55%, 0.75)`),
      borderRadius: 8,
      borderSkipped: false,
    }],
  };

  return (
    <>
      <div className="chart-container mb-4">
        <div className="chart-header">
          <div className="h3">🏆 Top sản phẩm bán chạy</div>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Theo số lượng</span>
        </div>
        {loading ? <Skeleton h={220} /> : products.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-icon">📦</div>
            <div className="empty-title">Chưa có dữ liệu</div>
          </div>
        ) : (
          <div style={{ height: 220 }}>
            <Bar data={barData} options={{
              ...CHART_BASE,
              indexAxis: 'y',
              scales: {
                x: { ...CHART_BASE.scales.x, ticks: { ...CHART_BASE.scales.x.ticks } },
                y: { grid: { display: false }, ticks: { color: '#8892B0', font: { size: 10 } } },
              },
              plugins: {
                ...CHART_BASE.plugins,
                tooltip: { ...CHART_BASE.plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} lượt` } },
              },
            }} />
          </div>
        )}
      </div>

      {/* Ranked list */}
      <div className="card">
        {loading ? [1,2,3,4,5].map(i => (
          <div key={i} className="list-item">
            <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text mb-2" style={{ width: '55%' }} />
              <div className="skeleton skeleton-text" style={{ width: '35%' }} />
            </div>
          </div>
        )) : products.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-icon">🛒</div>
            <div className="empty-title">Chưa có giao dịch trong kỳ này</div>
          </div>
        ) : (
          products.map((p, i) => (
            <div key={p.name} className="list-item" style={{ alignItems: 'center', gap: 12 }}>
              {/* Rank badge */}
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 13,
                background: i === 0 ? 'rgba(255,215,0,0.2)' : i === 1 ? 'rgba(192,192,192,0.2)' : i === 2 ? 'rgba(205,127,50,0.2)' : 'rgba(42,51,86,0.5)',
                color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text-2)',
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                {/* Progress bar */}
                <div style={{ height: 4, background: 'var(--bg)', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round((p.quantity / maxQty) * 100)}%`,
                    background: `hsl(${160 - i * 15}, 80%, 55%)`,
                    borderRadius: 4, transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{fmtNum(p.revenue)} ₫</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{p.quantity} lượt</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ─── Tab: Heatmap ─────────────────────────────────────────────────────────────
function TabHeatmap({ reportData, loading }) {
  const matrix = reportData?.hourlyHeatmap || null;
  const maxVal = matrix ? Math.max(...matrix.flat(), 1) : 1;

  const cellColor = (val) => {
    if (!val) return 'rgba(42,51,86,0.3)';
    const intensity = val / maxVal;
    // gradient: low = blue-ish teal, high = neon green
    const h = Math.round(160 - intensity * 60); // 160→100
    const l = Math.round(35 + intensity * 30);   // 35→65
    return `hsla(${h}, 80%, ${l}%, ${0.3 + intensity * 0.7})`;
  };

  const hourGroups = [
    { label: '🌙 Đêm',    hours: [0,1,2,3,4,5] },
    { label: '🌅 Sáng',   hours: [6,7,8,9,10,11] },
    { label: '☀️ Trưa',   hours: [12,13,14,15,16,17] },
    { label: '🌆 Tối',    hours: [18,19,20,21,22,23] },
  ];

  return (
    <div id="heatmap-section">
      <div className="chart-container mb-4" style={{ overflowX: 'auto' }}>
        <div className="chart-header">
          <div className="h3">🌡️ Heatmap doanh thu theo giờ</div>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Đậm = doanh thu cao</span>
        </div>

        {loading ? <Skeleton h={200} /> : !matrix ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-icon">📅</div>
            <div className="empty-title">Chưa có dữ liệu</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
            {/* Hour axis header — grouped */}
            <div style={{ display: 'flex', marginLeft: 28, marginBottom: 4 }}>
              {hourGroups.map(g => (
                <div key={g.label} style={{
                  flex: 1, textAlign: 'center',
                  fontSize: 10, color: 'var(--text-2)', fontWeight: 600,
                  borderLeft: '1px solid rgba(42,51,86,0.4)',
                  padding: '0 4px',
                }}>
                  {g.label}
                </div>
              ))}
            </div>

            {/* Hour numbers */}
            <div style={{ display: 'flex', marginLeft: 28, marginBottom: 4 }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{
                  width: 24, flexShrink: 0, textAlign: 'center',
                  fontSize: 9, color: 'var(--text-2)',
                }}>
                  {h % 3 === 0 ? `${h}h` : ''}
                </div>
              ))}
            </div>

            {/* Rows by day */}
            {DAYS_VN.map((day, di) => (
              <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                <div style={{ width: 24, flexShrink: 0, fontSize: 10, color: 'var(--text-2)', fontWeight: 600 }}>{day}</div>
                {Array.from({ length: 24 }, (_, h) => {
                  const val = matrix[di]?.[h] || 0;
                  return (
                    <div key={h} title={`${day} ${h}h: ${fmtNum(val)} ₫`} style={{
                      width: 24, height: 24, flexShrink: 0,
                      background: cellColor(val),
                      borderRadius: 4, margin: '0 1px',
                      cursor: val ? 'pointer' : 'default',
                      transition: 'opacity 0.2s',
                    }} />
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, marginLeft: 28 }}>
              <span style={{ fontSize: 10, color: 'var(--text-2)' }}>Thấp</span>
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map(v => (
                <div key={v} style={{
                  width: 20, height: 12, borderRadius: 3,
                  background: cellColor(v * maxVal),
                }} />
              ))}
              <span style={{ fontSize: 10, color: 'var(--text-2)' }}>Cao</span>
            </div>
          </div>
        )}
      </div>

      {/* Peak hour summary */}
      {matrix && !loading && (() => {
        let best = { day: 0, hour: 0, val: 0 };
        for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
          if ((matrix[d]?.[h] || 0) > best.val) best = { day: d, hour: h, val: matrix[d][h] };
        }
        if (!best.val) return null;
        return (
          <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Giờ vàng bán hàng</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {DAYS_VN[best.day]} lúc {best.hour}h — {best.hour + 1}h · {fmtNum(best.val)} ₫
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Tab: Chi phí ─────────────────────────────────────────────────────────────
function TabExpenses({ expenses, expensesLoading, onAdd, onDelete, periodFilter }) {
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState(periodFilter || 'month');

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const periodStart = new Date();
  if (filter === 'day') { periodStart.setHours(0, 0, 0, 0); }
  else if (filter === 'month') { periodStart.setDate(1); periodStart.setHours(0, 0, 0, 0); }
  else if (filter === 'year') { periodStart.setMonth(0); periodStart.setDate(1); periodStart.setHours(0, 0, 0, 0); }

  const filtered = expenses.filter(exp => {
    if (filter === 'day') return exp.date === todayStr;
    const d = new Date(exp.date); d.setHours(0, 0, 0, 0);
    return d >= periodStart;
  });
  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="tabs" style={{ width: 'auto' }}>
          {[['day','Hôm nay'],['month','Tháng này'],['year','Năm nay']].map(([v, l]) => (
            <button key={v} className={`tab-btn${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)} style={{ padding: '8px 10px', fontSize: 12 }}>{l}</button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(true)}
          style={{ height: 32, minHeight: 32, padding: '0 12px', fontSize: 12 }}>
          + Thêm chi phí
        </button>
      </div>

      {/* Total */}
      <div className="card mb-4" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Tổng chi phí ({filtered.length} khoản)</span>
        <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 18, color: 'var(--amber)' }}>{fmtNum(total)} ₫</span>
      </div>

      <div className="card">
        {expensesLoading ? [1,2,3].map(i => (
          <div key={i} className="list-item">
            <div className="skeleton skeleton-avatar" />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text mb-2" style={{ width: '55%' }} />
              <div className="skeleton skeleton-text" style={{ width: '35%' }} />
            </div>
          </div>
        )) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '36px 16px' }}>
            <div className="empty-icon" style={{ fontSize: 36 }}>💸</div>
            <div className="empty-title">Chưa có chi phí nào</div>
            <div className="empty-body" style={{ fontSize: 13 }}>
              Hãy nhập các khoản chi phí phát sinh để tính lợi nhuận chính xác.
            </div>
            <button className="btn btn-primary btn-sm mt-3" onClick={() => setShowAdd(true)}>+ Nhập chi phí đầu tiên</button>
          </div>
        ) : (
          filtered.map(exp => {
            const cat = EXPENSE_CATEGORIES[exp.category] || EXPENSE_CATEGORIES.OTHER;
            return (
              <div key={exp.id} className="list-item" style={{ alignItems: 'center', padding: '12px 16px' }}>
                <div style={{ background: 'var(--bg)', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {cat.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>{exp.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{fmtDate(exp.date)}</span>
                    <span className={`badge ${cat.badge}`} style={{ fontSize: 9, padding: '1px 6px' }}>{cat.label}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>-{fmtMoney(exp.amount)}</div>
                  <button onClick={() => onDelete(exp.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4, minHeight: 'auto' }}>
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onAdded={(e) => { onAdd(e); setShowAdd(false); }} />}
    </>
  );
}

// ─── Export Helpers ────────────────────────────────────────────────────────────
async function exportPDF(reportData, reportParams) {
  const { jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  const { type, value, year } = reportParams;
  const periodLabel = type === 'year' ? `Năm ${year}` : type === 'quarter' ? `Quý ${value}/${year}` : `Tháng ${value}/${year}`;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  let y = 15;

  // Title
  pdf.setFontSize(18);
  pdf.setTextColor(0, 229, 160);
  pdf.text('BÁO CÁO TÀI CHÍNH', pageW / 2, y, { align: 'center' });
  y += 8;
  pdf.setFontSize(11);
  pdf.setTextColor(136, 146, 176);
  pdf.text(periodLabel, pageW / 2, y, { align: 'center' });
  y += 10;

  // Divider
  pdf.setDrawColor(42, 51, 86);
  pdf.line(15, y, 195, y);
  y += 8;

  // KPI section
  const kpis = [
    ['Doanh thu', reportData.revenue],
    ['Chi phí',   reportData.expenses],
    ['Thuế',      reportData.taxTotal],
    ['Lợi nhuận', reportData.profit],
  ];
  pdf.setFontSize(10);
  kpis.forEach(([label, val], i) => {
    const x = 15 + (i % 2) * 95;
    if (i % 2 === 0 && i > 0) y += 18;
    pdf.setTextColor(136, 146, 176);
    pdf.text(label, x, y);
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.text(new Intl.NumberFormat('vi-VN').format(Math.round(val || 0)) + ' đ', x, y + 6);
    pdf.setFontSize(10);
  });
  y += 22;

  // Capture charts
  const chartEl = document.getElementById('profit-chart');
  const heatEl  = document.getElementById('heatmap-section');

  for (const el of [chartEl, heatEl].filter(Boolean)) {
    if (y > 240) { pdf.addPage(); y = 15; }
    try {
      const canvas = await html2canvas(el, { backgroundColor: '#141829', scale: 1.5 });
      const imgData = canvas.toDataURL('image/png');
      const ratio   = canvas.height / canvas.width;
      const imgW    = Math.min(180, pageW - 30);
      const imgH    = imgW * ratio;
      pdf.addImage(imgData, 'PNG', 15, y, imgW, imgH);
      y += imgH + 8;
    } catch { /* skip */ }
  }

  // Top products table
  if (reportData.topProducts?.length > 0) {
    if (y > 240) { pdf.addPage(); y = 15; }
    pdf.setFontSize(11);
    pdf.setTextColor(0, 229, 160);
    pdf.text('Top sản phẩm bán chạy', 15, y); y += 7;
    pdf.setFontSize(9);
    reportData.topProducts.slice(0, 10).forEach((p, i) => {
      pdf.setTextColor(136, 146, 176);
      pdf.text(`${i + 1}. ${p.name}`, 15, y);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`${p.quantity} lượt · ${new Intl.NumberFormat('vi-VN').format(Math.round(p.revenue))} đ`, 150, y, { align: 'right' });
      y += 5.5;
    });
  }

  pdf.save(`baocao-${type}-${value}-${year}.pdf`);
}

async function exportExcel(reportData, reportParams, expenses, invoices) {
  const { utils, writeFile } = await import('xlsx');
  const { type, value, year } = reportParams;

  const wb = utils.book_new();

  // Sheet 1: Tổng quan
  const overview = [
    ['Chỉ tiêu', 'Kỳ này', 'Kỳ trước'],
    ['Doanh thu', reportData.revenue, reportData.prevRevenue],
    ['Chi phí',   reportData.expenses, reportData.prevExpenses],
    ['Thuế',      reportData.taxTotal, ''],
    ['Lợi nhuận', reportData.profit,   reportData.prevProfit],
    ['Số giao dịch', reportData.txCount, ''],
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet(overview), 'Tổng quan');

  // Sheet 2: Trend
  const trendRows = [['Kỳ', 'Doanh thu', 'Chi phí', 'Lợi nhuận']].concat(
    reportData.subPeriods.map(p => [p.label, p.revenue, p.expenses, p.profit])
  );
  utils.book_append_sheet(wb, utils.aoa_to_sheet(trendRows), 'Xu hướng');

  // Sheet 3: Top sản phẩm
  const prodRows = [['Sản phẩm', 'Số lượng', 'Doanh thu']].concat(
    reportData.topProducts.map(p => [p.name, p.quantity, p.revenue])
  );
  utils.book_append_sheet(wb, utils.aoa_to_sheet(prodRows), 'Top sản phẩm');

  // Sheet 4: Chi phí
  const expRows = [['Ngày', 'Tên chi phí', 'Danh mục', 'Số tiền']].concat(
    expenses.map(e => [e.date, e.title, e.category, e.amount])
  );
  utils.book_append_sheet(wb, utils.aoa_to_sheet(expRows), 'Chi phí');

  // Sheet 5: Giao dịch
  const invRows = [['Thời gian', 'Thanh toán', 'Tổng tiền', 'Thuế']].concat(
    invoices.slice(0, 500).map(i => [
      new Date(i.createdAt).toLocaleString('vi-VN'),
      i.paymentMethod, i.total, i.estimatedTax || 0,
    ])
  );
  utils.book_append_sheet(wb, utils.aoa_to_sheet(invRows), 'Giao dịch');

  writeFile(wb, `baocao-${type}-${value}-${year}.xlsx`);
}

// ─── Main Finance Page ────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: '📊 Tổng quan' },
  { id: 'report',   label: '📈 Báo cáo' },
  { id: 'products', label: '🏆 Sản phẩm' },
  { id: 'heatmap',  label: '🌡️ Heatmap' },
  { id: 'expenses', label: '💸 Chi phí' },
];

export default function Finance() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [invoices, setInvoices]   = useState([]);
  const [expenses, setExpenses]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expLoading, setExpLoading] = useState(true);

  // Report state
  const now = new Date();
  const [reportParams, setReportParams] = useState({
    type:  'month',
    value: now.getMonth() + 1,
    year:  now.getFullYear(),
  });
  const [reportData,    setReportData]    = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load invoices
  useEffect(() => {
    posApi.getInvoices(1000)
      .then(d => setInvoices(d.invoices || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load expenses
  useEffect(() => {
    if (!user) return;
    posApi.getExpenses()
      .then(d => setExpenses(d.expenses || []))
      .catch(console.error)
      .finally(() => setExpLoading(false));
  }, [user]);

  // Fetch report whenever params change or tab switches to a report-related tab
  const fetchReport = useCallback(() => {
    setReportLoading(true);
    posApi.getReport(reportParams.type, reportParams.value, reportParams.year)
      .then(d => setReportData(d))
      .catch(console.error)
      .finally(() => setReportLoading(false));
  }, [reportParams]);

  useEffect(() => {
    if (['report', 'products', 'heatmap'].includes(activeTab)) {
      fetchReport();
    }
  }, [fetchReport, activeTab]);

  // Expense handlers
  const handleAddExpense = async (newExp) => {
    try {
      const res = await posApi.createExpense(newExp);
      if (res.expense) setExpenses(prev => [res.expense, ...prev]);
    } catch (err) { alert('Không thể thêm chi phí: ' + err.message); }
  };
  const handleDeleteExpense = async (id) => {
    if (confirm('Bạn có chắc chắn muốn xóa khoản chi này?')) {
      try {
        await posApi.deleteExpense(id);
        setExpenses(prev => prev.filter(e => e.id !== id));
      } catch (err) { alert('Không thể xóa chi phí: ' + err.message); }
    }
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    setExporting(true);
    try { await exportPDF(reportData, reportParams); }
    catch (e) { console.error(e); alert('Xuất PDF thất bại.'); }
    finally { setExporting(false); }
  };

  const handleExportExcel = async () => {
    if (!reportData) return;
    setExporting(true);
    try { await exportExcel(reportData, reportParams, expenses, invoices); }
    catch (e) { console.error(e); alert('Xuất Excel thất bại.'); }
    finally { setExporting(false); }
  };

  const showExport = ['report', 'products', 'heatmap'].includes(activeTab) && reportData;

  return (
    <div className="page-container page-enter">
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="page-title">Tài chính</div>
          <div className="page-sub">Phân tích doanh thu &amp; chi phí</div>
        </div>
        {showExport && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExportExcel} disabled={exporting}
              style={{ height: 34, padding: '0 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              {exporting ? '...' : '📊 Excel'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleExportPDF} disabled={exporting}
              style={{ height: 34, padding: '0 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              {exporting ? '...' : '📄 PDF'}
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ overflowX: 'auto', marginBottom: 20, paddingBottom: 2 }}>
        <div style={{ display: 'flex', gap: 4, width: 'max-content' }}>
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                background: activeTab === tab.id ? 'var(--accent)' : 'var(--card)',
                color: activeTab === tab.id ? '#0A0E1A' : 'var(--text-2)',
                transition: 'all 0.2s',
                boxShadow: activeTab === tab.id ? '0 2px 12px rgba(0,229,160,0.3)' : 'none',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <TabOverview invoices={invoices} expenses={expenses} loading={loading || expLoading} />
      )}
      {activeTab === 'report' && (
        <TabReport
          reportData={reportData} loading={reportLoading}
          reportParams={reportParams} setReportParams={setReportParams}
        />
      )}
      {activeTab === 'products' && (
        <TabTopProducts reportData={reportData} loading={reportLoading} />
      )}
      {activeTab === 'heatmap' && (
        <TabHeatmap reportData={reportData} loading={reportLoading} />
      )}
      {activeTab === 'expenses' && (
        <TabExpenses
          expenses={expenses} expensesLoading={expLoading}
          onAdd={handleAddExpense} onDelete={handleDeleteExpense}
        />
      )}
    </div>
  );
}
