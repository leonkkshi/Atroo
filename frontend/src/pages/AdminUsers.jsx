import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api/client';

// ── Helpers ───────────────────────────────────────────────────
const BIZ_LABELS = {
  '1': '🛒 Thương mại',
  '2': '✂️ Dịch vụ',
  '3': '🍔 Sản xuất',
  '4': '💼 Khác',
};

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function fmtRelative(dateStr) {
  if (!dateStr) return 'Chưa hoạt động';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 30) return `${days} ngày trước`;
  return fmtDate(dateStr);
}

/** Chuyển seconds → "Xh Ym" */
function fmtDuration(seconds) {
  if (!seconds || seconds === 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}p`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}p`;
}

/** Chuyển seconds → "Xh Ym Zs" đầy đủ */
function fmtDurationFull(seconds) {
  if (!seconds || seconds === 0) return '0 phút';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0 && m === 0) return '< 1 phút';
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

function getInitial(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts[parts.length - 1][0].toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────
function StatCard({ icon, label, value, accent, loading }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
      padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
      borderTop: accent ? '2px solid var(--accent)' : undefined,
      transition: 'transform var(--dur-comp) var(--ease)',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14, background: 'rgba(0,229,160,0.1)',
        border: '1px solid rgba(0,229,160,0.2)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 22, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'DM Sans, sans-serif', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </div>
        {loading
          ? <div className="skeleton" style={{ width: 48, height: 28, borderRadius: 8 }} />
          : <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Syne, Space Grotesk, sans-serif', color: 'var(--accent)', lineHeight: 1 }}>
            {value}
          </div>
        }
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const isActive = status === 'ACTIVE';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: isActive ? 'rgba(0,229,160,0.12)' : 'rgba(239,68,68,0.12)',
      color: isActive ? 'var(--accent)' : 'var(--red)',
      border: `1px solid ${isActive ? 'rgba(0,229,160,0.25)' : 'rgba(239,68,68,0.25)'}`,
      letterSpacing: '0.05em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {isActive ? 'Hoạt động' : 'Đã khóa'}
    </span>
  );
}

function RoleBadge({ role }) {
  if (role !== 'ADMIN') return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
      background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
      border: '1px solid rgba(245,158,11,0.25)', letterSpacing: '0.06em',
    }}>
      👑 ADMIN
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <div className="skeleton" style={{ height: 18, borderRadius: 8, width: i === 1 ? 140 : 80 }} />
        </td>
      ))}
    </tr>
  );
}

// ── Mini Bar Chart (7 ngày) ───────────────────────────────────
function MiniBarChart({ data, height = 60, color = 'var(--accent)' }) {
  if (!data || data.length === 0) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 12 }}>
      Chưa có dữ liệu
    </div>
  );

  const maxVal = Math.max(...data.map(d => d.duration), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, padding: '4px 0' }}>
      {data.map((d, i) => {
        const barH = Math.max(3, (d.duration / maxVal) * (height - 20));
        const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short' });
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}
            title={`${d.date}: ${fmtDurationFull(d.duration)}`}>
            <div style={{
              width: '100%', height: barH, borderRadius: '4px 4px 2px 2px',
              background: d.duration > 0 ? color : 'var(--border)',
              opacity: d.duration > 0 ? 0.85 : 0.3,
              transition: 'height 0.3s ease',
            }} />
            <span style={{ fontSize: 9, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── User Detail Modal ─────────────────────────────────────────
function UserDetailModal({ userId, onClose, onStatusChange, onDelete }) {
  const [detail, setDetail] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      adminApi.getUserDetail(userId),
      adminApi.getUserUsage(userId),
    ])
      .then(([d, u]) => { setDetail(d); setUsage(u); })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleStatusToggle = async () => {
    if (!detail) return;
    const newStatus = detail.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setActionLoading(true);
    try {
      await adminApi.updateUserStatus(detail.id, newStatus);
      setDetail(d => ({ ...d, status: newStatus }));
      onStatusChange?.(detail.id, newStatus);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setActionLoading(true);
    try {
      await adminApi.deleteUser(detail.id);
      onDelete?.(detail.id);
      onClose();
    } catch (err) {
      alert(err.message);
      setActionLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }} onClick={e => { if (e.target === e.currentTarget) { onClose(); setConfirmDelete(false); } }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '24px 24px 0 0',
        width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
        padding: '28px 24px 40px', borderTop: '2px solid var(--accent)',
        animation: 'slideUp 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 24px' }} />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 14 }} />)}
          </div>
        ) : !detail ? (
          <div style={{ textAlign: 'center', color: 'var(--red)', padding: '32px 0' }}>
            ⚠️ Không thể tải thông tin người dùng
          </div>
        ) : (
          <>
            {/* Avatar + Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,229,160,0.1)',
                border: '2px solid var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 26, fontWeight: 700,
                color: 'var(--accent)', fontFamily: 'Syne, sans-serif', flexShrink: 0,
              }}>
                {getInitial(detail.businessName)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)' }}>
                    {detail.businessName}
                  </div>
                  <RoleBadge role={detail.role} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <StatusBadge status={detail.status} />
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Loại hình', value: BIZ_LABELS[detail.businessType] || '—' },
                { label: 'Điện thoại', value: detail.phone || '—' },
                { label: 'Ngày tạo', value: fmtDate(detail.createdAt) },
                { label: 'Hoạt động cuối', value: fmtRelative(detail.lastActiveAt) },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: 'var(--bg)', borderRadius: 12, padding: '10px 14px',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Stats Row */}
            <div style={{
              background: 'var(--bg)', borderRadius: 14, padding: '14px 16px',
              display: 'flex', gap: 0, marginBottom: 20,
            }}>
              {[
                { label: 'Tờ khai', value: detail.stats?.declarationCount ?? 0, icon: '📋' },
                { label: 'Hóa đơn', value: detail.stats?.invoiceCount ?? 0, icon: '🧾' },
                { label: 'Đơn POS', value: detail.stats?.posInvoiceCount ?? 0, icon: '🛒' },
              ].map(({ label, value, icon }, idx) => (
                <div key={label} style={{
                  flex: 1, textAlign: 'center', padding: '4px 0',
                  borderRight: idx < 2 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>{value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* ── Thống kê thời gian dùng ── */}
            <div style={{
              background: 'var(--bg)', borderRadius: 16, padding: '16px',
              marginBottom: 20, border: '1px solid rgba(0,229,160,0.1)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
              }}>
                <span style={{ fontSize: 16 }}>⏱️</span>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                  Thời gian sử dụng
                </span>
              </div>

              {/* 4 số liệu */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Tổng thời gian', value: fmtDurationFull(usage?.totalDuration), icon: '🕐' },
                  { label: 'Tổng phiên', value: `${usage?.totalSessions ?? 0} lần`, icon: '🔑' },
                  { label: '7 ngày qua', value: fmtDurationFull(usage?.last7Days?.duration), icon: '📅' },
                  { label: 'TB / phiên', value: fmtDurationFull(usage?.avgDuration), icon: '⚡' },
                ].map(({ label, value, icon }) => (
                  <div key={label} style={{
                    background: 'var(--surface)', borderRadius: 10, padding: '10px 12px',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{icon}</span>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* 30 ngày */}
              <div style={{
                background: 'rgba(0,229,160,0.06)', borderRadius: 10, padding: '10px 12px',
                marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: '1px solid rgba(0,229,160,0.15)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>📆 30 ngày qua</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>
                  {fmtDurationFull(usage?.last30Days?.duration)}
                  <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 400, marginLeft: 6 }}>
                    ({usage?.last30Days?.sessions ?? 0} phiên)
                  </span>
                </div>
              </div>

              {/* Mini Bar Chart */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Biểu đồ 7 ngày gần nhất
                </div>
                <MiniBarChart data={usage?.dailyUsage} height={70} />
              </div>
            </div>

            {/* Address */}
            {detail.address && (
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 14px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 3 }}>📍 Địa chỉ</div>
                <div style={{ fontSize: 13, color: 'var(--text-1)' }}>{detail.address}</div>
              </div>
            )}

            {/* Actions */}
            {detail.role !== 'ADMIN' && (
              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <button
                  onClick={handleStatusToggle}
                  disabled={actionLoading}
                  style={{
                    width: '100%', height: 48, borderRadius: 14, border: 'none',
                    background: detail.status === 'ACTIVE' ? 'rgba(239,68,68,0.12)' : 'rgba(0,229,160,0.12)',
                    color: detail.status === 'ACTIVE' ? 'var(--red)' : 'var(--accent)',
                    fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: `1px solid ${detail.status === 'ACTIVE' ? 'rgba(239,68,68,0.3)' : 'rgba(0,229,160,0.3)'}`,
                  }}>
                  {actionLoading ? '...' : detail.status === 'ACTIVE' ? '🔒 Khóa tài khoản' : '🔓 Mở khóa tài khoản'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  style={{
                    width: '100%', height: 48, borderRadius: 14,
                    background: confirmDelete ? 'var(--red)' : 'transparent',
                    color: confirmDelete ? '#fff' : 'var(--red)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                  {actionLoading ? '...' : confirmDelete ? '⚠️ Xác nhận xóa vĩnh viễn!' : '🗑️ Xóa tài khoản'}
                </button>
                {confirmDelete && (
                  <button onClick={() => setConfirmDelete(false)} style={{
                    width: '100%', height: 44, borderRadius: 14, border: '1px solid var(--border)',
                    background: 'transparent', color: 'var(--text-2)',
                    fontFamily: 'DM Sans, sans-serif', fontSize: 13, cursor: 'pointer',
                  }}>Hủy bỏ</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── System Usage Panel ────────────────────────────────────────
function SystemUsagePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getSystemUsage()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12 }} />)}
    </div>
  );

  if (!data) return (
    <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: '24px 0', fontSize: 13 }}>
      ⚠️ Không thể tải dữ liệu
    </div>
  );

  const maxDuration = Math.max(...(data.topUsers || []).map(u => u.totalDuration), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* System chart */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          📊 Tổng thời gian hệ thống — 7 ngày
        </div>
        <MiniBarChart data={data.systemDailyUsage} height={80} color='rgba(99,102,241,0.8)' />
      </div>

      {/* Top users */}
      {data.topUsers && data.topUsers.length > 0 ? (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            🏆 Top người dùng — 30 ngày
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.topUsers.map((u, idx) => {
              const pct = Math.round((u.totalDuration / maxDuration) * 100);
              return (
                <div key={u.userId} style={{
                  background: 'var(--bg)', borderRadius: 12, padding: '10px 14px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                        background: idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#CD7F32' : 'var(--border)',
                        color: idx < 3 ? '#000' : 'var(--text-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>{idx + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{u.businessName}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>
                        {fmtDurationFull(u.totalDuration)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{u.totalSessions} phiên</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--border)' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: idx === 0 ? 'var(--accent)' : 'rgba(0,229,160,0.5)',
                      width: `${pct}%`, transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: '16px 0', fontSize: 13 }}>
          Chưa có dữ liệu phiên đăng nhập
        </div>
      )}
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────
export default function AdminUsers() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [statsLoading, setStatsLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'usage'

  // Load stats
  useEffect(() => {
    setStatsLoading(true);
    adminApi.getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  // Load users
  const loadUsers = useCallback(() => {
    setTableLoading(true);
    const params = { page, limit: 15, sort, order };
    if (search.trim()) params.search = search.trim();
    if (statusFilter) params.status = statusFilter;

    adminApi.getUsers(params)
      .then(data => {
        setUsers(data.users || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => setUsers([]))
      .finally(() => setTableLoading(false));
  }, [page, search, statusFilter, sort, order]);

  useEffect(() => {
    const timer = setTimeout(loadUsers, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const handleSort = (field) => {
    if (sort === field) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setOrder('desc');
    }
    setPage(1);
  };

  const handleStatusChange = (userId, newStatus) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    adminApi.getStats().then(setStats).catch(() => {});
  };

  const handleDelete = (userId) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
    setTotal(t => t - 1);
    adminApi.getStats().then(setStats).catch(() => {});
  };

  const SortIcon = ({ field }) => {
    if (sort !== field) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ color: 'var(--accent)', marginLeft: 4 }}>{order === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="page-container page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Quản trị hệ thống</div>
          <div className="page-sub">Quản lý tài khoản người dùng & theo dõi hoạt động</div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon="👥" label="Tổng người dùng" value={stats?.totalUsers ?? '—'} accent loading={statsLoading} />
        <StatCard icon="🆕" label="Mới trong 7 ngày" value={stats?.newUsers ?? '—'} loading={statsLoading} />
        <StatCard icon="🟢" label="Hoạt động (24h)" value={stats?.activeUsers ?? '—'} loading={statsLoading} />
        <StatCard icon="🔒" label="Đã bị khóa" value={stats?.suspendedUsers ?? '—'} loading={statsLoading} />
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'users', label: '👥 Người dùng' },
          { key: 'usage', label: '⏱️ Thống kê thời gian' },
        ].map(tab => (
          <button
            key={tab.key}
            id={`admin-tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            style={{
              height: 38, padding: '0 18px', borderRadius: 12, border: '1px solid',
              borderColor: activeTab === tab.key ? 'var(--accent)' : 'var(--border)',
              background: activeTab === tab.key ? 'rgba(0,229,160,0.1)' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-2)',
              fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'usage' ? (
        /* ── Tab thống kê sử dụng ─────────────────────────── */
        <div className="card">
          <SystemUsagePanel />
        </div>
      ) : (
        /* ── Tab danh sách người dùng ─────────────────────── */
        <>
          {/* Filters */}
          <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ flex: '1 1 220px', position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-2)', fontSize: 16, pointerEvents: 'none',
              }}>🔍</span>
              <input
                id="admin-search"
                className="input"
                style={{ paddingLeft: 40, margin: 0 }}
                placeholder="Tìm theo tên..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Status filter */}
            <select
              id="admin-status-filter"
              className="input"
              style={{ flex: '0 0 auto', margin: 0, minWidth: 160 }}
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">✅ Đang hoạt động</option>
              <option value="SUSPENDED">🔒 Đã bị khóa</option>
            </select>

            {/* Total */}
            <span style={{ fontSize: 13, color: 'var(--text-2)', flexShrink: 0 }}>
              {tableLoading ? '...' : `${total} người dùng`}
            </span>
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[
                      { label: 'Người dùng', field: 'businessName' },
                      { label: 'Loại hình', field: null },
                      { label: 'Ngày tạo', field: 'createdAt' },
                      { label: 'Hoạt động cuối', field: 'lastActiveAt' },
                      { label: 'T.gian 30 ngày', field: null },
                      { label: 'Trạng thái', field: null },
                      { label: 'Hành động', field: null },
                    ].map(({ label, field }) => (
                      <th
                        key={label}
                        onClick={() => field && handleSort(field)}
                        style={{
                          padding: '14px 16px', textAlign: 'left',
                          fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          cursor: field ? 'pointer' : 'default',
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {label}{field && <SortIcon field={field} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableLoading
                    ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                    : users.length === 0
                      ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center' }}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
                            <div style={{ color: 'var(--accent)', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 16 }}>
                              Không tìm thấy người dùng
                            </div>
                            <div style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 6 }}>
                              Thử thay đổi từ khóa hoặc bộ lọc
                            </div>
                          </td>
                        </tr>
                      )
                      : users.map((user, idx) => (
                        <UserRow
                          key={user.id}
                          user={user}
                          idx={idx}
                          usersLen={users.length}
                          onSelect={() => setSelectedUserId(user.id)}
                          onStatusChange={handleStatusChange}
                        />
                      ))
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderTop: '1px solid var(--border)',
              }}>
                <button
                  id="admin-prev-page"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-ghost"
                  style={{ height: 36, padding: '0 16px', fontSize: 13, opacity: page === 1 ? 0.4 : 1 }}
                >
                  ← Trước
                </button>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Trang <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{page}</span> / {totalPages}
                </span>
                <button
                  id="admin-next-page"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn btn-ghost"
                  style={{ height: 36, padding: '0 16px', fontSize: 13, opacity: page === totalPages ? 0.4 : 1 }}
                >
                  Tiếp →
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* User Detail Modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ── UserRow component (tách ra để dễ load usage) ─────────────
function UserRow({ user, idx, usersLen, onSelect, onStatusChange }) {
  const [usage30d, setUsage30d] = useState(null);

  useEffect(() => {
    // Lazy load usage cho từng user
    adminApi.getUserUsage(user.id)
      .then(u => setUsage30d(u?.last30Days?.duration ?? 0))
      .catch(() => setUsage30d(0));
  }, [user.id]);

  return (
    <tr
      onClick={onSelect}
      style={{
        borderBottom: idx < usersLen - 1 ? '1px solid var(--border)' : 'none',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,160,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Avatar + Name */}
      <td style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,229,160,0.1)', border: '1.5px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: 'var(--accent)',
            fontFamily: 'Syne, sans-serif', flexShrink: 0,
          }}>
            {getInitial(user.businessName)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
              {user.businessName}
            </div>
            {user.role === 'ADMIN' && <RoleBadge role={user.role} />}
          </div>
        </div>
      </td>

      {/* Biz type */}
      <td style={{ padding: '14px 16px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          {BIZ_LABELS[user.businessType] || '—'}
        </span>
      </td>

      {/* Created */}
      <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
        {fmtDate(user.createdAt)}
      </td>

      {/* Last active */}
      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
        <span style={{
          fontSize: 12,
          color: user.lastActiveAt ? 'var(--accent)' : 'var(--text-2)',
        }}>
          {fmtRelative(user.lastActiveAt)}
        </span>
      </td>

      {/* Usage 30 days */}
      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
        {usage30d === null ? (
          <div className="skeleton" style={{ width: 60, height: 16, borderRadius: 6 }} />
        ) : (
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: usage30d > 0 ? 'var(--accent)' : 'var(--text-2)',
            background: usage30d > 0 ? 'rgba(0,229,160,0.08)' : 'transparent',
            padding: usage30d > 0 ? '2px 8px' : '0',
            borderRadius: 8,
            border: usage30d > 0 ? '1px solid rgba(0,229,160,0.2)' : 'none',
          }}>
            {usage30d > 0 ? `⏱ ${fmtDuration(usage30d)}` : '—'}
          </span>
        )}
      </td>

      {/* Status */}
      <td style={{ padding: '14px 16px' }}>
        <StatusBadge status={user.status} />
      </td>

      {/* Actions */}
      <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            id={`admin-user-detail-${user.id}`}
            onClick={onSelect}
            title="Xem chi tiết"
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-2)',
              cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}
          >
            👁
          </button>
          {user.role !== 'ADMIN' && (
            <button
              id={`admin-user-toggle-${user.id}`}
              title={user.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'}
              onClick={async (e) => {
                e.stopPropagation();
                const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                try {
                  await adminApi.updateUserStatus(user.id, newStatus);
                  onStatusChange(user.id, newStatus);
                } catch (err) {
                  alert(err.message);
                }
              }}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: `1px solid ${user.status === 'ACTIVE' ? 'rgba(239,68,68,0.3)' : 'rgba(0,229,160,0.3)'}`,
                background: 'transparent',
                color: user.status === 'ACTIVE' ? 'var(--red)' : 'var(--accent)',
                cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {user.status === 'ACTIVE' ? '🔒' : '🔓'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
