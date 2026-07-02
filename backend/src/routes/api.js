import express from 'express';
import angelOneService from '../services/angelone.js';
import paperTrader from '../services/paperTrader.js';
import riskManager from '../services/riskManager.js';
import marketSimulator from '../services/simulator.js';
import { analyzeSignal } from '../services/signalEngine.js';

const router = express.Router();

// --- AUTHENTICATION / LIVE MODE ---

// Login via Angel One API
router.post('/auth/login', async (req, res) => {
  const { clientCode, password, apiKey, totpSecret } = req.body;
  try {
    const result = await angelOneService.login({ clientCode, password, apiKey, totpSecret });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message || "Failed to authenticate" });
  }
});

// Logout / disconnect feed
router.post('/auth/logout', (req, res) => {
  angelOneService.logout();
  res.json({ success: true, message: "Logged out from Angel One" });
});

// Get session status
router.get('/auth/status', (req, res) => {
  res.json({
    connected: angelOneService.isConnected,
    clientCode: angelOneService.session?.clientcode || null,
    clientName: angelOneService.session?.clientname || null
  });
});


// --- MARKET DATA & INDICATORS ---

// Get current options chain, spots, and indicators snapshot
router.get('/market/data', (req, res) => {
  // Pull current active simulator data
  // (Note: if Angel One is connected, the spot price is overwritten by the real ticker)
  const data = marketSimulator.getLatestData();
  const signals = analyzeSignal(data);

  res.json({
    niftySpot: data.niftySpot,
    bankNiftySpot: data.bankNiftySpot,
    optionChain: data.optionChain,
    signal: {
      type: signals.signalType,
      confidence: signals.confidence,
      reason: signals.reason,
      atmStrike: signals.atmStrike
    },
    indicators: signals.indicators,
    candles: data.candles
  });
});


// --- PAPER TRADING ENGINE ---

// Fetch wallet stats, positions, history, and metrics
router.get('/paper/state', (req, res) => {
  res.json(paperTrader.getAccountState());
});

// Place a mock order
router.post('/paper/order', (req, res) => {
  const { symbol, type, optionType, strike, entryPrice, quantity, slPoints, targetPoints, isAutoSignal } = req.body;
  
  try {
    const newPos = paperTrader.placeOrder({
      symbol,
      type,
      optionType,
      strike,
      entryPrice: parseFloat(entryPrice),
      quantity: parseInt(quantity),
      slPoints: slPoints ? parseFloat(slPoints) : null,
      targetPoints: targetPoints ? parseFloat(targetPoints) : null,
      isAutoSignal: !!isAutoSignal
    });
    res.json({ success: true, position: newPos });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Close an active position
router.post('/paper/close', (req, res) => {
  const { positionId, exitPrice, reason } = req.body;
  
  try {
    const closedTrade = paperTrader.closePosition(positionId, parseFloat(exitPrice), reason || "MANUAL EXIT");
    res.json({ success: true, trade: closedTrade });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});


// --- RISK MANAGEMENT MODULE ---

// Fetch current limits and daily metrics
router.get('/risk/config', (req, res) => {
  res.json(riskManager.getRiskState());
});

// Update risk settings (max trades & daily stop loss)
router.post('/risk/config', (req, res) => {
  const { maxTradesPerDay, maxLossPerDay } = req.body;
  try {
    riskManager.updateConfig(maxTradesPerDay, maxLossPerDay);
    res.json({ success: true, riskState: riskManager.getRiskState() });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Manually reset daily loss and trade count limits for testing
router.post('/risk/reset', (req, res) => {
  riskManager.resetDailyStats();
  res.json({ success: true, message: "Daily risk tracking counters reset successfully." });
});

export default router;
