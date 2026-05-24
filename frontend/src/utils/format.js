// Utility helpers — format tiền VNĐ và ngày tháng
export const fmt = new Intl.NumberFormat('vi-VN');

export function fmtMoney(n) {
  if (n == null || isNaN(n)) return '0 ₫';
  return fmt.format(Math.round(n)) + ' ₫';
}

export function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtTime(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function daysUntil(dateStr) {
  const now = new Date();
  const due = new Date(dateStr);
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  return diff;
}

export function formatDaysLabel(days) {
  if (days < 0)  return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return 'Hôm nay!';
  if (days === 1) return 'Ngày mai';
  return `Còn ${days} ngày`;
}

export function generateId() {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Count-up animation hook helper
export function animateCountUp(el, target, duration = 800) {
  if (!el) return;
  const start = performance.now();
  const update = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = fmt.format(current) + ' ₫';
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
