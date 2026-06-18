/**
 * sessionManager.js
 * Quản lý phiên đăng nhập phía frontend:
 *  - Gửi heartbeat mỗi 5 phút khi user đang active
 *  - Gọi logout API khi tab đóng hoặc user click logout
 *  - Dừng heartbeat khi tab bị ẩn (visibility API)
 */
import { authApi } from '../api/client';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 phút

let heartbeatTimer = null;
let isActive = false;

function isLoggedIn() {
  return !!localStorage.getItem('token');
}

async function sendHeartbeat() {
  if (!isLoggedIn()) return;
  try {
    await authApi.heartbeat();
  } catch {
    // Bỏ qua lỗi heartbeat — không ảnh hưởng UX
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return; // Đã chạy rồi
  isActive = true;
  // Gửi ngay lập tức một cái đầu tiên
  sendHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState !== 'hidden') {
      sendHeartbeat();
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  isActive = false;
}

/**
 * Gọi API logout và dọn localStorage
 * fire-and-forget: dùng sendBeacon nếu có, hoặc fetch bình thường
 */
export async function logoutAndClear() {
  stopHeartbeat();
  if (isLoggedIn()) {
    try {
      // sendBeacon để đảm bảo request gửi được ngay cả khi tab đóng
      const token = localStorage.getItem('token');
      const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
      const url = `${base}/auth/logout`;
      const sent = navigator.sendBeacon
        ? navigator.sendBeacon(url, new Blob([JSON.stringify({})], { type: 'application/json' }))
        : false;
      if (!sent) {
        // Fallback: fetch bình thường
        await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          keepalive: true,
        });
      }
    } catch {
      // Ignore
    }
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// ── Khởi động session manager ─────────────────────────────────────────────────
export function initSessionManager() {
  if (!isLoggedIn()) return;

  startHeartbeat();

  // Dừng heartbeat khi tab ẩn, tiếp tục khi tab hiện lại
  document.addEventListener('visibilitychange', () => {
    if (!isLoggedIn()) return;
    if (document.visibilityState === 'visible') {
      sendHeartbeat(); // Gửi ngay khi quay lại
    }
  });

  // Gửi logout khi đóng tab / reload
  window.addEventListener('beforeunload', () => {
    if (!isLoggedIn()) return;
    const token = localStorage.getItem('token');
    const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
    navigator.sendBeacon?.(`${base}/auth/logout`,
      new Blob([JSON.stringify({})], { type: 'application/json' })
    );
    // Không xóa localStorage ở đây — để user vẫn dùng được nếu chỉ reload
  });
}

export { startHeartbeat, stopHeartbeat };
