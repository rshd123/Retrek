const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const authStorage = {
  getToken: () => localStorage.getItem('retrek_token'),
  setToken: (token) => localStorage.setItem('retrek_token', token),
  clearToken: () => localStorage.removeItem('retrek_token'),
  getUser: () => {
    try {
      const raw = localStorage.getItem('retrek_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem('retrek_user', JSON.stringify(user)),
  clearUser: () => localStorage.removeItem('retrek_user'),
  clear: () => {
    localStorage.removeItem('retrek_token');
    localStorage.removeItem('retrek_user');
    localStorage.removeItem('retrek_last_activity');
  },
  getLastActivity: () => {
    const ts = localStorage.getItem('retrek_last_activity');
    return ts ? parseInt(ts, 10) : null;
  },
  setLastActivity: () => {
    localStorage.setItem('retrek_last_activity', String(Date.now()));
  }
};

async function request(endpoint, options = {}) {
  const token = authStorage.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  async signup({ email, username, password }) {
    const res = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
    if (res.data?.token) {
      authStorage.setToken(res.data.token);
      authStorage.setUser(res.data.user);
    }
    return res.data;
  },

  async login({ email, password }) {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.data?.token) {
      authStorage.setToken(res.data.token);
      authStorage.setUser(res.data.user);
    }
    return res.data;
  },

  async getMe() {
    const res = await request('/auth/me', { method: 'GET' });
    if (res.data?.user) {
      authStorage.setUser(res.data.user);
    }
    return res.data?.user;
  },

  logout() {
    authStorage.clear();
  },

  // Dashboard & ROI
  async getROI() {
    return request('/dashboard/roi', { method: 'GET' });
  },

  // Transactions
  async getTransactions() {
    return request('/transactions', { method: 'GET' });
  },

  async getTransaction(id) {
    return request(`/transactions/${id}`, { method: 'GET' });
  },

  async seedTransactions() {
    return request('/transactions/seed', { method: 'POST' });
  },

  async ingestTransaction(payload) {
    return request('/transactions/ingest', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async processTransaction(id) {
    return request(`/transactions/${id}/process`, { method: 'POST' });
  },

  async batchProcessTransactions() {
    return request('/transactions/batch-process', { method: 'POST' });
  },

  // Approvals
  async getPendingApprovals() {
    return request('/approvals/pending', { method: 'GET' });
  },

  async approveTransaction(id, comment) {
    return request(`/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  },

  async declineTransaction(id, reason) {
    return request(`/approvals/${id}/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Audit Logs
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/audit-logs/logs${query ? `?${query}` : ''}`, { method: 'GET' });
  },

  // Benchmark
  async runBenchmark() {
    return request('/benchmark/run', { method: 'GET' });
  },

  async getBenchmarkResults() {
    return request('/benchmark/results', { method: 'GET' });
  },

  // Health
  async getHealth() {
    return request('/health', { method: 'GET' });
  },

  // Scenarios
  async getScenarioStats() {
    return request('/transactions/scenarios', { method: 'GET' });
  },
};
