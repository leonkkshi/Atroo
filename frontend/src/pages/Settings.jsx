import { useState, useEffect } from 'react';
import { authApi } from '../api/client';
import { useAuth } from '../store/authStore';

const BANK_LIST = [
  'Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'MB Bank',
  'Techcombank', 'ACB', 'VPBank', 'TPBank', 'Sacombank',
  'HDBank', 'SHB', 'OCB', 'MSB', 'SeABank', 'LienVietPostBank',
  'Eximbank', 'BacABank', 'PVcomBank', 'VIB', 'Khác',
];

const VIETQR_BANK_ID = {
  'Vietcombank': 'VCB',
  'VietinBank': 'CTG',
  'BIDV': 'BIDV',
  'Agribank': 'AGR',
  'MB Bank': 'MB',
  'Techcombank': 'TCB',
  'ACB': 'ACB',
  'VPBank': 'VPB',
  'TPBank': 'TPB',
  'Sacombank': 'STB',
  'HDBank': 'HDB',
  'SHB': 'SHB',
  'OCB': 'OCB',
  'MSB': 'MSB',
  'SeABank': 'SEAB',
  'LienVietPostBank': 'LPB',
  'Eximbank': 'EIB',
  'BacABank': 'BAB',
  'PVcomBank': 'PVCB',
  'VIB': 'VIB',
};


function SectionCard({ icon, title, children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontFamily: 'Syne, Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-1)' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function InputField({ label, id, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div className="input-group">
      <label className="input-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  const color = type === 'success' ? 'var(--accent)' : 'var(--red)';
  return (
    <div style={{
      position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--surface)', border: `1px solid ${color}`, borderRadius: 14,
      padding: '12px 20px', fontSize: 13, color, zIndex: 9999,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
      animation: 'fadeInUp 0.25s ease',
    }}>
      {type === 'success' ? '✓' : '⚠️'} {msg}
    </div>
  );
}

export default function Settings() {
  const { user, login: updateUser, token } = useAuth();

  // Profile state
  const [form, setForm] = useState({
    businessName: '',
    phone: '',
    address: '',
    bankName: '',
    bankAccount: '',
    bankAccountName: '',
  });

  // Password state
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });

  const [loading, setLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [toast, setToast] = useState({ msg: '', type: 'success' });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setPwdField = (k) => (e) => setPwd(p => ({ ...p, [k]: e.target.value }));

  // Load profile từ server
  useEffect(() => {
    authApi.profile()
      .then(data => {
        setForm({
          businessName: data.businessName || '',
          phone: data.phone || '',
          address: data.address || '',
          bankName: data.bankName || '',
          bankAccount: data.bankAccount || '',
          bankAccountName: data.bankAccountName || '',
        });
      })
      .catch(() => {
        // fallback từ localStorage
        if (user) {
          setForm(f => ({ ...f, businessName: user.businessName || '' }));
        }
      })
      .finally(() => setFetchLoading(false));
  }, []);

  // Lưu thông tin hồ sơ
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      showToast('Tên cửa hàng không được để trống.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.updateProfile(form);
      // Cập nhật lại context user để sidebar hiển thị đúng
      updateUser(
        { ...(user || {}), businessName: res.user.businessName, taxCode: res.user.taxCode },
        token
      );
      showToast('Đã lưu thông tin thành công!');
    } catch (err) {
      showToast(err.message || 'Lưu thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Đổi mật khẩu
  const handleChangePwd = async (e) => {
    e.preventDefault();
    if (!pwd.current) { showToast('Vui lòng nhập mật khẩu hiện tại.', 'error'); return; }
    if (pwd.next.length < 6) { showToast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error'); return; }
    if (pwd.next !== pwd.confirm) { showToast('Mật khẩu mới không khớp.', 'error'); return; }

    setPwdLoading(true);
    try {
      await authApi.updateProfile({ currentPassword: pwd.current, newPassword: pwd.next });
      setPwd({ current: '', next: '', confirm: '' });
      showToast('Đã đổi mật khẩu thành công!');
    } catch (err) {
      showToast(err.message || 'Đổi mật khẩu thất bại.', 'error');
    } finally {
      setPwdLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="page-container page-enter">
        <div className="page-header">
          <div className="page-title">Cài đặt</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 120, borderRadius: 20 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-enter">
      <Toast msg={toast.msg} type={toast.type} />

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Cài đặt</div>
          <div className="page-sub">Thông tin cửa hàng & tài khoản</div>
        </div>
      </div>

      {/* Thông tin cơ bản (read-only) */}
      <SectionCard icon="🪪" title="Tài khoản">
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Mã số thuế</span>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em' }}>
              {user?.taxCode || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Ngày tạo tài khoản</span>
            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('vi-VN')
                : '—'}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Form thông tin cửa hàng */}
      <form onSubmit={handleSaveProfile}>
        <SectionCard icon="🏪" title="Thông tin cửa hàng">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InputField
              id="settings-biz-name"
              label="Tên cửa hàng / doanh nghiệp"
              value={form.businessName}
              onChange={set('businessName')}
              placeholder="Ví dụ: Quán Cơm Nguyễn Văn An"
            />
            <InputField
              id="settings-phone"
              label="Số điện thoại"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="0901 234 567"
            />
            <InputField
              id="settings-address"
              label="Địa chỉ"
              value={form.address}
              onChange={set('address')}
              placeholder="123 Đường Lê Lợi, Quận 1, TP.HCM"
            />
          </div>
        </SectionCard>

        {/* Tài khoản ngân hàng */}
        <SectionCard icon="🏦" title="Tài khoản nhận tiền (QR Bank)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label" htmlFor="settings-bank-name">Ngân hàng</label>
              <select
                id="settings-bank-name"
                className="input"
                value={form.bankName}
                onChange={set('bankName')}
              >
                <option value="">— Chọn ngân hàng —</option>
                {BANK_LIST.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <InputField
              id="settings-bank-account"
              label="Số tài khoản"
              value={form.bankAccount}
              onChange={set('bankAccount')}
              placeholder="0123456789"
              hint="Số tài khoản này sẽ được dùng để tạo mã QR thanh toán."
            />
            <InputField
              id="settings-bank-holder"
              label="Tên chủ tài khoản"
              value={form.bankAccountName}
              onChange={set('bankAccountName')}
              placeholder="NGUYEN VAN AN"
              hint="Viết IN HOA, không dấu (theo chuẩn ngân hàng)."
            />
          </div>

          {/* Preview QR nếu đủ thông tin */}
          {form.bankAccount && form.bankName && (() => {
            const previewBankId = VIETQR_BANK_ID[form.bankName] || form.bankName.replace(/\s/g, '');
            return (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--bg)', borderRadius: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>Xem trước QR thanh toán</div>
                <img
                  src={`https://img.vietqr.io/image/${previewBankId}-${form.bankAccount}-compact2.png?addInfo=A+Tro+Demo&accountName=${encodeURIComponent(form.bankAccountName || 'CHU_TK')}`}
                  alt="QR Preview"
                  style={{ width: 140, height: 140, borderRadius: 12, border: '1px solid var(--border)' }}
                  onError={e => { e.target.style.opacity = 0.3; }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 8 }}>
                  {form.bankName} · {form.bankAccount}
                </div>
              </div>
            );
          })()}
        </SectionCard>

        <button
          id="settings-save-btn"
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading}
          style={{ marginBottom: 16 }}
        >
          {loading ? 'Đang lưu...' : '💾 Lưu thay đổi'}
        </button>
      </form>

      {/* Đổi mật khẩu */}
      <form onSubmit={handleChangePwd}>
        <SectionCard icon="🔒" title="Đổi mật khẩu">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InputField
              id="settings-pwd-current"
              label="Mật khẩu hiện tại"
              type="password"
              value={pwd.current}
              onChange={setPwdField('current')}
              placeholder="••••••••"
            />
            <InputField
              id="settings-pwd-new"
              label="Mật khẩu mới"
              type="password"
              value={pwd.next}
              onChange={setPwdField('next')}
              placeholder="Ít nhất 6 ký tự"
            />
            <InputField
              id="settings-pwd-confirm"
              label="Xác nhận mật khẩu mới"
              type="password"
              value={pwd.confirm}
              onChange={setPwdField('confirm')}
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>
        </SectionCard>
        <button
          id="settings-pwd-btn"
          type="submit"
          className="btn btn-ghost w-full"
          disabled={pwdLoading}
          style={{ marginBottom: 32 }}
        >
          {pwdLoading ? 'Đang đổi...' : '🔑 Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
}
