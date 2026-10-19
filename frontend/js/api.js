/**
 * Precision Portfolio Management System - API Client
 * Connects to FastAPI Backend at http://127.0.0.1:8000
 */

const API_BASE_URL = 'http://127.0.0.1:8000';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.tokenKey = 'portfolio_jwt_token';
    this.userKey = 'portfolio_user_info';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token) {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  getUser() {
    try {
      const user = localStorage.getItem(this.userKey);
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  setUser(user) {
    if (user) {
      localStorage.setItem(this.userKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.userKey);
    }
  }

  clearAuth() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized / Token Expiration
      if (response.status === 401) {
        const errData = await response.json().catch(() => ({}));
        this.clearAuth();
        window.dispatchEvent(new CustomEvent('session-expired', { detail: errData }));
        const error = new Error(errData.detail || 'Session expired. Please log in again.');
        error.status = 401;
        error.data = errData;
        throw error;
      }

      if (response.status === 204) {
        return null;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let message = 'An error occurred';
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (Array.isArray(data.detail)) {
          message = data.detail.map(d => `${d.msg} (${(d.loc || []).join(' -> ')})`).join(', ');
        }
        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const error = new Error('Cannot connect to backend server. Make sure FastAPI is running on http://127.0.0.1:8000');
        error.status = 0;
        throw error;
      }
      throw err;
    }
  }

  // --- Auth Endpoints ---
  async signup(email, password, baseCurrency = 'USD') {
    const data = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, base_currency: baseCurrency }),
    });
    return data;
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.access_token) {
      this.setToken(data.access_token);
      // Fetch user profile immediately
      const profile = await this.getProfile().catch(() => null);
      if (profile) this.setUser(profile);
    }
    return data;
  }

  async getProfile() {
    const user = await this.request('/auth/me');
    this.setUser(user);
    return user;
  }

  // --- Portfolio Endpoints ---
  async getPortfolios() {
    return this.request('/portfolios');
  }

  async getPortfolio(id) {
    return this.request(`/portfolios/${id}`);
  }

  async createPortfolio(name) {
    return this.request('/portfolios', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deletePortfolio(id) {
    return this.request(`/portfolios/${id}`, {
      method: 'DELETE',
    });
  }

  async getPortfolioValuation(id) {
    return this.request(`/portfolios/${id}/valuation`);
  }

  // --- Holding Endpoints ---
  async addHolding(portfolioId, holdingData) {
    return this.request(`/portfolios/${portfolioId}/holdings`, {
      method: 'POST',
      body: JSON.stringify({
        symbol: holdingData.symbol.toUpperCase(),
        name: holdingData.name || holdingData.symbol,
        type: holdingData.type || 'stock',
        quantity: parseFloat(holdingData.quantity),
        average_buy_price: parseFloat(holdingData.average_buy_price),
      }),
    });
  }

  async updateHolding(portfolioId, holdingId, holdingData) {
    return this.request(`/portfolios/${portfolioId}/holdings/${holdingId}`, {
      method: 'PUT',
      body: JSON.stringify({
        quantity: parseFloat(holdingData.quantity),
        average_buy_price: parseFloat(holdingData.average_buy_price),
      }),
    });
  }

  async deleteHolding(portfolioId, holdingId) {
    return this.request(`/portfolios/${portfolioId}/holdings/${holdingId}`, {
      method: 'DELETE',
    });
  }

  async getHoldingValuation(portfolioId, holdingId) {
    return this.request(`/portfolios/${portfolioId}/holdings/${holdingId}/valuation`);
  }

  // --- Market & News Endpoints ---
  async getSymbolStats() {
    return this.request('/market/symbols/stats');
  }

  async getAllSymbols(type = 'stock') {
    const cacheKey = `portfolio_catalog_${type}`;
    const cacheTimeKey = `portfolio_catalog_time_${type}`;
    const cached = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);
    const now = Date.now();

    // Cache in localStorage for 24 hours
    if (cached && cachedTime && (now - parseInt(cachedTime, 10)) < 86400000) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // fallback to fetch
      }
    }

    const t = encodeURIComponent(type.trim());
    const data = await this.request(`/market/symbols/all?type=${t}`);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(cacheTimeKey, now.toString());
    } catch (e) {
      // If quota exceeded, just keep in memory
    }
    return data;
  }

  async searchSymbols(type = 'stock', query = '', limit = 50) {
    const q = encodeURIComponent(query.trim());
    const t = encodeURIComponent(type.trim());
    return this.request(`/market/symbols?type=${t}&query=${q}&limit=${limit}`);
  }

  async getPriceHistory(symbol, type = 'stock', interval = '1M') {
    const s = encodeURIComponent(symbol.trim().toUpperCase());
    const t = encodeURIComponent(type.trim().toLowerCase());
    const i = encodeURIComponent(interval.trim().toUpperCase());
    return this.request(`/market/history?symbol=${s}&type=${t}&interval=${i}`);
  }

  async getExchanges() {

    return this.request('/market/exchanges');
  }

  async getNews() {
    return this.request('/market/news');
  }

  async getTransactions() {
    return this.request('/transactions');
  }
}


window.api = new ApiClient();

