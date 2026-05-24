import { useState, useEffect } from 'react';
import { calendarApi } from '../api/client';
import { fmtDate, daysUntil, formatDaysLabel } from '../utils/format';

const TAX_TYPE_BADGE = {
  VAT:     'badge-vat',
  TNCN:    'badge-tncn',
  TNDN:    'badge-tndn',
  MON_BAI: 'badge-mon-bai',
  OTHER:   'badge-draft',
};

const TAX_TYPES_SELECT = ['VAT','TNCN','TNDN','MON_BAI','OTHER'];

function AddDeadlineModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ title: '', taxType: 'VAT', dueDate: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.dueDate) { setErr('Vui lòng điền đầy đủ thông tin.'); return; }
    setLoading(true);
    try {
      const data = await calendarApi.createDeadline(form);
      onAdded(data.deadline);
      onClose();
    } catch (err) { setErr(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="bottom-sheet-handle" />
        <div style={{ padding: '20px 20px 40px' }}>
          <div className="h2 mb-4">Thêm hạn nộp thuế</div>
          <form className="form-section" onSubmit={handleSubmit}>
            {err && <div className="error-msg">⚠️ {err}</div>}
            <div className="input-group">
              <label className="input-label">Tiêu đề</label>
              <input className="input" placeholder="Ví dụ: Nộp thuế GTGT Tháng 5" value={form.title} onChange={set('title')} />
            </div>
            <div className="form-row">
              <div className="input-group">
                <label className="input-label">Loại thuế</label>
                <select className="input" value={form.taxType} onChange={set('taxType')}>
                  {TAX_TYPES_SELECT.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Ngày hạn nộp</label>
                <input className="input" type="date" value={form.dueDate} onChange={set('dueDate')} />
              </div>
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? 'Đang tạo...' : '+ Tạo nhắc nhở'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function DeadlineCard({ d, onUpdate }) {
  const days = daysUntil(d.dueDate);
  const isPaid   = d.status === 'PAID';
  const isOver   = d.status === 'OVERDUE' || (days < 0 && !isPaid);
  const isNear   = !isPaid && !isOver && days <= 7;
  const [loading, setLoading] = useState(false);

  const dateObj = new Date(d.dueDate);
  const day = dateObj.getDate();
  const mon = dateObj.toLocaleDateString('vi-VN', { month: 'short' });

  const cardCls = isPaid ? '' : isOver ? 'card--red' : isNear ? 'card--amber' : 'card--accent';
  const countdownColor = isPaid ? 'var(--accent)' : isOver ? 'var(--red)' : isNear ? 'var(--amber)' : 'var(--text-2)';

  const toggle = async () => {
    const next = isPaid ? 'PENDING' : 'PAID';
    setLoading(true);
    try {
      const res = await calendarApi.updateStatus(d.id, next);
      onUpdate(res.deadline);
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className={`card deadline-card ${cardCls}`}>
      {/* Date box */}
      <div className="deadline-date-box">
        <div className="deadline-date-day" style={{ color: isPaid ? 'var(--accent)' : isOver ? 'var(--red)' : isNear ? 'var(--amber)' : 'var(--text-1)' }}>
          {day}
        </div>
        <div className="deadline-date-mon">{mon}</div>
      </div>

      {/* Info */}
      <div className="deadline-info">
        <div className="deadline-title">{d.title}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className={`badge ${TAX_TYPE_BADGE[d.taxType] || 'badge-draft'}`}>{d.taxType}</span>
          <span className={`badge ${isPaid ? 'badge-paid' : isOver ? 'badge-overdue' : 'badge-pending'}`}>
            {isPaid ? 'Đã nộp' : isOver ? 'Quá hạn' : 'Chờ nộp'}
          </span>
        </div>
        <div className="deadline-countdown" style={{ color: countdownColor }}>
          {isPaid ? `✓ Đã hoàn thành · ${fmtDate(d.dueDate)}` : formatDaysLabel(days)}
        </div>
      </div>

      {/* Action */}
      <div className="deadline-action">
        <button
          id={`toggle-deadline-${d.id}`}
          className={`btn btn-sm${isPaid ? ' btn-ghost' : ' btn-primary'}`}
          onClick={toggle}
          disabled={loading}
          style={{ minWidth: 'auto', width: 44, height: 44, padding: 0, borderRadius: 12 }}
        >
          {loading ? '…' : isPaid ? '↩' : '✓'}
        </button>
      </div>
    </div>
  );
}

export default function Calendar() {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'

  useEffect(() => {
    calendarApi.getDeadlines()
      .then(data => setDeadlines(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = (updated) => {
    setDeadlines(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  const handleAdded = (d) => {
    setDeadlines(prev => [...prev, d].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)));
  };

  const filtered = deadlines.filter(d => {
    if (filter === 'ALL') return true;
    if (filter === 'PAID') return d.status === 'PAID';
    if (filter === 'PENDING') return d.status === 'PENDING';
    if (filter === 'OVERDUE') {
      const days = daysUntil(d.dueDate);
      return d.status !== 'PAID' && (d.status === 'OVERDUE' || days < 0);
    }
    return true;
  });

  const pendingCount = deadlines.filter(d => d.status !== 'PAID').length;

  return (
    <div className="page-container page-enter">
      <div className="page-header">
        <div>
          <div className="page-title">Lịch biểu Thuế</div>
          <div className="page-sub">{pendingCount > 0 ? `${pendingCount} kỳ chưa nộp` : '✓ Đã hoàn thành tất cả'}</div>
        </div>
        <button id="add-deadline-btn" className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Thêm</button>
      </div>

      {/* Filter tabs */}
      <div className="tabs mb-4">
        {['ALL','PENDING','OVERDUE','PAID'].map(f => (
          <button
            key={f}
            id={`cal-filter-${f.toLowerCase()}`}
            className={`tab-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
            style={{ fontSize: 12, padding: '8px 10px' }}
          >
            {f === 'ALL' ? 'Tất cả' : f === 'PENDING' ? '⏳ Chờ nộp' : f === 'OVERDUE' ? '🔴 Quá hạn' : '✅ Đã nộp'}
          </button>
        ))}
      </div>

      {/* Deadlines list */}
      {loading ? (
        <div className="flex-col gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 90 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <div className="empty-title">
              {filter === 'PAID' ? 'Chưa nộp kỳ nào' : filter === 'OVERDUE' ? 'Không có kỳ quá hạn 🎉' : 'Không có lịch nộp'}
            </div>
            <div className="empty-body">
              {filter === 'ALL' ? 'Thêm mốc hạn nộp thuế để nhận nhắc nhở kịp thời.' : ''}
            </div>
            {filter === 'ALL' && (
              <button className="btn btn-primary btn-sm mt-3" onClick={() => setShowAdd(true)}>+ Thêm ngay</button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-col gap-3">
          {filtered.map(d => (
            <DeadlineCard key={d.id} d={d} onUpdate={handleUpdate} />
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="card mt-4" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>📋 Lịch nộp thuế khoán 2026</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12, color: 'var(--text-2)' }}>
          <div>Môn bài: <strong style={{ color: 'var(--text-1)' }}>30/01/2026</strong></div>
          <div>Quý 1: <strong style={{ color: 'var(--text-1)' }}>30/04/2026</strong></div>
          <div>Quý 2: <strong style={{ color: 'var(--text-1)' }}>31/07/2026</strong></div>
          <div>Quý 3: <strong style={{ color: 'var(--text-1)' }}>31/10/2026</strong></div>
          <div>Quý 4: <strong style={{ color: 'var(--text-1)' }}>30/01/2027</strong></div>
          <div>QT TNCN: <strong style={{ color: 'var(--text-1)' }}>31/03/2027</strong></div>
        </div>
      </div>

      {showAdd && <AddDeadlineModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
    </div>
  );
}
