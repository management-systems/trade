// Auto Trade API routes

import express from 'express';
import * as autoTradeState from '../services/autoTradeState.js';
import angelOneService from '../services/angelone.js';

const router = express.Router();

// Get current auto‑trade configuration
router.get('/config', (req, res) => {
  const config = {
    liveEnabled: autoTradeState.isAutoTradeEnabled(),
    params: autoTradeState.getAutoTradeParams(),
    criteria: autoTradeState.getAutoTradeCriteria()
  };
  res.json({ success: true, config });
});

// Update auto‑trade parameters (lot size, stop‑loss %, profit %)
router.post('/config', (req, res) => {
  const { lotSize, stopLossPct, profitPct, criteria } = req.body;
  // Basic validation
  if (lotSize !== undefined && (typeof lotSize !== 'number' || lotSize <= 0)) {
    return res.status(400).json({ success: false, error: 'Invalid lotSize; must be a positive number.' });
  }
  if (stopLossPct !== undefined && (typeof stopLossPct !== 'number' || stopLossPct <= 0)) {
    return res.status(400).json({ success: false, error: 'Invalid stopLossPct; must be a positive number.' });
  }
  if (profitPct !== undefined && (typeof profitPct !== 'number' || profitPct <= 0)) {
    return res.status(400).json({ success: false, error: 'Invalid profitPct; must be a positive number.' });
  }

  autoTradeState.setAutoTradeParams({
    lots: lotSize,
    stopLossPct,
    profitPct
  });

  if (criteria) {
    autoTradeState.setAutoTradeCriteria(criteria);
  }

  res.json({ 
    success: true, 
    config: { 
      params: autoTradeState.getAutoTradeParams(),
      criteria: autoTradeState.getAutoTradeCriteria()
    } 
  });
});

// Toggle live auto‑trade on/off – must be logged in to Angel One
router.post('/toggle', (req, res) => {
  const { enabled } = req.body;
  const shouldEnable = !!enabled;

  if (shouldEnable && !angelOneService.isConnected) {
    return res.status(403).json({ success: false, error: 'You must log in to Angel One first before enabling Live Mode.' });
  }

  autoTradeState.setAutoTradeEnabled(shouldEnable);
  res.json({ success: true, liveEnabled: autoTradeState.isAutoTradeEnabled() });
});

export default router;
