import express from 'express';
import angelOneService from '../services/angelone.js';
import paperTrader from '../services/paperTrader.js';
import * as autoTradeState from '../services/autoTradeState.js';
import autoTradeRoutes from './autoTradeRoutes.js';
import marketSimulator from '../services/simulator.js';
import { analyzeSignal } from '../services/signalEngine.js';
import riskManager from '../services/riskManager.js';
import liveTrader from '../services/liveTrader.js';

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
router.get('/auth/status', async (req, res) => {
  let funds = null;
  if (angelOneService.isConnected) {
    funds = await angelOneService.getFunds();
  }
  res.json({
    connected: angelOneService.isConnected,
    clientCode: angelOneService.clientCode || null,
    clientName: angelOneService.clientName || 'Active User',
    funds
  });
});


// --- TOMORROW OPENING ESTIMATOR ---

router.get('/market/tomorrow-opening', async (req, res) => {
  try {
    const tickers = {
      nifty:   '^NSEI',
      sp500:   '^GSPC',
      nasdaq:  '^IXIC',
      dow:     '^DJI',
      nikkei:  '^N225',
      hangseng:'^HSI',
      crude:   'BZ=F',
      usdInr:  'USDINR=X',
      gold:    'GC=F'
    };

    const fetchYahooMeta = async (ticker) => {
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const json = await response.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice || 0;
          const prevClose = meta.chartPreviousClose || meta.previousClose || 0;
          const pct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
          return { price, prevClose, pct };
        }
      } catch (err) {
        console.error(`Yahoo fetch error [${ticker}]:`, err.message);
      }
      return { price: 0, prevClose: 0, pct: 0 };
    };

    const results = {};
    await Promise.all(
      Object.entries(tickers).map(async ([key, symbol]) => {
        results[key] = await fetchYahooMeta(symbol);
      })
    );

    const latestData = marketSimulator.getLatestData();
    const vix = latestData?.indiaVix || 13.5;

    // PCR from live option chain
    let totalCeOi = 0, totalPeOi = 0;
    (latestData?.optionChain || []).forEach(row => {
      totalCeOi += parseFloat(row.ce?.oi) || 0;
      totalPeOi += parseFloat(row.pe?.oi) || 0;
    });
    const pcr = totalCeOi > 0 ? totalPeOi / totalCeOi : 1.0;

    // Nifty close position in day range
    const niftyLtp = results.nifty.price || latestData?.niftySpot || 24350;
    const niftyHigh = latestData?.indicators?.high || niftyLtp * 1.002;
    const niftyLow  = latestData?.indicators?.low  || niftyLtp * 0.998;
    const range = niftyHigh - niftyLow;
    const closePosPct = range > 0 ? ((niftyLtp - niftyLow) / range) * 100 : 50;

    // ── SCORING ──────────────────────────────────────────────────────────────
    // 1. GIFT Nifty proxy (20 pts) — weighted avg of S&P + Nasdaq overnight
    //    +1% US move ≈ +8 pts; neutral = 10 pts
    const avgUsChange = (results.sp500.pct * 0.6 + results.nasdaq.pct * 0.4);
    let giftNiftyScore = 10 + avgUsChange * 8;
    giftNiftyScore = Math.max(0, Math.min(20, giftNiftyScore));

    // 2. S&P 500 (15 pts) — most correlated with Nifty gap
    let sp500Score = 7.5 + results.sp500.pct * 6;
    sp500Score = Math.max(0, Math.min(15, sp500Score));

    // 3. Nasdaq (10 pts)
    let nasdaqScore = 5 + results.nasdaq.pct * 4;
    nasdaqScore = Math.max(0, Math.min(10, nasdaqScore));

    // 4. Dow Jones (5 pts)
    let dowScore = 2.5 + results.dow.pct * 2;
    dowScore = Math.max(0, Math.min(5, dowScore));

    // 5. Nikkei (5 pts) — Asian session leader
    let nikkeiScore = 2.5 + results.nikkei.pct * 2;
    nikkeiScore = Math.max(0, Math.min(5, nikkeiScore));

    // 6. Hang Seng (5 pts)
    let hangsengScore = 2.5 + results.hangseng.pct * 2;
    hangsengScore = Math.max(0, Math.min(5, hangsengScore));

    // 7. India VIX (8 pts) — VIX < 13 = full score; > 20 = 0
    //    Lower VIX = calmer market = bullish for gap-up
    let vixScore = 8 - ((vix - 10) / 12) * 8;
    vixScore = Math.max(0, Math.min(8, vixScore));

    // 8. Put-Call Ratio (8 pts)
    //    PCR 1.2+ = strong put writing = bullish (8 pts)
    //    PCR 0.7-  = call writing = bearish (0 pts)
    //    PCR 1.0   = neutral (5 pts)
    let pcrScore = ((pcr - 0.7) / (1.3 - 0.7)) * 8;
    pcrScore = Math.max(0, Math.min(8, pcrScore));

    // 9. Brent Crude (5 pts) — crude rise is bearish for India
    //    -2% crude = 5 pts; +2% crude = 0 pts
    let crudeScore = 2.5 - results.crude.pct * 1.25;
    crudeScore = Math.max(0, Math.min(5, crudeScore));

    // 10. USD/INR (5 pts) — INR strengthening (USD/INR falling) = bullish
    //     -0.5% = 5 pts; +0.5% = 0 pts
    let usdInrScore = 2.5 - results.usdInr.pct * 5;
    usdInrScore = Math.max(0, Math.min(5, usdInrScore));

    // 11. Gold (4 pts) — gold rising = risk-off = bearish for equities
    //     -0.5% gold = 4 pts; +1% gold = 0 pts
    let goldScore = 2 - results.gold.pct * 2;
    goldScore = Math.max(0, Math.min(4, goldScore));

    // 12. Previous Day Close Strength (5 pts)
    //     Closed near high = bullish carry; near low = bearish
    let prevCloseScore = (closePosPct / 100) * 5;
    prevCloseScore = Math.max(0, Math.min(5, prevCloseScore));

    // 13. FII/DII Flow Proxy (5 pts)
    //     Derived from Nifty close position + S&P direction
    let fiiScore = 2.5 + (closePosPct - 50) / 20 + results.sp500.pct * 0.5;
    fiiScore = Math.max(0, Math.min(5, fiiScore));

    const totalScore =
      giftNiftyScore + sp500Score + nasdaqScore + dowScore +
      nikkeiScore + hangsengScore + vixScore + pcrScore +
      crudeScore + usdInrScore + goldScore + prevCloseScore + fiiScore;

    // ── RECOMMENDATION ───────────────────────────────────────────────────────
    let recommendation, recReason;
    const t = parseFloat(totalScore.toFixed(1));
    if (t >= 72) {
      recommendation = 'BUY CE';
      recReason = `Very strong bullish confluence (${t}/100). High probability gap-up. Buy ATM or 1-strike OTM CE at 9:15 open.`;
    } else if (t >= 60) {
      recommendation = 'BUY CE (Wait for 9:20 confirm)';
      recReason = `Bullish bias (${t}/100). Wait for first 5-min candle to close above prev day high before entering CE.`;
    } else if (t <= 28) {
      recommendation = 'BUY PE';
      recReason = `Very strong bearish confluence (${t}/100). High probability gap-down. Buy ATM or 1-strike OTM PE at 9:15 open.`;
    } else if (t <= 40) {
      recommendation = 'BUY PE (Wait for 9:20 confirm)';
      recReason = `Bearish bias (${t}/100). Wait for first 5-min candle to close below prev day low before entering PE.`;
    } else {
      recommendation = 'NO TRADE — WAIT & WATCH';
      recReason = `Mixed signals (${t}/100). Market likely to open flat. Wait for 9:20–9:30 AM directional breakout before taking any position.`;
    }

    res.json({
      success: true,
      data: {
        // Scores
        giftNifty:   parseFloat(giftNiftyScore.toFixed(1)),
        sp500:       parseFloat(sp500Score.toFixed(1)),
        nasdaq:      parseFloat(nasdaqScore.toFixed(1)),
        dow:         parseFloat(dowScore.toFixed(1)),
        nikkei:      parseFloat(nikkeiScore.toFixed(1)),
        hangseng:    parseFloat(hangsengScore.toFixed(1)),
        vix:         parseFloat(vixScore.toFixed(1)),
        optionChain: parseFloat(pcrScore.toFixed(1)),
        crudeOil:    parseFloat(crudeScore.toFixed(1)),
        usdInr:      parseFloat(usdInrScore.toFixed(1)),
        gold:        parseFloat(goldScore.toFixed(1)),
        prevDayClose:parseFloat(prevCloseScore.toFixed(1)),
        fiiDii:      parseFloat(fiiScore.toFixed(1)),
        // Raw values for display
        pcr:         parseFloat(pcr.toFixed(2)),
        closePosPct: Math.round(closePosPct),
        vixVal:      vix,
        sp500Pct:    parseFloat(results.sp500.pct.toFixed(2)),
        nasdaqPct:   parseFloat(results.nasdaq.pct.toFixed(2)),
        dowPct:      parseFloat(results.dow.pct.toFixed(2)),
        nikkeiPct:   parseFloat(results.nikkei.pct.toFixed(2)),
        hangsengPct: parseFloat(results.hangseng.pct.toFixed(2)),
        crudePct:    parseFloat(results.crude.pct.toFixed(2)),
        usdInrPct:   parseFloat(results.usdInr.pct.toFixed(2)),
        goldPct:     parseFloat(results.gold.pct.toFixed(2)),
        recommendation,
        recReason
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// --- MARKET DATA & INDICATORS ---

// Get current options chain, spots, and indicators snapshot
router.get('/market/data', (req, res) => {
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
router.get('/paper/state', async (req, res) => {
  try {
    const state = await paperTrader.getAccountState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Place a mock order
router.post('/paper/order', async (req, res) => {
  const { symbol, type, optionType, strike, entryPrice, quantity, slPoints, targetPoints, isAutoSignal, entryCriteria } = req.body;
  
  try {
    const newPos = await paperTrader.placeOrder({
      symbol,
      type,
      optionType,
      strike,
      entryPrice: parseFloat(entryPrice),
      quantity: parseInt(quantity),
      slPoints: slPoints ? parseFloat(slPoints) : null,
      targetPoints: targetPoints ? parseFloat(targetPoints) : null,
      isAutoSignal: !!isAutoSignal,
      entryCriteria
    });
    res.json({ success: true, position: newPos });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Close an active position
router.post('/paper/close', async (req, res) => {
  const { positionId, exitPrice, reason } = req.body;
  
  try {
    const closedTrade = await paperTrader.closePosition(positionId, parseFloat(exitPrice), reason || "MANUAL EXIT");
    res.json({ success: true, trade: closedTrade });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});


// --- RISK MANAGEMENT MODULE ---

// Fetch current limits and daily metrics
router.get('/risk/config', async (req, res) => {
  try {
    const state = await riskManager.getRiskState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update risk settings (max trades & daily stop loss)
router.post('/risk/config', async (req, res) => {
  const { maxTradesPerDay, maxLossPerDay } = req.body;
  try {
    await riskManager.updateConfig(maxTradesPerDay, maxLossPerDay);
    const state = await riskManager.getRiskState();
    res.json({ success: true, riskState: state });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Manually reset daily loss and trade count limits for testing
router.post('/risk/reset', async (req, res) => {
  try {
    await riskManager.resetDailyStats();
    res.json({ success: true, message: "Daily risk tracking counters reset successfully." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Place a real-money live order via Angel One SmartAPI
router.post('/live/order', async (req, res) => {
  const { symbol, token, strike, quantity, transactionType, optionType } = req.body;
  try {
    const result = await angelOneService.placeOrder({
      symbol,
      token,
      strike: parseInt(strike),
      quantity: parseInt(quantity),
      transactionType: transactionType || 'BUY',
      optionType
    });

    // Record live trade entry in MongoDB
    let entryPrice = 10.0;
    const latestMarket = marketSimulator.getLatestData();
    if (latestMarket && latestMarket.optionChain) {
      const matched = latestMarket.optionChain.find(c => c.strike === parseInt(strike));
      if (matched) {
        entryPrice = optionType === 'CE' ? matched.ce.ltp : matched.pe.ltp;
      }
    }

    await liveTrader.recordEntry({
      symbol,
      strike,
      quantity,
      entryPrice,
      optionType,
      slPoints: 15,
      targetPoints: 30,
      isAutoSignal: false,
      entryCriteria: { niftySpot: latestMarket?.niftySpot || 0, reasons: ["Manual Order Live"] }
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Fetch active live positions from Angel One
router.get('/live/positions', async (req, res) => {
  try {
    const positions = await angelOneService.getPositions();
    res.json({ success: true, positions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Square off / Close an active live position
router.post('/live/close', async (req, res) => {
  const { symbol, quantity, transactionType } = req.body;
  try {
    const result = await angelOneService.placeOrder({
      symbol,
      strike: 0,
      quantity: Math.abs(parseInt(quantity)),
      transactionType: transactionType === 'BUY' ? 'SELL' : 'BUY', // Opposite action
      optionType: symbol.endsWith('CE') ? 'CE' : 'PE'
    });

    // Record exit in live trade database
    let exitPrice = 10.0;
    const latestMarket = marketSimulator.getLatestData();
    if (latestMarket && latestMarket.optionChain) {
      const strikeMatch = parseInt(symbol.replace(/\D/g, ''));
      if (strikeMatch) {
        const matched = latestMarket.optionChain.find(c => c.strike === strikeMatch);
        if (matched) {
          exitPrice = symbol.endsWith('CE') ? matched.ce.ltp : matched.pe.ltp;
        }
      }
    }

    await liveTrader.recordExit(symbol, exitPrice, "MANUAL EXIT");

    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Fetch wallet stats, positions, history, and metrics for Live Mode
router.get('/live/state', async (req, res) => {
  try {
    const state = await liveTrader.getAccountState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.use('/auto-trade', autoTradeRoutes);
export default router;
