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

const BIZ_TYPES = [
  { value: '1', label: '🍜 Phân phối, cung cấp hàng hóa (Đại lý, tạp hóa...)' },
  { value: '2', label: '✂️ Dịch vụ thuần túy (Tiệm tóc, sửa xe, giặt ủi...)' },
  { value: '3', label: '🍔 Sản xuất, vận tải, ăn uống (Quán cơm, bún phở...)' },
  { value: '4', label: '🌀 Hoạt động kinh doanh khác' },
];

const BIZ_ICONS = {
  '1': '🛒',
  '2': '✂️',
  '3': '🍔',
  '4': '💼'
};

const BIZ_LABELS = {
  '1': 'Thương mại & Bán lẻ',
  '2': 'Dịch vụ thuần túy',
  '3': 'Sản xuất & Ăn uống',
  '4': 'Hoạt động Khác'
};

function SectionCard({ icon, title, children }) {
  return (
    <div className="card card--accent" style={{ marginBottom: 16, transition: 'all var(--dur-comp) var(--ease)' }}>
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
    businessType: '3',
    revenueGoal: '',
    staffSize: '',
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
        // Cập nhật context user đầy đủ thông tin từ DB để kích hoạt các trường như createdAt
        updateUser(data, token);
        setForm({
          businessName: data.businessName || '',
          phone: data.phone || '',
          address: data.address || '',
          bankName: data.bankName || '',
          bankAccount: data.bankAccount || '',
          bankAccountName: data.bankAccountName || '',
          businessType: data.businessType || '3',
          revenueGoal: data.revenueGoal != null ? data.revenueGoal.toString() : '',
          staffSize: data.staffSize != null ? data.staffSize.toString() : '',
        });
      })
      .catch(() => {
        // fallback từ localStorage
        if (user) {
          setForm(f => ({
            ...f,
            businessName: user.businessName || '',
            phone: user.phone || '',
            address: user.address || '',
            bankName: user.bankName || '',
            bankAccount: user.bankAccount || '',
            bankAccountName: user.bankAccountName || '',
            businessType: user.businessType || '3',
            revenueGoal: user.revenueGoal != null ? user.revenueGoal.toString() : '',
            staffSize: user.staffSize != null ? user.staffSize.toString() : '',
          }));
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
      // Cập nhật lại context user đầy đủ từ phản hồi trả về của backend
      updateUser(res.user, token);
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

      {/* Brand Identity Card */}
      {user && (
        <div className="card card--accent" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, background: 'linear-gradient(135deg, rgba(255,255,255,0.80) 0%, rgba(200, 230, 248, 0.70) 100%)', borderLeft: '3px solid var(--accent)' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-dim)',
            border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0, boxShadow: '0 4px 16px rgba(0, 229, 160, 0.15)'
          }}>
            {BIZ_ICONS[user?.businessType] || '🏪'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>
              {user?.businessName || 'Cửa hàng của tôi'}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <span className="badge badge-submitted" style={{ fontSize: 9 }}>MST: {user?.taxCode}</span>
              <span className="badge badge-vat" style={{ fontSize: 9 }}>{BIZ_LABELS[user?.businessType] || 'Hộ kinh doanh'}</span>
            </div>
          </div>
        </div>
      )}

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
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Địa chỉ đăng ký</span>
            <span style={{ fontSize: 13, color: 'var(--text-1)', textAlign: 'right' }}>
              {user?.address || '—'}
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

        {/* Thông tin hoạt động kinh doanh */}
        <SectionCard icon="📊" title="Thông tin hoạt động kinh doanh">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label" htmlFor="settings-biz-type">Lĩnh vực hoạt động chính</label>
              <select
                id="settings-biz-type"
                className="input"
                value={form.businessType}
                onChange={set('businessType')}
              >
                {BIZ_TYPES.map(bt => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                Lĩnh vực này sẽ mặc định tính tỷ lệ thuế GTGT & TNCN tương ứng trên trang Thuế.
              </div>
            </div>

            <InputField
              id="settings-revenue-goal"
              label="Mục tiêu doanh thu hàng tháng (₫)"
              type="number"
              value={form.revenueGoal}
              onChange={set('revenueGoal')}
              placeholder="Ví dụ: 100000000"
              hint="Giúp theo dõi tiến trình thực tế bán hàng so với mục tiêu trên màn hình Tổng quan."
            />

            <InputField
              id="settings-staff-size"
              label="Quy mô nhân sự (số lượng nhân viên)"
              type="number"
              value={form.staffSize}
              onChange={set('staffSize')}
              placeholder="Ví dụ: 3"
              hint="Khai báo quy mô lao động sử dụng thực tế của hộ kinh doanh."
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
