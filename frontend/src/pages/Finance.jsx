import { useEffect, useState } from 'react';
import { posApi } from '../api/client';
import { fmtMoney, fmtDate } from '../utils/format';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, LineElement, PointElement,
  BarElement, Tooltip, Filler, Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, BarElement, Tooltip, Filler, Legend);

const CHART_OPTIONS_BASE = {
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
      callbacks: {
        label: (ctx) => ' ' + new Intl.NumberFormat('vi-VN').format(ctx.raw) + ' ₫',
      },
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

function buildLast30Days(invoices) {
  const map = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map[key] = 0;
  }
  invoices.forEach(inv => {
    const key = new Date(inv.createdAt).toISOString().slice(0, 10);
    if (key in map) map[key] += inv.total;
  });
  return map;
}

function buildPaymentBreakdown(invoices) {
  const cash = invoices.filter(i => i.paymentMethod === 'CASH').reduce((s, i) => s + i.total, 0);
  const qr   = invoices.filter(i => i.paymentMethod === 'QR_BANK').reduce((s, i) => s + i.total, 0);
  const card = invoices.filter(i => i.paymentMethod === 'CARD').reduce((s, i) => s + i.total, 0);
  return { cash, qr, card };
}

export default function Finance() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month'); // 'week' | 'month'

  useEffect(() => {
    posApi.getInvoices(200)
      .then(data => setInvoices(data.invoices || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Period filter ────────────────────────────────────────
  const now = new Date();
  const periodStart = new Date();
  if (period === 'week')  periodStart.setDate(now.getDate() - 6);
  if (period === 'month') periodStart.setDate(1);
  if (period === 'month') periodStart.setHours(0, 0, 0, 0);

  const filtered = invoices.filter(inv => new Date(inv.createdAt) >= periodStart);

  const totalRevenue = filtered.reduce((s, inv) => s + inv.total, 0);
  const totalTax     = filtered.reduce((s, inv) => s + (inv.estimatedTax || 0), 0);
  const netRevenue   = totalRevenue - totalTax;
  const txCount      = filtered.length;
  const avgTicket    = txCount ? Math.round(totalRevenue / txCount) : 0;

  // ── Cashflow chart (30 days) ─────────────────────────────
  const dayMap = buildLast30Days(invoices);
  const dayLabels = Object.keys(dayMap).map(k => {
    const d = new Date(k);
    return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
  });
  const dayValues = Object.values(dayMap);

  const lineData = {
    labels: dayLabels,
    datasets: [{
      data: dayValues,
      borderColor: '#00E5A0',
      backgroundColor: 'rgba(0,229,160,0.08)',
      tension: 0.4,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
    }],
  };

  // ── Payment breakdown ────────────────────────────────────
  const { cash, qr, card } = buildPaymentBreakdown(filtered);
  const payData = {
    labels: ['Tiền mặt', 'QR Bank', 'Thẻ'],
    datasets: [{
      data: [cash, qr, card],
      backgroundColor: ['rgba(0,229,160,0.7)', 'rgba(0,196,255,0.7)', 'rgba(168,85,247,0.7)'],
      borderColor: ['#00E5A0', '#00C4FF', '#A855F7'],
      borderWidth: 1,
      borderRadius: 8,
    }],
  };

  return (
    <div className="page-container page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Tài chính</div>
          <div className="page-sub">Phân tích doanh thu & chi phí</div>
        </div>
        <div className="tabs" style={{ width: 'auto' }}>
          <button className={`tab-btn${period === 'week' ? ' active' : ''}`} onClick={() => setPeriod('week')} style={{ padding: '8px 10px', fontSize: 12 }}>7 ngày</button>
          <button className={`tab-btn${period === 'month' ? ' active' : ''}`} onClick={() => setPeriod('month')} style={{ padding: '8px 10px', fontSize: 12 }}>Tháng này</button>
        </div>
      </div>

      {/* Stats row */}
      {loading ? (
        <div className="stats-grid mb-6">
          {[1,2,3,4].map(i => <div key={i} className="card skeleton" style={{ height: 90 }} />)}
        </div>
      ) : (
        <div className="stats-grid mb-6">
          <div className="card card--accent stat-card">
            <div className="stat-label">Doanh thu</div>
            <div className="stat-value">{new Intl.NumberFormat('vi-VN').format(totalRevenue)} ₫</div>
            <div className="stat-change">{txCount} giao dịch</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Thuế ước tính</div>
            <div className="stat-value" style={{ color: 'var(--amber)' }}>{new Intl.NumberFormat('vi-VN').format(totalTax)} ₫</div>
            <div className="stat-change">VAT + TNCN</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Doanh thu thuần</div>
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{new Intl.NumberFormat('vi-VN').format(netRevenue)} ₫</div>
            <div className="stat-change">Sau thuế</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Hoá đơn trung bình</div>
            <div className="stat-value">{new Intl.NumberFormat('vi-VN').format(avgTicket)} ₫</div>
            <div className="stat-change">Mỗi giao dịch</div>
          </div>
        </div>
      )}

      {/* Cashflow line chart */}
      <div className="chart-container mb-4">
        <div className="chart-header">
          <div className="h3">Doanh thu 30 ngày</div>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Cashflow</span>
        </div>
        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
        ) : (
          <div style={{ height: 200 }}>
            <Line data={lineData} options={CHART_OPTIONS_BASE} />
          </div>
        )}
      </div>

      {/* Payment method breakdown */}
      <div className="chart-container mb-4">
        <div className="chart-header">
          <div className="h3">Phương thức thanh toán</div>
        </div>
        {loading ? (
          <div className="skeleton" style={{ height: 160, borderRadius: 8 }} />
        ) : (
          <div style={{ height: 160 }}>
            <Bar data={payData} options={{ ...CHART_OPTIONS_BASE, plugins: { ...CHART_OPTIONS_BASE.plugins, legend: { display: false } } }} />
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div className="section-title mb-3">📋 Danh sách giao dịch</div>
      <div className="card">
        {loading ? (
          [1,2,3,4,5].map(i => (
            <div key={i} className="list-item">
              <div className="skeleton skeleton-avatar" />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text mb-2" style={{ width: '55%' }} />
                <div className="skeleton skeleton-text" style={{ width: '35%' }} />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Chưa có doanh thu</div>
            <div className="empty-body">Bắt đầu bán hàng từ màn hình Bán hàng để xem thống kê.</div>
          </div>
        ) : (
          filtered.slice(0, 30).map(inv => {
            const items = inv.items || [];
            const pmIcon = inv.paymentMethod === 'CASH' ? '💵' : inv.paymentMethod === 'QR_BANK' ? '📱' : '💳';
            return (
              <div key={inv.id} className="list-item">
                <div className="list-icon">{pmIcon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>
                    {items.slice(0, 2).map(it => it.name).join(', ') || 'Hóa đơn bán hàng'}
                    {items.length > 2 && ` +${items.length - 2}`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {fmtDate(inv.createdAt)} · {items.reduce((s, it) => s + it.quantity, 0)} món
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--accent)', textAlign: 'right' }}>
                    {fmtMoney(inv.total)}
                  </div>
                  {inv.estimatedTax > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--amber)', textAlign: 'right' }}>
                      Thuế: {fmtMoney(inv.estimatedTax)}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
