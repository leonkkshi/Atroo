import { useState } from 'react';
import { authApi } from '../api/client';
import { useAuth } from '../store/authStore';

const BUSINESS_TYPES = [
  { value: 'food',  label: '🍜 Quán ăn / Cơm bụi / Bún phở' },
  { value: 'hair',  label: '✂️ Tiệm cắt tóc / Salon tóc' },
  { value: 'bike',  label: '🔧 Tiệm sửa xe máy / Garage' },
  { value: 'other', label: '🏪 Hộ kinh doanh khác' },
];

export default function Register({ onSwitch }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ taxCode: '', businessName: '', password: '', confirm: '', bizType: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.taxCode || !form.businessName || !form.password) {
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
          <div className="auth-logo-sub">Tạo tài khoản miễn phí</div>
        </div>
        <div className="auth-title">Đăng ký</div>

        <form onSubmit={handleSubmit} className="form-section">
          {error && <div className="error-msg">⚠️ {error}</div>}

          <div className="input-group">
            <label className="input-label">Mã số thuế (MST) *</label>
            <input
              id="reg-taxcode"
              className="input"
              type="text"
              placeholder="Ví dụ: 0123456789"
              value={form.taxCode}
              onChange={set('taxCode')}
              inputMode="numeric"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Tên cơ sở kinh doanh *</label>
            <input
              id="reg-bizname"
              className="input"
              type="text"
              placeholder="Ví dụ: Quán cơm Nguyễn Văn An"
              value={form.businessName}
              onChange={set('businessName')}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Loại hình kinh doanh</label>
            <select id="reg-biztype" className="input" value={form.bizType} onChange={set('bizType')}>
              {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label className="input-label">Mật khẩu *</label>
              <input
                id="reg-password"
                className="input"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={form.password}
                onChange={set('password')}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Xác nhận mật khẩu *</label>
              <input
                id="reg-confirm"
                className="input"
                type="password"
                placeholder="Nhập lại"
                value={form.confirm}
                onChange={set('confirm')}
              />
            </div>
          </div>

          <button id="reg-submit" className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản →'}
          </button>
        </form>

        <div className="auth-footer">
          Đã có tài khoản?{' '}
          <span className="auth-link" onClick={onSwitch}>Đăng nhập</span>
        </div>
      </div>
    </div>
  );
}
