import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { posApi, authApi } from '../api/client';
import { fmtMoney, generateId } from '../utils/format';
import { useAuth } from '../store/authStore';

// Map tên ngân hàng → bank ID dùng cho VietQR
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

const TAX_RATES = { FOOD: 0.03, PRODUCT: 0.01, SERVICE: 0.05 };
const TYPE_LABELS = { FOOD: '🍜 Đồ ăn / Nước uống', PRODUCT: '📦 Vật tư / Hàng hóa', SERVICE: '⚙️ Dịch vụ' };
const TYPE_BADGE = { FOOD: 'badge-food', PRODUCT: 'badge-product', SERVICE: 'badge-service' };
const FALLBACK_ITEM_IMAGE = '/uploads/pos-placeholder.svg';

// Tên hiển thị theo tab
const TAB_CONFIG = {
  ALL:     { label: 'Tất cả', sub: 'Toàn bộ menu' },
  FOOD:    { label: '🍜 Đồ ăn', sub: 'Thức ăn, nước uống' },
  SERVICE: { label: '⚙️ Dịch vụ', sub: 'Cắt tóc, sửa xe, v.v.' },
  PRODUCT: { label: '📦 Hàng hóa', sub: 'Vật tư, linh kiện' },
};

function calcTax(items) {
  return items.reduce((sum, it) => sum + it.price * it.quantity * (TAX_RATES[it.type] || 0.03), 0);
}

function resolveItemImage(imageUrl) {
  if (!imageUrl) return FALLBACK_ITEM_IMAGE;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    return imageUrl;
  }
  return imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
}

function ItemCard({ item, inCart, onClick }) {
  const imageSrc = resolveItemImage(item.imageUrl);

  return (
    <div id={`pos-item-${item.id}`} className="pos-item-card" onClick={onClick}>
      <div className="pos-item-media">
        <img
          className="pos-item-image"
          src={imageSrc}
          alt={item.name}
          loading="lazy"
          onError={(event) => {
            if (event.currentTarget.dataset.fallback === '1') return;
            event.currentTarget.dataset.fallback = '1';
            event.currentTarget.src = FALLBACK_ITEM_IMAGE;
          }}
        />
        <span className={`badge ${TYPE_BADGE[item.type] || 'badge-product'} pos-item-badge`} style={{ fontSize: 10, padding: '2px 7px' }}>
          {TYPE_LABELS[item.type] || item.type}
        </span>
        {inCart && <div className="pos-item-qty-badge">{inCart.quantity}</div>}
      </div>
      <div className="pos-item-name">{item.name}</div>
      <div className="pos-item-price">{fmtMoney(item.price)}</div>
    </div>
  );
}

// ── Add item modal ────────────────────────────────────────────
function AddItemModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', price: '', type: 'FOOD', image: null });
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;
    setErr('');
    setForm(f => ({ ...f, image: file }));
    setPreview(file ? URL.createObjectURL(file) : '');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const price = Number(form.price);

    if (!name) { setErr('Vui lòng điền tên sản phẩm.'); return; }
    if (!Number.isFinite(price) || price <= 0) { setErr('Giá không hợp lệ.'); return; }
    if (!form.image) { setErr('Vui lòng chọn hình ảnh sản phẩm.'); return; }

    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('name', name);
      payload.append('price', String(price));
      payload.append('type', form.type);
      payload.append('image', form.image);

      const data = await posApi.createItem(payload);
      onAdded(data.item);
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
          <div className="h2 mb-4">Thêm sản phẩm / dịch vụ</div>
          <form className="form-section" onSubmit={handleAdd}>
            {err && <div className="error-msg">⚠️ {err}</div>}
            <div className="input-group">
              <label className="input-label">Hình ảnh sản phẩm</label>
              <input className="input" type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml" onChange={handleImageChange} />
              <div className="pos-add-hint">Bắt buộc chọn ảnh JPG, PNG, WEBP hoặc SVG.</div>
            </div>
            <div className="pos-add-preview">
              {preview ? (
                <img className="pos-add-preview-image" src={preview} alt="Xem trước ảnh sản phẩm" />
              ) : (
                <div className="pos-add-preview-empty">Ảnh xem trước sẽ hiển thị ở đây</div>
              )}
            </div>
            <div className="input-group">
              <label className="input-label">Tên sản phẩm</label>
              <input className="input" placeholder="Ví dụ: Cơm đĩa bình dân" value={form.name} onChange={set('name')} />
            </div>
            <div className="form-row">
              <div className="input-group">
                <label className="input-label">Giá bán (₫)</label>
                <input className="input" type="number" placeholder="30000" value={form.price} onChange={set('price')} inputMode="numeric" />
              </div>
              <div className="input-group">
                <label className="input-label">Loại</label>
                <select className="input" value={form.type} onChange={set('type')}>
                  <option value="FOOD">Thực phẩm / Ăn uống</option>
                  <option value="PRODUCT">Sản phẩm</option>
                  <option value="SERVICE">Dịch vụ</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              {loading ? 'Đang thêm...' : '+ Thêm sản phẩm'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

// ── QR Payment modal ──────────────────────────────────────────
function QRModal({ amount, onClose, onConfirm, bankProfile }) {
  const bankId   = VIETQR_BANK_ID[bankProfile?.bankName] || 'MB';
  const bankAcct = bankProfile?.bankAccount || '0123456789';
  const bankName = bankProfile?.bankName || 'MB Bank';
  const holderName = bankProfile?.bankAccountName || 'HO KINH DOANH A TRO';
  const hasCustomBank = !!(bankProfile?.bankAccount);

  const qrUrl = `https://img.vietqr.io/image/${bankId}-${bankAcct}-compact2.png` +
    `?amount=${Math.round(amount)}` +
    `&addInfo=ATro+Ban+Hang` +
    `&accountName=${encodeURIComponent(holderName)}`;

  const [qrErr, setQrErr] = useState(false);

  return (
    <>
      <div className="backdrop" onClick={onClose} style={{ zIndex: 110 }} />
      <div className="modal" style={{ zIndex: 111 }}>
        <div className="modal-inner" style={{ textAlign: 'center' }}>
          <div className="h2 mb-2">Quét mã QR thanh toán</div>
          <div className="body mb-4">
            Số tiền: <strong style={{ color: 'var(--accent)', fontFamily: 'Syne, sans-serif', fontSize: 18 }}>{fmtMoney(amount)}</strong>
          </div>

          {!hasCustomBank && (
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: 'var(--amber)', textAlign: 'left' }}>
              ⚠️ Bạn chưa cấu hình tài khoản ngân hàng. Vào <strong>Cài đặt</strong> để thêm thông tin nhận tiền.
            </div>
          )}

          {qrErr ? (
            <div style={{ width: 220, height: 220, background: 'var(--bg)', borderRadius: 16, margin: '0 auto 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-2)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 32, marginBottom: 8 }}>⚠️</span>
              Không tải được QR<br/>Kiểm tra kết nối mạng
            </div>
          ) : (
            <img
              src={qrUrl}
              alt="QR thanh toán VietQR"
              style={{ width: 220, height: 220, borderRadius: 16, margin: '0 auto 20px', border: '1px solid var(--border)', display: 'block' }}
              onError={() => setQrErr(true)}
            />
          )}

          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: 'var(--text-2)', textAlign: 'left' }}>
            <div><strong style={{ color: 'var(--text-1)' }}>{bankName}</strong> · {bankAcct}</div>
            <div style={{ marginTop: 2 }}>{holderName}</div>
          </div>

          <div className="flex gap-3">
            <button className="btn btn-ghost w-full" onClick={onClose}>Huỷ</button>
            <button className="btn btn-primary w-full" id="qr-confirm" onClick={onConfirm}>✓ Đã nhận tiền</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Receipt for printing ──────────────────────────────────────
// Lưu ý: KHÔNG dùng class 'no-print' vì CSS print sẽ hide nó.
// Dùng id 'receipt-content' để toggle display qua JS khi in.
function Receipt({ invoice, user, id = 'receipt-content' }) {
  const items = invoice.items || [];
  const payLabel = { CASH: 'Tiền mặt', QR_BANK: 'QR Bank', CARD: 'Thẻ' };
  
  return createPortal(
    <div className="receipt" id={id} style={{ display: 'none' }}>
      {/* Thông tin Cửa hàng / Hộ kinh doanh */}
      <div className="receipt-center receipt-bold" style={{ fontSize: 16, marginBottom: 4 }}>
        {(user?.businessName || 'CỬA HÀNG').toUpperCase()}
      </div>
      
      {user?.address && (
        <div className="receipt-center" style={{ fontSize: 11, color: '#333' }}>
          Đ/c: {user.address}
        </div>
      )}
      {user?.phone && (
        <div className="receipt-center" style={{ fontSize: 11, color: '#333' }}>
          SĐT: {user.phone}
        </div>
      )}
      {user?.taxCode && (
        <div className="receipt-center" style={{ fontSize: 11, color: '#333', fontWeight: 600 }}>
          MST: {user.taxCode}
        </div>
      )}

      <div className="receipt-center" style={{ fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
        Hệ thống quản lý bán hàng
      </div>
      
      <div className="receipt-divider" />
      
      <div className="receipt-center receipt-bold" style={{ fontSize: 13, marginBottom: 6 }}>
        HÓA ĐƠN BÁN HÀNG
      </div>

      <div className="receipt-center" style={{ fontSize: 11 }}>
        Thời gian: {new Date(invoice.createdAt).toLocaleString('vi-VN')}
      </div>
      <div className="receipt-center" style={{ fontSize: 11 }}>
        Số HD: {invoice.id}
      </div>
      
      <div className="receipt-divider" />
      
      {/* Chi tiết mặt hàng */}
      {items.map((it, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div className="receipt-bold" style={{ fontSize: 12 }}>{it.name}</div>
          <div className="receipt-row" style={{ fontSize: 11 }}>
            <span>{it.quantity} x {fmtMoney(it.price)}</span>
            <span>{fmtMoney(it.price * it.quantity)}</span>
          </div>
        </div>
      ))}
      
      <div className="receipt-divider" />
      
      {/* Tổng cộng & Thuế */}
      <div className="receipt-row receipt-bold" style={{ fontSize: 13 }}>
        <span>TỔNG CỘNG</span>
        <span>{fmtMoney(invoice.total)}</span>
      </div>
      
      {invoice.estimatedTax > 0 && (
        <div className="receipt-row" style={{ fontSize: 11, color: '#333' }}>
          <span>Thuế ước tính</span>
          <span>{fmtMoney(invoice.estimatedTax)}</span>
        </div>
      )}
      
      <div className="receipt-row" style={{ fontSize: 11 }}>
        <span>Thanh toán</span>
        <span>{payLabel[invoice.paymentMethod] || invoice.paymentMethod}</span>
      </div>
      
      <div className="receipt-divider" />
      
      <div className="receipt-center receipt-bold" style={{ fontSize: 11 }}>
        CẢM ƠN QUÝ KHÁCH!
      </div>
      <div className="receipt-center" style={{ fontSize: 10, color: '#555' }}>
        Hẹn gặp lại quý khách lần sau
      </div>
    </div>,
    document.body
  );
}

// ── History Invoice Detail Modal ──────────────────────────────
function HistoryInvoiceModal({ invoice, onClose, user }) {
  const payLabel = { CASH: 'Tiền mặt', QR_BANK: 'QR Bank', CARD: 'Thẻ' };
  
  return (
    <>
      <div className="backdrop" onClick={onClose} style={{ zIndex: 110 }} />
      <div className="modal" style={{ zIndex: 111, maxWidth: 380 }}>
        <div className="modal-inner">
          <div className="flex justify-between items-center mb-4 no-print">
            <span className="h2">Chi tiết hóa đơn</span>
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px 10px', height: 32 }}>Đóng</button>
          </div>
          
          {/* Màn hình Preview hóa đơn */}
          <div style={{ background: 'white', color: 'black', padding: 20, borderRadius: 16, marginBottom: 20, border: '1px solid var(--border)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#000', lineHeight: 1.5 }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>
                {(user?.businessName || 'CỬA HÀNG').toUpperCase()}
              </div>
              {user?.address && <div style={{ textAlign: 'center', fontSize: 10 }}>Đ/c: {user.address}</div>}
              {user?.phone && <div style={{ textAlign: 'center', fontSize: 10 }}>SĐT: {user.phone}</div>}
              {user?.taxCode && <div style={{ textAlign: 'center', fontSize: 10 }}>MST: {user.taxCode}</div>}
              
              <div style={{ borderTop: '1px dashed #666', margin: '8px 0' }} />
              
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>HÓA ĐƠN BÁN HÀNG</div>
              <div style={{ fontSize: 10 }}>Số HD: {invoice.id}</div>
              <div style={{ fontSize: 10 }}>Ngày: {new Date(invoice.createdAt).toLocaleString('vi-VN')}</div>
              
              <div style={{ borderTop: '1px dashed #666', margin: '8px 0' }} />
              
              {invoice.items?.map((it, i) => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 'bold' }}>{it.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span>{it.quantity} x {fmtMoney(it.price)}</span>
                    <span>{fmtMoney(it.price * it.quantity)}</span>
                  </div>
                </div>
              ))}
              
              <div style={{ borderTop: '1px dashed #666', margin: '8px 0' }} />
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13 }}>
                <span>TỔNG CỘNG:</span>
                <span>{fmtMoney(invoice.total)}</span>
              </div>
              {invoice.estimatedTax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span>Thuế ước tính:</span>
                  <span>{fmtMoney(invoice.estimatedTax)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2 }}>
                <span>Thanh toán:</span>
                <span>{payLabel[invoice.paymentMethod] || invoice.paymentMethod}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }} className="no-print">
            <button className="btn btn-ghost w-full" onClick={onClose}>Quay lại</button>
            <button
              className="btn btn-primary w-full"
              onClick={() => {
                const el = document.getElementById('receipt-history-print');
                if (!el) return;
                el.style.setProperty('display', 'block', 'important');
                document.body.setAttribute('data-printing', '1');
                window.print();
                el.style.display = 'none';
                document.body.removeAttribute('data-printing');
              }}
            >
              🖨️ In hóa đơn
            </button>
          </div>
          
          {/* Receipt in ẩn thực tế (Ẩn đi trên màn hình, chỉ show khi ấn window.print) */}
          <Receipt invoice={invoice} user={user} id="receipt-history-print" />
        </div>
      </div>
    </>
  );
}

// ── Cart bottom sheet ─────────────────────────────────────────
function CartSheet({ cart, onClose, onQty, onRemove, onCheckout, user, bankProfile }) {
  const [method, setMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [doneInvoice, setDoneInvoice] = useState(null);

  const total = cart.reduce((s, it) => s + it.price * it.quantity, 0);
  const tax   = Math.round(calcTax(cart));

  const handlePay = async () => {
    if (method === 'QR_BANK') { setShowQR(true); return; }
    await doCheckout(method);
  };

  const doCheckout = async (pm) => {
    setLoading(true);
    try {
      const invoiceData = {
        id: generateId(),
        total,
        estimatedTax: tax,
        items: cart,
        paymentMethod: pm,
      };
      const res = await posApi.createInvoice(invoiceData);
      const inv = { ...invoiceData, createdAt: new Date(), id: res.invoice?.id || invoiceData.id };
      setDoneInvoice(inv);
      onCheckout(inv);
    } catch (e) {
      alert('Lỗi tạo hóa đơn: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (doneInvoice) {
    return (
      <>
        <div className="backdrop" onClick={onClose} />
        <div className="bottom-sheet">
          <div className="bottom-sheet-handle" />
          <div style={{ padding: '24px 20px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <div className="h2 mb-2">Thanh toán thành công!</div>
            <div className="body mb-4">{fmtMoney(doneInvoice.total)}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost w-full" onClick={onClose}>Đóng</button>
              <button
                id="print-invoice-btn"
                className="btn btn-primary w-full"
                onClick={() => {
                  const el = document.getElementById('receipt-content');
                  if (!el) return;
                  // Hiện receipt, in, rồi ẩn lại
                  el.style.setProperty('display', 'block', 'important');
                  // Ẩn toàn bộ nội dung khác khi in
                  document.body.setAttribute('data-printing', '1');
                  window.print();
                  el.style.display = 'none';
                  document.body.removeAttribute('data-printing');
                }}
              >
                🖨️ In hóa đơn
              </button>
            </div>
            <Receipt invoice={doneInvoice} user={user} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="bottom-sheet-handle" />
        <div style={{ padding: '16px 20px 40px' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="h2">Giỏ hàng ({cart.length})</div>
            <button className="btn-ghost btn btn-sm" onClick={onClose}>Đóng</button>
          </div>

          {/* Items */}
          <div>
            {cart.map(it => (
              <div key={it.id} className="cart-item">
                <div className="cart-item-thumb">
                  <img
                    src={resolveItemImage(it.imageUrl)}
                    alt={it.name}
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallback === '1') return;
                      event.currentTarget.dataset.fallback = '1';
                      event.currentTarget.src = FALLBACK_ITEM_IMAGE;
                    }}
                  />
                </div>
                <div className="cart-item-info">
                  <div className="cart-item-name">{it.name}</div>
                  <div className="cart-item-price">{fmtMoney(it.price)}</div>
                </div>
                <div className="qty-control">
                  <button className="qty-btn" onClick={() => onRemove(it.id)}>🗑</button>
                  <button className="qty-btn" onClick={() => onQty(it.id, -1)}>−</button>
                  <span className="qty-num">{it.quantity}</span>
                  <button className="qty-btn" onClick={() => onQty(it.id, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="divider" />

          {/* Totals */}
          <div className="tax-detail-row">
            <span className="tax-detail-label">Tạm tính</span>
            <span className="tax-detail-val">{fmtMoney(total)}</span>
          </div>
          <div className="tax-detail-row">
            <span className="tax-detail-label">Thuế ước tính</span>
            <span className="tax-detail-val" style={{ color: 'var(--amber)' }}>{fmtMoney(tax)}</span>
          </div>
          <div className="tax-detail-row">
            <span style={{ fontFamily: 'Syne', fontWeight: 700 }}>Tổng cộng</span>
            <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 18, color: 'var(--accent)' }}>{fmtMoney(total)}</span>
          </div>

          <div className="divider" />

          {/* Payment method */}
          <div className="section-title mb-3">Phương thức thanh toán</div>
          <div className="pay-methods mb-4">
            {[
              { val: 'CASH', label: 'Tiền mặt', icon: '💵' },
              { val: 'QR_BANK', label: 'QR Bank', icon: '📱' },
              { val: 'CARD', label: 'Thẻ', icon: '💳' },
            ].map(m => (
              <button
                key={m.val}
                id={`pay-${m.val.toLowerCase()}`}
                className={`pay-method-btn${method === m.val ? ' selected' : ''}`}
                onClick={() => setMethod(m.val)}
              >
                <span style={{ fontSize: 22 }}>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          <button id="checkout-btn" className="btn btn-primary w-full" onClick={handlePay} disabled={loading || cart.length === 0}>
            {loading ? 'Đang xử lý...' : `Thanh toán ${fmtMoney(total)}`}
          </button>
        </div>
      </div>
      {showQR && (
        <QRModal
          amount={total}
          onClose={() => setShowQR(false)}
          onConfirm={() => { setShowQR(false); doCheckout('QR_BANK'); }}
          bankProfile={bankProfile}
        />
      )}
    </>
  );
}

// ── Main POS Page ─────────────────────────────────────────────
export default function POS() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [bankProfile, setBankProfile] = useState(null);

  // States cho Quản lý Lịch sử
  const [view, setView] = useState('sales'); // 'sales' | 'history'
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    posApi.getInvoices()
      .then(data => setHistory(data.invoices || []))
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    posApi.getItems()
      .then(data => setItems(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));

    // Load bank info từ profile để dùng cho QR
    authApi.profile()
      .then(profile => setBankProfile(profile))
      .catch(() => {}); // silent fail

    loadHistory(); // Load sẵn lịch sử hóa đơn
  }, [loadHistory]);

  const addToCart = useCallback((item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const changeQty = useCallback((id, delta) => {
    setCart(prev => prev
      .map(c => c.id === id ? { ...c, quantity: c.quantity + delta } : c)
      .filter(c => c.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((id) => {
    setCart(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleCheckout = useCallback((inv) => {
    // Clear cart và cập nhật danh sách lịch sử khi thanh toán thành công
    setCart([]);
    loadHistory();
  }, [loadHistory]);

  const handleCartClose = () => {
    setShowCart(false);
    setCart([]);
  };

  const TABS = ['ALL', 'FOOD', 'SERVICE', 'PRODUCT'];

  const filtered = items.filter(it => {
    const matchTab = tab === 'ALL' || it.type === tab;
    const matchSearch = !search || it.name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  // Nhóm sản phẩm theo business type khi tab=ALL
  const groupedForDisplay = tab === 'ALL' && !search
    ? {
        food:    filtered.filter(i => i.type === 'FOOD'),
        service: filtered.filter(i => i.type === 'SERVICE'),
        product: filtered.filter(i => i.type === 'PRODUCT'),
      }
    : null;

  const cartQty = cart.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="page-container page-enter">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{view === 'sales' ? 'Bán hàng' : 'Lịch sử hóa đơn'}</div>
          <div className="page-sub">
            {view === 'sales' ? 'Chọn sản phẩm để thêm vào giỏ' : 'Xem danh sách và in lại hóa đơn đã bán'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {view === 'sales' ? (
            <>
              <button id="view-history-btn" className="btn btn-ghost btn-sm" onClick={() => { setView('history'); loadHistory(); }}>
                📄 Lịch sử
              </button>
              <button id="add-item-btn" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(true)}>
                + Thêm SP
              </button>
            </>
          ) : (
            <button id="view-sales-btn" className="btn btn-primary btn-sm" onClick={() => setView('sales')}>
              🛒 Quay lại bán hàng
            </button>
          )}
        </div>
      </div>

      {view === 'sales' ? (
        <>
          {/* Search */}
          <div className="input-group mb-4">
            <input
              id="pos-search"
              className="input"
              placeholder="🔍 Tìm sản phẩm..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Tabs */}
          <div className="tabs mb-4">
            {TABS.map(t => (
              <button key={t} id={`tab-${t.toLowerCase()}`} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {TAB_CONFIG[t]?.label || t}
              </button>
            ))}
          </div>

          {/* Product grid */}
          {loading ? (
            <div className="pos-grid">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <div className="empty-title">Không có sản phẩm</div>
              <div className="empty-body">Thêm món ăn, dịch vụ cắt tóc hoặc dịch vụ sửa xe.</div>
              <button className="btn btn-primary btn-sm mt-3" onClick={() => setShowAdd(true)}>+ Thêm ngay</button>
            </div>
          ) : groupedForDisplay ? (
            // Hiển thị theo nhóm khi tab=ALL
            <div className="flex-col gap-6">
              {[
                { key: 'food',    icon: '🍜', label: 'Đồ ăn / Nước uống', items: groupedForDisplay.food },
                { key: 'service', icon: '⚙️', label: 'Dịch vụ (Cắt tóc · Sửa xe)', items: groupedForDisplay.service },
                { key: 'product', icon: '📦', label: 'Vật tư / Hàng hóa', items: groupedForDisplay.product },
              ].filter(g => g.items.length > 0).map(group => (
                <div key={group.key}>
                  <div className="section-title mb-3">{group.icon} {group.label}</div>
                  <div className="pos-grid">
                    {group.items.map(item => {
                      const inCart = cart.find(c => c.id === item.id);
                      return <ItemCard key={item.id} item={item} inCart={inCart} onClick={() => addToCart(item)} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pos-grid">
              {filtered.map(item => {
                const inCart = cart.find(c => c.id === item.id);
                return <ItemCard key={item.id} item={item} inCart={inCart} onClick={() => addToCart(item)} />;
              })}
            </div>
          )}

          {/* FAB cart button */}
          {cartQty > 0 && (
            <button id="open-cart-fab" className="fab" onClick={() => setShowCart(true)} aria-label="Xem giỏ hàng">
              🛒
              <span className="fab-cart-count">{cartQty}</span>
            </button>
          )}
        </>
      ) : (
        /* History view */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {historyLoading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 90, borderRadius: 20 }} />
            ))
          ) : history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <div className="empty-title">Chưa có hóa đơn nào</div>
              <div className="empty-body">Thực hiện bán hàng để ghi nhận hóa đơn vào lịch sử hệ thống.</div>
              <button className="btn btn-primary btn-sm mt-3" onClick={() => setView('sales')}>🛒 Tạo hóa đơn mới</button>
            </div>
          ) : (
            history.map(inv => {
              const itemsCount = inv.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;
              const payLabel = { CASH: 'Tiền mặt', QR_BANK: 'QR Bank', CARD: 'Thẻ' };
              
              return (
                <div
                  key={inv.id}
                  className="card"
                  onClick={() => setSelectedInvoice(inv)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'transform 0.15s ease', padding: '16px 20px' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 14, color: 'var(--text-1)' }}>HD: {inv.id.slice(-8)}</strong>
                      <span className={`badge ${inv.paymentMethod === 'QR_BANK' ? 'badge-food' : inv.paymentMethod === 'CARD' ? 'badge-service' : 'badge-product'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                        {payLabel[inv.paymentMethod] || inv.paymentMethod}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {new Date(inv.createdAt).toLocaleString('vi-VN')} · {itemsCount} sản phẩm
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <strong style={{ fontSize: 16, color: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>
                      {fmtMoney(inv.total)}
                    </strong>
                    <span style={{ fontSize: 16, color: 'var(--text-2)' }}>➔</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modals */}
      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onAdded={item => setItems(prev => [...prev, item])} />}
      {showCart && (
        <CartSheet
          cart={cart}
          onClose={handleCartClose}
          onQty={changeQty}
          onRemove={removeItem}
          onCheckout={handleCheckout}
          user={user}
          bankProfile={bankProfile}
        />
      )}
      {selectedInvoice && (
        <HistoryInvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          user={user}
        />
      )}
    </div>
  );
}
