import { useState } from 'react';
import { authApi } from '../api/client';
import { useAuth } from '../store/authStore';
import logoMonogram from '../assets/logo-monogram.png';
import logoWordmark from '../assets/logo-wordmark.png';

const BUSINESS_TYPES = [
  { value: 'food',  label: '🍜 Quán ăn / Cơm bụi / Bún phở' },
  { value: 'hair',  label: '✂️ Tiệm cắt tóc / Salon tóc' },
  { value: 'bike',  label: '🔧 Tiệm sửa xe máy / Garage' },
  { value: 'other', label: '🏪 Hộ kinh doanh khác' },
];

export default function Register({ onSwitch }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ taxCode: '', businessName: '', password: '', confirm: '', bizType: 'food' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.taxCode.trim() || !form.businessName.trim() || !form.password) {
      setError('Vui lòng điền đầy đủ tất cả các trường.');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (form.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await authApi.register(form.taxCode.trim(), form.businessName.trim(), form.password);
      login(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="figma-auth-page">
      {/* Figma background decorations */}
      <div className="figma-bg-wave-1"></div>
      <div className="figma-bg-wave-2"></div>
      <svg className="figma-bg-wavy-lines" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 800" fill="none" preserveAspectRatio="none">
        <path d="M-100 600 C 300 500, 400 700, 800 650 C 1200 600, 1300 750, 1600 700" stroke="currentColor" strokeWidth="1.5" />
        <path d="M-50 400 C 250 480, 500 350, 900 420 C 1300 490, 1200 300, 1550 350" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" opacity="0.6" />
        <circle cx="300" cy="400" r="1.5" fill="currentColor" opacity="0.3" />
        <circle cx="750" cy="250" r="2" fill="currentColor" opacity="0.4" />
        <circle cx="1200" cy="550" r="1.5" fill="currentColor" opacity="0.3" />
      </svg>

      <div className="figma-auth-card figma-auth-card-animate">
        {/* Figma Logo Brand block */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div className="figma-logo-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <img 
              src={logoMonogram} 
              alt="ATRO Monogram" 
              style={{ 
                width: '42px', 
                height: '42px', 
                objectFit: 'contain',
                filter: 'invert(1) brightness(1.2) contrast(1.2)',
                mixBlendMode: 'screen'
              }} 
            />
            <img 
              src={logoWordmark} 
              alt="ATRO" 
              style={{ 
                height: '24px', 
                objectFit: 'contain',
                filter: 'invert(1) brightness(1.2) contrast(1.2)',
                mixBlendMode: 'screen'
              }} 
            />
          </div>
          <div className="figma-logo-sub">
            Tạo tài khoản Hộ kinh doanh miễn phí
          </div>
        </div>

        <div className="figma-title" style={{ marginTop: '24px', marginBottom: '24px' }}>
          Đăng ký tài khoản
        </div>

        <form onSubmit={handleSubmit}>
          
          {/* Error handler for Glass theme */}
          {error && (
            <div className="figma-error-msg">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setError('')} 
                className="figma-link" 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '12px', 
                  alignSelf: 'flex-end', 
                  padding: '2px 8px',
                  color: '#DC2626',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                Thử lại
              </button>
            </div>
          )}

          {/* MST Input */}
          <div className="figma-input-group">
            <label className="figma-label">Mã số thuế (MST) *</label>
            <input
              id="reg-taxcode"
              className="figma-input"
              type="text"
              placeholder="Ví dụ: 0123456789"
              value={form.taxCode}
              onChange={set('taxCode')}
              inputMode="numeric"
              disabled={loading}
            />
          </div>

          {/* Business Name Input */}
          <div className="figma-input-group">
            <label className="figma-label">Tên cơ sở kinh doanh *</label>
            <input
              id="reg-bizname"
              className="figma-input"
              type="text"
              placeholder="Ví dụ: Quán Cơm Hạnh Phúc"
              value={form.businessName}
              onChange={set('businessName')}
              disabled={loading}
            />
          </div>

          {/* Business Type Select */}
          <div className="figma-input-group">
            <label className="figma-label">Loại hình kinh doanh</label>
            <select 
              id="reg-biztype" 
              className="figma-input" 
              value={form.bizType} 
              onChange={set('bizType')}
              disabled={loading}
              style={{
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2300E5A0' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 20px center',
                paddingRight: '44px'
              }}
            >
              {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Passwords grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <div className="figma-input-group" style={{ marginBottom: 0 }}>
              <label className="figma-label">Mật khẩu *</label>
              <input
                id="reg-password"
                className="figma-input"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={form.password}
                onChange={set('password')}
                disabled={loading}
              />
            </div>
            
            <div className="figma-input-group" style={{ marginBottom: 0 }}>
              <label className="figma-label">Xác nhận *</label>
              <input
                id="reg-confirm"
                className="figma-input"
                type="password"
                placeholder="Nhập lại"
                value={form.confirm}
                onChange={set('confirm')}
                disabled={loading}
              />
            </div>
          </div>

          {/* Capsule primary action button */}
          <button 
            id="reg-submit" 
            className="figma-btn-primary" 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          </button>
        </form>

        {/* Footer block */}
        <div className="figma-footer">
          Đã có tài khoản?{' '}
          <span className="figma-link" onClick={onSwitch}>
            Đăng nhập ngay
          </span>
        </div>
      </div>
    </div>
  );
}
