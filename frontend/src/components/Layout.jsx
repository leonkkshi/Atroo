import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/authStore';
import logoMonogram from '../assets/logo-monogram.png';
import logoWordmark from '../assets/logo-wordmark.png';



// ── SVG Icons ─────────────────────────────────────────────────
function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="2"/>
      <rect x="14" y="3" width="7" height="7" rx="2"/>
      <rect x="3" y="14" width="7" height="7" rx="2"/>
      <rect x="14" y="14" width="7" height="7" rx="2"/>
    </svg>
  );
}
function IconPOS() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  );
}
function IconFinance() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
function IconTax() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

// Extended nav with calendar
const SIDEBAR_ITEMS = [
  { path: '/dashboard', label: 'Tổng quan', icon: IconDashboard },
  { path: '/pos',       label: 'Bán hàng',  icon: IconPOS },
  { path: '/finance',   label: 'Tài chính', icon: IconFinance },
  { path: '/tax',       label: 'Thuế',      icon: IconTax },
  { path: '/calendar',  label: 'Lịch biểu', icon: IconCalendar },
  { path: '/chat',      label: 'A Trợ AI',  icon: IconChat },
  { path: '/settings',  label: 'Cài đặt',   icon: IconSettings },
];


// ── Sidebar (desktop) ─────────────────────────────────────────
export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src={logoMonogram} 
            alt="ATRO Monogram" 
            style={{ 
              width: '32px', 
              height: '32px', 
              objectFit: 'contain',
              filter: 'invert(1) brightness(1.2) contrast(1.2)',
              mixBlendMode: 'screen',
              flexShrink: 0
            }} 
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <img 
              src={logoWordmark} 
              alt="ATRO Wordmark" 
              style={{ 
                height: '16px', 
                objectFit: 'contain',
                filter: 'invert(1) brightness(1.2) contrast(1.2)',
                mixBlendMode: 'screen',
                alignSelf: 'flex-start'
              }} 
            />
            <div className="logo-sub" style={{ margin: 0, lineHeight: 1 }}>Trợ lý Thuế AI</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {SIDEBAR_ITEMS.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              id={`sidebar-${item.path.slice(1)}`}
              className={`sidebar-item${active ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{user.businessName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>MST: {user.taxCode}</div>
          </div>
        )}
        <button className="sidebar-item" onClick={handleLogout} id="sidebar-logout">
          <IconLogout /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}

// ── Main Layout wrapper ────────────────────────────────────────
export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
