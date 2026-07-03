const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5072/api';

export async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API Request failed');
  }

  return data;
}

export const api = {
  // Authentication / Live Mode
  loginAngelOne: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  logoutAngelOne: () => request('/auth/logout', { method: 'POST' }),
  checkAngelOneStatus: () => request('/auth/status'),

  // Market & Indicators
  getMarketData: () => request('/market/data'),

  // Paper Trading
  getPaperState: () => request('/paper/state'),
  placePaperOrder: (orderParams) => request('/paper/order', { method: 'POST', body: orderParams }),
  closePaperPosition: (positionId, exitPrice, reason) => 
    request('/paper/close', { method: 'POST', body: { positionId, exitPrice, reason } }),
  
  // Live Trading
  placeLiveOrder: (orderParams) => request('/live/order', { method: 'POST', body: orderParams }),
  getLivePositions: () => request('/live/positions'),
  closeLivePosition: (body) => request('/live/close', { method: 'POST', body }),
  getLivePositions: () => request('/live/positions'),
  closeLivePosition: (symbol, quantity, transactionType) => request('/live/close', { method: 'POST', body: { symbol, quantity, transactionType } }),

  // Auto‑Trade configuration
  getAutoTradeConfig: () => request('/auto-trade/config'),
  updateAutoTradeConfig: (config) => request('/auto-trade/config', { method: 'POST', body: config }),
  toggleAutoTradeLive: (enabled) => request('/auto-trade/toggle', { method: 'POST', body: { enabled } }),

  // Risk Management
  getRiskConfig: () => request('/risk/config'),
  updateRiskConfig: (riskParams) => request('/risk/config', { method: 'POST', body: riskParams }),
  resetRiskLimits: () => request('/risk/reset', { method: 'POST' })
};
