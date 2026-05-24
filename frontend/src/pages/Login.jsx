import { useState } from 'react';
import { authApi } from '../api/client';
import { useAuth } from '../store/authStore';

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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-text">A Trợ</div>
          <div className="auth-logo-sub">Trợ lý Thuế AI cho Hộ kinh doanh</div>
        </div>
        <div className="auth-title">Đăng nhập</div>

        <form onSubmit={handleSubmit} className="form-section">
          {error && <div className="error-msg">⚠️ {error}</div>}

          <div className="input-group">
            <label className="input-label">Mã số thuế (MST)</label>
            <input
              id="login-taxcode"
              className="input"
              type="text"
              placeholder="Ví dụ: 0123456789"
              value={taxCode}
              onChange={e => setTaxCode(e.target.value)}
              autoComplete="username"
              inputMode="numeric"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Mật khẩu</label>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button id="login-submit" className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập →'}
          </button>
        </form>

        <div className="auth-footer">
          Chưa có tài khoản?{' '}
          <span className="auth-link" onClick={onSwitch}>Đăng ký ngay</span>
        </div>
      </div>
    </div>
  );
}
