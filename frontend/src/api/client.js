// API client — centralized fetch wrapper với JWT auto-inject
const BASE = '/api/v1';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  // 401 → clear token & redirect to login
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Lỗi ${res.status}`);
  }

  return data;
}

// ── Auth ───────────────────────────────────────────────────────
export const authApi = {
  login: (taxCode, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ taxCode, password }) }),
  register: (taxCode, businessName, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ taxCode, businessName, password }) }),
  profile: () => request('/auth/profile'),
  updateProfile: (data) =>
    request('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── POS ────────────────────────────────────────────────────────
export const posApi = {
  getItems: () => request('/pos/items'),
  createItem: (item) => {
    const body = item instanceof FormData ? item : JSON.stringify(item);
    return request('/pos/items', { method: 'POST', body });
  },
  createInvoice: (invoice) => request('/pos/invoices', { method: 'POST', body: JSON.stringify(invoice) }),
  getInvoices: (limit = 50) => request(`/pos/invoices?limit=${limit}`),
  getExpenses: () => request('/pos/expenses'),
  createExpense: (expense) => request('/pos/expenses', { method: 'POST', body: JSON.stringify(expense) }),
  deleteExpense: (id) => request(`/pos/expenses/${id}`, { method: 'DELETE' }),
};

// ── Tax ────────────────────────────────────────────────────────
export const taxApi = {
  calculate: (taxType, revenue, businessType, expenses = 0) =>
    request('/tax/calculate', { method: 'POST', body: JSON.stringify({ taxType, revenue, businessType, expenses }) }),
  saveDeclaration: (data) =>
    request('/tax/declarations', { method: 'POST', body: JSON.stringify(data) }),
  getDeclarations: () => request('/tax/declarations'),
};

// ── Calendar ───────────────────────────────────────────────────
export const calendarApi = {
  getDeadlines: () => request('/calendar/deadlines'),
  createDeadline: (data) =>
    request('/calendar/deadlines', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    request(`/calendar/deadlines/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ── AI Chat ────────────────────────────────────────────────────
export const chatApi = {
  send: (content) =>
    request('/ai/message', { method: 'POST', body: JSON.stringify({ content }) }),
  history: () => request('/ai/history'),
  clear: () => request('/ai/history', { method: 'DELETE' }),
};

// ── Invoices OCR ───────────────────────────────────────────────
export const invoiceApi = {
  analyze: (formData) => {
    const token = getToken();
    return fetch(`${BASE}/invoices/analyze`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(r => r.json());
  },
  getAll: () => request('/invoices'),
};
