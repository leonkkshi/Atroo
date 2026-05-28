import { useState } from 'react';
import { authApi } from '../api/client';
import { useAuth } from '../store/authStore';
import logoMonogram from '../assets/logo-monogram.png';
import logoWordmark from '../assets/logo-wordmark.png';

export default function Login({ onSwitch }) {
  const { login } = useAuth();
  const [taxCode, setTaxCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!taxCode.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ Mã số thuế và mật khẩu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await authApi.login(taxCode.trim(), password);
      login(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
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
        <circle cx="400" cy="300" r="2" fill="currentColor" opacity="0.4" />
        <circle cx="850" cy="480" r="1.5" fill="currentColor" opacity="0.3" />
        <circle cx="1150" cy="220" r="2" fill="currentColor" opacity="0.4" />
      </svg>

      <div className="figma-auth-card figma-auth-card-animate">
        {/* Figma Logo Brand block */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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
            Trợ lý Thuế AI cho Hộ kinh doanh
          </div>
        </div>

        <div className="figma-title">
          Chào mừng trở lại!
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
            <label className="figma-label">Mã số thuế (MST)</label>
            <input
              id="login-taxcode"
              className="figma-input"
              type="text"
              placeholder="Vd: 0961429526"
              value={taxCode}
              onChange={e => setTaxCode(e.target.value)}
              autoComplete="username"
              inputMode="numeric"
              disabled={loading}
            />
          </div>

          {/* Password Input */}
          <div className="figma-input-group" style={{ marginBottom: '24px' }}>
            <label className="figma-label">Mật khẩu</label>
            <input
              id="login-password"
              className="figma-input"
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {/* Capsule primary action button */}
          <button 
            id="login-submit" 
            className="figma-btn-primary" 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'Đang kết nối...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Footer block */}
        <div className="figma-footer">
          Chưa có tài khoản?{' '}
          <span className="figma-link" onClick={onSwitch}>
            Đăng ký ngay
          </span>
        </div>
      </div>
    </div>
  );
}
