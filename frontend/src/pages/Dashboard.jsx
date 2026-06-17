import { useEffect, useRef, useState } from 'react';
import { posApi } from '../api/client';
import { calendarApi } from '../api/client';
import { fmtMoney, fmtDate, fmtTime, daysUntil, formatDaysLabel, animateCountUp } from '../utils/format';
import { useAuth } from '../store/authStore';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Tooltip, Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Filler);

// ── Skeleton cards ────────────────────────────────────────────
function StatSkeleton() {
  return (
    <div className="card stat-card">
      <div className="skeleton skeleton-text mb-2" style={{ width: '60%' }} />
      <div className="skeleton skeleton-title" style={{ width: '80%' }} />
    </div>
  );
}

// ── Count-up stat card (R24) ──────────────────────────────────
function StatCard({ label, value, sub, accent = true }) {
  const ref = useRef(null);
  useEffect(() => {
    if (value != null) animateCountUp(ref.current, value);
  }, [value]);

  return (
    <div className={`card stat-card${accent ? ' card--accent' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" ref={ref}>0 ₫</div>
      {sub && <div className="stat-change">{sub}</div>}
    </div>
  );
}

// ── Deadline mini card ────────────────────────────────────────
function DeadlineMini({ d }) {
  const days = daysUntil(d.dueDate);
  const isPaid = d.status === 'PAID';
  const isOver = d.status === 'OVERDUE' || (days < 0 && !isPaid);
  const isNear = !isPaid && !isOver && days <= 14;

  let cls = 'card--accent';
  if (isPaid) cls = '';
  else if (isOver) cls = 'card--red';
  else if (isNear) cls = 'card--amber';

  return (
    <div className={`card ${cls} flex items-center gap-3`} style={{ padding: '12px 14px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>{d.title}</div>
        <div style={{ fontSize: 11, color: isPaid ? 'var(--accent)' : isOver ? 'var(--red)' : isNear ? 'var(--amber)' : 'var(--text-2)', marginTop: 2 }}>
          {isPaid ? '✓ Đã nộp' : formatDaysLabel(days)}
        </div>
      </div>
      <span className={`badge ${isPaid ? 'badge-paid' : isOver ? 'badge-overdue' : 'badge-pending'}`}>
        {isPaid ? 'Đã nộp' : isOver ? 'Quá hạn' : 'Chờ nộp'}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      posApi.getInvoices(100),
      calendarApi.getDeadlines(),
    ]).then(([posData, calData]) => {
      setInvoices(posData.invoices || []);
      setDeadlines(calData || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Compute stats ──────────────────────────────────────────
  const today = new Date().toDateString();
  const todayInvoices = invoices.filter(inv => new Date(inv.createdAt).toDateString() === today);
  const todayRevenue = todayInvoices.reduce((s, inv) => s + inv.total, 0);

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthInvoices = invoices.filter(inv => new Date(inv.createdAt) >= monthStart);
  const monthRevenue = monthInvoices.reduce((s, inv) => s + inv.total, 0);
  const monthTax = monthInvoices.reduce((s, inv) => s + (inv.estimatedTax || 0), 0);

  // ── Bar chart: revenue last 7 days ────────────────────────
  const labels = [];
  const revenueData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric' });
    labels.push(label);
    const dayStr = d.toDateString();
    const dayTotal = invoices
      .filter(inv => new Date(inv.createdAt).toDateString() === dayStr)
      .reduce((s, inv) => s + inv.total, 0);
    revenueData.push(dayTotal);
  }

  const chartData = {
    labels,
    datasets: [{
      label: 'Doanh thu',
      data: revenueData,
      backgroundColor: 'rgba(26, 143, 227, 0.28)',
      borderColor: '#1A8FE3',
      borderWidth: 2,
      borderRadius: 8,
      borderSkipped: false,
    }],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }, tooltip: {
        backgroundColor: 'rgba(12, 33, 55, 0.92)',
        borderColor: 'rgba(26, 143, 227, 0.40)',
        borderWidth: 1,
        titleColor: '#94C4E8',
        bodyColor: '#FFFFFF',
        callbacks: {
          label: (ctx) => ' ' + new Intl.NumberFormat('vi-VN').format(ctx.raw) + ' ₫',
        },
      }
    },
    scales: {
      x: { grid: { color: 'rgba(148, 196, 232, 0.30)' }, ticks: { color: '#5A7A96', font: { size: 10 } } },
      y: {
        grid: { color: 'rgba(148, 196, 232, 0.30)' }, ticks: {
          color: '#5A7A96', font: { size: 10 },
          callback: (v) => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(v) + ' ₫'
        }
      },
    },
  };

  // Upcoming deadlines (not paid, sorted by due date, first 3)
  const upcoming = deadlines
    .filter(d => d.status !== 'PAID')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);

  return (
    <div className="page-container page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Tổng quan</div>
          <div className="page-sub">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['🍜 Quán ăn', '✂️ Tiệm tóc', '🔧 Sửa xe'].map(t => (
              <span key={t} className="badge badge-draft" style={{ fontSize: 10 }}>{t}</span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 28 }}>📊</div>
      </div>

      {/* Stats */}
      <div className="stats-grid mb-6">
        {loading ? (
          <><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
        ) : (
          <>
            <StatCard label="Doanh thu hôm nay" value={todayRevenue} sub={`${todayInvoices.length} hóa đơn`} />
            <StatCard label="Doanh thu tháng này" value={monthRevenue} sub={`${monthInvoices.length} giao dịch`} />
            <StatCard label="Thuế ước tính tháng" value={monthTax} sub="VAT + TNCN ước tính" accent={false} />
          </>
        )}
      </div>

      {/* Monthly Revenue Goal Tracker Card */}
      {!loading && user?.revenueGoal > 0 && (() => {
        const goalVal = user.revenueGoal;
        const percent = Math.min(Math.round((monthRevenue / goalVal) * 100), 100);
        return (
          <div className="card mb-6 animate-fade-in" style={{
            background: 'linear-gradient(135deg, rgba(26, 143, 227, 0.08) 0%, rgba(255, 255, 255, 0.75) 100%)',
            border: '1px solid rgba(26, 143, 227, 0.28)',
            boxShadow: '0 8px 32px rgba(26, 143, 227, 0.12)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
                  🎯 Mục tiêu doanh thu tháng
                </span>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>
                  {new Intl.NumberFormat('vi-VN').format(monthRevenue)} ₫ <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-2)' }}>/ {new Intl.NumberFormat('vi-VN').format(goalVal)} ₫</span>
                </div>
              </div>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 800, color: 'var(--accent)',
                background: 'var(--accent-dim)', padding: '6px 12px', borderRadius: 12, border: '1px solid rgba(0, 229, 160, 0.15)'
              }}>
                {percent}%
              </div>
            </div>

            <div style={{
              width: '100%', height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden',
              position: 'relative', border: '1px solid var(--border)'
            }}>
              <div style={{
                width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent) 0%, var(--cyan) 100%)',
                borderRadius: 5, transition: 'width 800ms cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 12px rgba(0, 229, 160, 0.4)'
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>Đạt {percent}% chỉ tiêu tháng này</span>
              <span>Còn lại {new Intl.NumberFormat('vi-VN').format(Math.max(0, goalVal - monthRevenue))} ₫</span>
            </div>
          </div>
        );
      })()}

      {/* Chart */}
      <div className="chart-container mb-6">
        <div className="chart-header">
          <div className="h3">Doanh thu 7 ngày qua</div>
          <span className="badge badge-vat">Biểu đồ</span>
        </div>
        {loading ? (
          <div className="skeleton" style={{ height: 180, borderRadius: 12 }} />
        ) : (
          <div style={{ height: 180 }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}
      </div>

      {/* Upcoming deadlines */}
      <div>
        <div className="section-title mb-3">⏰ Hạn nộp thuế sắp tới</div>
        {loading ? (
          <div className="flex-col gap-3">
            <div className="skeleton skeleton-card" style={{ height: 64 }} />
            <div className="skeleton skeleton-card" style={{ height: 64 }} />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🛝</div>
              <div className="empty-title">Không có hạn nộp nào!</div>
              <div className="empty-body">Bạn đã hoàn thành tất cả nghĩa vụ thuế.</div>
            </div>
          </div>
        ) : (
          <div className="flex-col gap-3">
            {upcoming.map(d => <DeadlineMini key={d.id} d={d} />)}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="mt-4">
        <div className="section-title mb-3">🧾 Giao dịch gần đây</div>
        <div className="card">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="list-item">
                <div className="skeleton skeleton-avatar" />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text mb-2" style={{ width: '60%' }} />
                  <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                </div>
              </div>
            ))
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 36 }}>🛍</div>
              <div className="empty-title">Chưa có giao dịch</div>
              <div className="empty-body">
                Bắt đầu bán hàng từ màn hình <strong>Bán hàng</strong>.<br />
                <span style={{ fontSize: 12 }}>Món ăn · Cắt tóc · Sửa xe · Vật tư</span>
              </div>
            </div>
          ) : (
            invoices.slice(0, 8).map(inv => (
              <div key={inv.id} className="list-item">
                <div className="list-icon">
                  {inv.paymentMethod === 'CASH' ? '💵' : inv.paymentMethod === 'QR_BANK' ? '📱' : '💳'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {(inv.items || []).map(it => it.name).slice(0, 2).join(', ') || 'Hóa đơn bán hàng'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {fmtDate(inv.createdAt)} · {fmtTime(inv.createdAt)}
                  </div>
                </div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                  {fmtMoney(inv.total)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
