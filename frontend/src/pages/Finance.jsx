import { useEffect, useState } from 'react';
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

const EXPENSE_CATEGORIES = {
  OPERATING: { label: '🏢 Vận hành', badge: 'badge-tndn', icon: '🏢' },
  MATERIAL:  { label: '📦 Nguyên liệu', badge: 'badge-product', icon: '📦' },
  SALARY:    { label: '👥 Nhân sự', badge: 'badge-service', icon: '👥' },
  OTHER:     { label: '🌀 Khác', badge: 'badge-draft', icon: '🌀' },
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

// ── AddExpenseModal (Bottom Sheet) ────────────────────────────
function AddExpenseModal({ onClose, onAdded }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('OPERATING');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const parsedAmount = parseFloat(amount);

    if (!cleanTitle) {
      setErr('Vui lòng nhập tên chi phí.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErr('Vui lòng nhập số tiền chi phí.');
      return;
    }

    onAdded({
      id: `exp_${Date.now()}`,
      title: cleanTitle,
      amount: parsedAmount,
      category,
      date,
    });
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
              <input 
                className="input" 
                placeholder="Ví dụ: Tiền mua nguyên vật liệu, tiền điện nước..." 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
              />
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label className="input-label">Số tiền (₫)</label>
                <input 
                  className="input" 
                  type="number" 
                  placeholder="500000" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  inputMode="numeric" 
                />
              </div>
              <div className="input-group">
                <label className="input-label">Danh mục</label>
                <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="OPERATING">🏢 Vận hành (Mặt bằng, điện nước)</option>
                  <option value="MATERIAL">📦 Hàng hóa / Nguyên liệu</option>
                  <option value="SALARY">👥 Lương / Nhân sự</option>
                  <option value="OTHER">🌀 Khác / Phát sinh</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Ngày chi trả</label>
              <input 
                className="input" 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
              />
            </div>

            <button className="btn btn-primary w-full mt-4" type="submit" style={{ height: '52px' }}>
              ✓ Xác nhận chi
            </button>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
}

export default function Finance() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month'); // 'week' | 'month'
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Load/save expenses state from backend database API
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setExpensesLoading(true);
      posApi.getExpenses()
        .then(data => {
          setExpenses(data.expenses || []);
        })
        .catch(err => {
          console.error('[Finance] Error loading expenses:', err);
        })
        .finally(() => setExpensesLoading(false));
    }
  }, [user]);

  const handleAddExpense = async (newExp) => {
    try {
      const res = await posApi.createExpense(newExp);
      if (res.expense) {
        setExpenses(prev => [res.expense, ...prev]);
      }
    } catch (err) {
      alert('Không thể thêm chi phí: ' + err.message);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (confirm('Bạn có chắc chắn muốn xóa khoản chi này?')) {
      try {
        await posApi.deleteExpense(id);
        setExpenses(prev => prev.filter(e => e.id !== id));
      } catch (err) {
        alert('Không thể xóa chi phí: ' + err.message);
      }
    }
  };

  useEffect(() => {
    posApi.getInvoices(200)
      .then(data => setInvoices(data.invoices || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Period filter ────────────────────────────────────────
  const now = new Date();
  const periodStart = new Date();
  
  if (period === 'day') {
    periodStart.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
  } else if (period === 'year') {
    periodStart.setMonth(0);
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);
  }

  // Filter invoices & expenses based on timeframe
  const todayStr = now.toISOString().slice(0, 10);
  const filteredInvoices = invoices.filter(inv => new Date(inv.createdAt) >= periodStart);
  const filteredExpenses = expenses.filter(exp => {
    if (period === 'day') {
      return exp.date === todayStr;
    }
    // Set hours to 0 to compare clean dates
    const expDate = new Date(exp.date);
    expDate.setHours(0, 0, 0, 0);
    return expDate >= periodStart;
  });

  // Calculations
  const totalRevenue = filteredInvoices.reduce((s, inv) => s + inv.total, 0);
  const totalTax     = filteredInvoices.reduce((s, inv) => s + (inv.estimatedTax || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, exp) => s + exp.amount, 0);
  
  const netRevenue   = totalRevenue - totalTax;
  const profit       = netRevenue - totalExpenses;
  
  const txCount      = filteredInvoices.length;

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
  const { cash, qr, card } = buildPaymentBreakdown(filteredInvoices);
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
          <button className={`tab-btn${period === 'day' ? ' active' : ''}`} onClick={() => setPeriod('day')} style={{ padding: '8px 10px', fontSize: 12 }}>Hôm nay</button>
          <button className={`tab-btn${period === 'month' ? ' active' : ''}`} onClick={() => setPeriod('month')} style={{ padding: '8px 10px', fontSize: 12 }}>Tháng này</button>
          <button className={`tab-btn${period === 'year' ? ' active' : ''}`} onClick={() => setPeriod('year')} style={{ padding: '8px 10px', fontSize: 12 }}>Năm nay</button>
        </div>
      </div>

      {/* Stats row */}
      {loading || expensesLoading ? (
        <div className="stats-grid mb-6">
          {[1,2,3,4].map(i => <div key={i} className="card skeleton" style={{ height: 90 }} />)}
        </div>
      ) : (
        <div className="stats-grid mb-6">
          <div className="card stat-card">
            <div className="stat-label">Doanh thu bán hàng</div>
            <div className="stat-value">{new Intl.NumberFormat('vi-VN').format(totalRevenue)} ₫</div>
            <div className="stat-change">{txCount} giao dịch</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Chi phí đã nhập</div>
            <div className="stat-value" style={{ color: 'var(--amber)' }}>{new Intl.NumberFormat('vi-VN').format(totalExpenses)} ₫</div>
            <div className="stat-change">{filteredExpenses.length} khoản chi</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">Thuế ước tính</div>
            <div className="stat-value" style={{ color: 'var(--text-2)' }}>{new Intl.NumberFormat('vi-VN').format(totalTax)} ₫</div>
            <div className="stat-change">VAT + TNCN</div>
          </div>
          <div className="card card--accent stat-card" style={{ borderTop: '2px solid var(--accent)' }}>
            <div className="stat-label" style={{ fontWeight: 600 }}>Lợi nhuận thực tế</div>
            <div className="stat-value" style={{ color: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>
              {new Intl.NumberFormat('vi-VN').format(profit)} ₫
            </div>
            <div className="stat-change">Sau thuế & chi phí</div>
          </div>
        </div>
      )}

      {/* Cashflow line chart */}
      <div className="chart-container mb-4">
        <div className="chart-header">
          <div className="h3">Biến động doanh thu</div>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Cashflow 30 ngày</span>
        </div>
        {loading ? (
          <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
        ) : (
          <div style={{ height: 200 }}>
            <Line data={lineData} options={CHART_OPTIONS_BASE} />
          </div>
        )}
      </div>

      {/* 💸 Expense Management Section */}
      <div className="section-title mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>💸 Quản lý chi phí</span>
        <button 
          className="btn btn-ghost btn-sm" 
          onClick={() => setShowAddExpense(true)}
          style={{ height: '32px', minHeight: '32px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
        >
          + Thêm chi phí
        </button>
      </div>

      <div className="card mb-6">
        {expensesLoading ? (
          [1,2].map(i => (
            <div key={i} className="list-item">
              <div className="skeleton skeleton-avatar" />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text mb-2" style={{ width: '55%' }} />
                <div className="skeleton skeleton-text" style={{ width: '35%' }} />
              </div>
            </div>
          ))
        ) : filteredExpenses.length === 0 ? (
          <div className="empty-state" style={{ padding: '36px 16px' }}>
            <div className="empty-icon" style={{ fontSize: '36px' }}>💸</div>
            <div className="empty-title">Chưa có chi phí nào</div>
            <div className="empty-body" style={{ fontSize: '13px' }}>
              Hãy nhập các khoản chi phí phát sinh (mặt bằng, điện nước, nguyên liệu...) để tính toán lợi nhuận chính xác.
            </div>
            <button className="btn btn-primary btn-sm mt-3" onClick={() => setShowAddExpense(true)}>
              + Nhập chi phí đầu tiên
            </button>
          </div>
        ) : (
          filteredExpenses.map(exp => {
            const cat = EXPENSE_CATEGORIES[exp.category] || EXPENSE_CATEGORIES.OTHER;
            return (
              <div key={exp.id} className="list-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                <div className="list-icon" style={{ background: 'var(--bg)', borderRadius: '12px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  {cat.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0, marginLeft: '12px' }}>
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 600 }}>
                    {exp.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                      {fmtDate(exp.date)}
                    </span>
                    <span className={`badge ${cat.badge}`} style={{ fontSize: 9, padding: '1px 6px' }}>
                      {cat.label}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14, color: 'var(--text-1)', textAlign: 'right' }}>
                    -{fmtMoney(exp.amount)}
                  </div>
                  <button 
                    onClick={() => handleDeleteExpense(exp.id)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '4px', minHeight: 'auto' }}
                    aria-label="Xóa chi phí"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
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
      <div className="section-title mb-3">📋 Giao dịch bán hàng gần đây</div>
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
        ) : filteredInvoices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">Chưa có giao dịch bán hàng</div>
            <div className="empty-body">Thực hiện bán lẻ qua hệ thống POS để thống kê doanh thu.</div>
          </div>
        ) : (
          filteredInvoices.slice(0, 30).map(inv => {
            const items = inv.items || [];
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

      {showAddExpense && (
        <AddExpenseModal 
          onClose={() => setShowAddExpense(false)}
          onAdded={handleAddExpense}
        />
      )}
    </div>
  );
}
