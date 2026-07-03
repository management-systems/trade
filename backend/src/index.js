import express from 'express';
import fs from 'fs';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config.js';
import * as autoTradeState from './services/autoTradeState.js';
import * as autoTradeEvaluator from './services/autoTradeEvaluator.js';
import marketSimulator from './services/simulator.js';
import apiRouter from './routes/api.js';

// Auto‑trade control variables
let autoTradeLiveEnabled = false;
let autoTradeParams = {
  lots: 1,
  stopLossPct: 2,
  profitPct: 3
};
import angelOneService from './services/angelone.js';
import paperTrader from './services/paperTrader.js';
import liveTrader from './services/liveTrader.js';
import scripMaster from './services/scripMaster.js';
import { analyzeSignal } from './services/signalEngine.js';

const app = express();

// CORS — allow any localhost port (dev) + production domain
const productionOrigins = [
  'https://trade.managementsystems.in',
  'https://www.trade.managementsystems.in'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any localhost port for local development
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);
    // Allow production domains
    if (productionOrigins.includes(origin)) return callback(null, true);
    // Allow all Vercel preview deployments
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Bind routes
app.use('/api', apiRouter);

// Set up server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Active WebSocket client connections
const clients = new Set();

wss.on('connection', async (ws) => {
  console.log(`WebSocket: Client connected. Total: ${clients.size + 1}`);
  clients.add(ws);
  
  // Send immediate snapshot on connection
  try {
    const latestMarket = marketSimulator.getLatestData();
    const signalResult = analyzeSignal(latestMarket);
    const paperState = await paperTrader.getAccountState();
    
    ws.send(JSON.stringify({
      type: 'WELCOME',
      data: {
        niftySpot: latestMarket.niftySpot,
        bankNiftySpot: latestMarket.bankNiftySpot,
        optionChain: latestMarket.optionChain,
        signal: {
          type: signalResult.signalType,
          confidence: signalResult.confidence,
          reason: signalResult.reason,
          atmStrike: signalResult.atmStrike
        },
        indicators: signalResult.indicators,
        candles: latestMarket.candles,
        paper: paperState
      }
    }));
  } catch (e) {
    console.error("WebSocket: Error sending welcome snapshot:", e);
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`WebSocket: Client disconnected. Total: ${clients.size}`);
  });
});

// Broadcast helper
function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}

let lastSpotUpdateTime = 0;

// Connect Angel One live spot feed to the simulator
angelOneService.on('spotTick', ({ index, price }) => {
  if (index === 'NIFTY') {
    marketSimulator.niftySpot = price;
    lastSpotUpdateTime = Date.now();
  } else if (index === 'BANKNIFTY') {
    marketSimulator.bankNiftySpot = price;
  } else if (index === 'VIX') {
    marketSimulator.indiaVix = price;
  }
});

function isMarketOpen() {
  const now = new Date();
  // Get UTC time in milliseconds, add 5.5 hours for IST offset (19800000 ms)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istTime = new Date(utc + 19800000);
  
  const day = istTime.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return false;
  
  const currentMinutes = istTime.getHours() * 60 + istTime.getMinutes();
  // 9:15 AM to 3:30 PM (555 to 930)
  return currentMinutes >= 555 && currentMinutes <= 930;
}

// Storing previous OI values to calculate live OI Change (%) dynamically
const prevOiMap = new Map();
let optionChainTickCounter = 0;
let cachedOptionChain = [];

// Main Tick Loop: simulator emits updates every second
marketSimulator.on('tick', async (marketData) => {
  marketSimulator.isLiveMode = angelOneService.isConnected;
  const connected = angelOneService.isConnected;
  const open = isMarketOpen();

  // If live mode is connected, check if WebSocket feed has stopped updating
  if (connected && open && (Date.now() - lastSpotUpdateTime > 3500)) {
    try {
      const idxQ = await angelOneService.getIndexQuotes(['99926000', '99926017']);
      if (idxQ && idxQ.length > 0) {
        idxQ.forEach(q => {
          if (q.symbolToken === '99926000') {
            marketSimulator.niftySpot = parseFloat(q.ltp || 0);
            lastSpotUpdateTime = Date.now();
          }
          if (q.symbolToken === '99926017') {
            marketSimulator.indiaVix = parseFloat(q.ltp || 0);
          }
        });
      }
    } catch (e) {
      console.error("Index: Fallback REST spot quotes failed:", e.message);
    }
  }

  if (!connected) {
    const paperStateFallback = await paperTrader.getAccountState().catch(() => null);
    const liveStateFallback = await liveTrader.getAccountState().catch(() => null);
    broadcast({
      type: 'TICK',
      timestamp: new Date().toISOString(),
      niftySpot: 0,
      bankNiftySpot: 0,
      indiaVix: 14.5,
      futuresOi: 0, futuresPrice: 0, futuresContractOi: 0, futuresOiChange: 0,
      optionChain: [],
      signal: { type: 'NO TRADE', confidence: 0, reason: 'Broker feed offline', atmStrike: null },
      indicators: {}, candles: [],
      paper: paperStateFallback,
      liveState: liveStateFallback,
      liveModeActive: false,
      marketClosed: !open
    });
    return;
  }

  // When market is closed — broadcast the cached closing values directly
  if (!open) {
    const paperStateClosed = await paperTrader.getAccountState().catch(() => null);
    const liveStateClosed = await liveTrader.getAccountState().catch(() => null);
    const signalClosed = analyzeSignal(marketData);
    broadcast({
      type: 'TICK',
      timestamp: new Date().toISOString(),
      niftySpot: marketData.niftySpot,
      bankNiftySpot: marketData.bankNiftySpot,
      indiaVix: marketData.indiaVix,
      futuresOi: marketData.futuresOi || 0,
      futuresPrice: marketData.futuresPrice || (marketData.niftySpot + 12),
      futuresContractOi: marketData.futuresContractOi || 0,
      futuresOiChange: 0,
      optionChain: cachedOptionChain.length > 0 ? cachedOptionChain : (marketData.optionChain || []),
      signal: { type: signalClosed.signalType, confidence: signalClosed.confidence, reason: 'Market Closed — Showing last updated closing rates', atmStrike: signalClosed.atmStrike },
      indicators: signalClosed.indicators,
      candles: marketData.candles || [],
      paper: paperStateClosed,
      liveState: liveStateClosed,
      liveModeActive: connected,
      marketClosed: true
    });
    return;
  }

  // 1. If Angel One is connected, fetch real option chain data
  if (connected) {
    try {
      const spot = marketData.niftySpot;
      if (spot > 0) {
        optionChainTickCounter++;
        if (optionChainTickCounter % 3 === 0 || cachedOptionChain.length === 0) {
          const atmStrike = Math.round(spot / 50) * 50;
          const strikes = [];
          for (let i = -5; i <= 5; i++) strikes.push(atmStrike + i * 50);

          const contracts = scripMaster.getStrikeContracts('NIFTY', strikes);
          const tokens = [];
          contracts.forEach(c => {
            if (c.ce) tokens.push(c.ce.token);
            if (c.pe) tokens.push(c.pe.token);
          });
          const futScrip = scripMaster.getNiftyFutures();
          if (futScrip) tokens.push(futScrip.token);

          if (tokens.length > 0) {
            const quotes = await angelOneService.getMarketQuotes(tokens);
            if (quotes && quotes.length > 0) {
              const quoteMap = {};
              quotes.forEach(q => { quoteMap[q.symbolToken] = q; });

              if (futScrip && quoteMap[futScrip.token]) {
                const fQuote = quoteMap[futScrip.token];
                const futOi = parseInt(fQuote.opnInterest || 0);
                marketData.futuresPrice = parseFloat(fQuote.ltp || 0);
                marketData.futuresContractOi = futOi;
                marketData.futuresOiChange = prevOiMap.has(futScrip.token) ? futOi - prevOiMap.get(futScrip.token) : 0;
                prevOiMap.set(futScrip.token, futOi);
              }

              cachedOptionChain = contracts.map(c => {
                const ceQuote = c.ce ? quoteMap[c.ce.token] : null;
                const peQuote = c.pe ? quoteMap[c.pe.token] : null;
                const ceOi = ceQuote ? parseInt(ceQuote.opnInterest || 0) : 0;
                const peOi = peQuote ? parseInt(peQuote.opnInterest || 0) : 0;
                const ceOiChange = c.ce && prevOiMap.has(c.ce.token) ? ceOi - prevOiMap.get(c.ce.token) : 0;
                const peOiChange = c.pe && prevOiMap.has(c.pe.token) ? peOi - prevOiMap.get(c.pe.token) : 0;
                if (c.ce) prevOiMap.set(c.ce.token, ceOi);
                if (c.pe) prevOiMap.set(c.pe.token, peOi);
                return {
                  strike: c.strike,
                  ce: { symbol: c.ce?.symbol || `NIFTY${c.strike}CE`, ltp: ceQuote ? parseFloat(ceQuote.ltp || 0) : 10, oi: ceOi, oiChange: ceOiChange, oiChangePercent: ceOi ? parseFloat(((ceOiChange / ceOi) * 100).toFixed(2)) : 0, volume: ceQuote ? parseInt(ceQuote.tradeVolume || 0) : 0 },
                  pe: { symbol: c.pe?.symbol || `NIFTY${c.strike}PE`, ltp: peQuote ? parseFloat(peQuote.ltp || 0) : 10, oi: peOi, oiChange: peOiChange, oiChangePercent: peOi ? parseFloat(((peOiChange / peOi) * 100).toFixed(2)) : 0, volume: peQuote ? parseInt(peQuote.tradeVolume || 0) : 0 }
                };
              });
            }
          }
        }
        if (cachedOptionChain.length > 0) marketData.optionChain = cachedOptionChain;
      }
    } catch (err) {
      console.error("Index: Failed to fetch real option chain quotes:", err.message);
    }
  }

  // 2. Process positions and check stop losses / targets
  const closedPositions = await paperTrader.updatePositionsLtp(marketData.niftySpot, marketData.optionChain) || [];

  // Notify clients if any positions closed automatically
  closedPositions.forEach(trade => {
    broadcast({
      type: 'POSITION_CLOSED_ALERT',
      trade
    });
  });

  // 3. Perform Signal analysis
  const signalResult = analyzeSignal(marketData);
// Auto‑trade evaluation
const isLiveAutoEnabled = autoTradeState.isAutoTradeEnabled(); // liveEnabled from config
const { cePass, pePass, ceProb, peProb } = autoTradeEvaluator.getMandatoryPasses(marketData, signalResult.indicators, signalResult.signalType);
const { strike } = autoTradeEvaluator.determineNearestStrike(marketData.niftySpot);

// A. Paper Auto-Trading (Always Active in background)
if (strike > 0 && marketData.optionChain && marketData.optionChain.length > 0) {
  const hasCEPaper = paperTrader.positions.some(p => p.optionType === 'CE');
  const hasPEPaper = paperTrader.positions.some(p => p.optionType === 'PE');

  // CE Paper Order
  if (cePass && !hasCEPaper) {
    const ceContract = marketData.optionChain.find(c => c.strike === strike)?.ce;
    if (ceContract) {
      const entryPrice = ceContract.ltp;
      const slPoints = parseFloat((entryPrice * 0.10).toFixed(2)); // 10% loss
      const targetPoints = parseFloat((entryPrice * 0.15).toFixed(2)); // 15% profit
      const qty = 10 * config.NIFTY_LOT_SIZE; // 10 lots

      try {
        await paperTrader.placeOrder({
          symbol: ceContract.symbol,
          type: 'BUY',
          optionType: 'CE',
          strike,
          entryPrice,
          quantity: qty,
          slPoints,
          targetPoints,
          isAutoSignal: true,
          entryCriteria: {
            niftySpot: marketData.niftySpot,
            ceProbability: ceProb,
            peProbability: peProb,
            reasons: ["Paper Auto‑trade: CE probability >= 50%"]
          }
        });
        broadcast({ type: 'AUTO_TRADE_LOG', message: `Paper CE Auto‑trade executed at ${strike} (Qty: ${qty}, Entry: ₹${entryPrice})` });
      } catch (e) {
        console.error('Paper Auto‑trade CE order failed:', e.message);
      }
    }
  }

  // PE Paper Order
  if (pePass && !hasPEPaper) {
    const peContract = marketData.optionChain.find(c => c.strike === strike)?.pe;
    if (peContract) {
      const entryPrice = peContract.ltp;
      const slPoints = parseFloat((entryPrice * 0.10).toFixed(2)); // 10% loss
      const targetPoints = parseFloat((entryPrice * 0.15).toFixed(2)); // 15% profit
      const qty = 10 * config.NIFTY_LOT_SIZE; // 10 lots

      try {
        await paperTrader.placeOrder({
          symbol: peContract.symbol,
          type: 'BUY',
          optionType: 'PE',
          strike,
          entryPrice,
          quantity: qty,
          slPoints,
          targetPoints,
          isAutoSignal: true,
          entryCriteria: {
            niftySpot: marketData.niftySpot,
            ceProbability: ceProb,
            peProbability: peProb,
            reasons: ["Paper Auto‑trade: PE probability >= 50%"]
          }
        });
        broadcast({ type: 'AUTO_TRADE_LOG', message: `Paper PE Auto‑trade executed at ${strike} (Qty: ${qty}, Entry: ₹${entryPrice})` });
      } catch (e) {
        console.error('Paper Auto‑trade PE order failed:', e.message);
      }
    }
  }
}

// B. Live Auto-Trading (Active only when liveEnabled is clicked active)
if (isLiveAutoEnabled && strike > 0 && marketData.optionChain && marketData.optionChain.length > 0) {
  let hasCELive = false;
  let hasPELive = false;
  try {
    const livePositionsList = await angelOneService.getPositions() || [];
    hasCELive = livePositionsList.some(p => p.tradingsymbol?.endsWith('CE') && parseInt(p.netqty || 0) > 0);
    hasPELive = livePositionsList.some(p => p.tradingsymbol?.endsWith('PE') && parseInt(p.netqty || 0) > 0);
  } catch (err) {
    console.error("AutoTrade: Failed to verify live positions list for double entry:", err);
  }

  // CE Live Order
  if (cePass && !hasCELive) {
    const ceContract = marketData.optionChain.find(c => c.strike === strike)?.ce;
    if (ceContract) {
      const qty = 2 * config.NIFTY_LOT_SIZE; // 2 lots
      try {
        await angelOneService.placeOrder({
          symbol: ceContract.symbol,
          strike,
          quantity: qty,
          transactionType: 'BUY',
          optionType: 'CE'
        });
        await liveTrader.recordEntry({
          symbol: ceContract.symbol,
          strike,
          quantity: qty,
          entryPrice: ceContract.ltp,
          optionType: 'CE',
          slPoints: 15,
          targetPoints: 30,
          isAutoSignal: true,
          entryCriteria: { niftySpot: marketData.niftySpot, ceProbability: ceProb, peProbability: peProb, reasons: ["Live Auto-trade: CE probability >= 50%"] }
        });
        broadcast({ type: 'AUTO_TRADE_LOG', message: `Live CE Auto‑trade executed at ${strike} (Qty: ${qty})` });
      } catch (e) {
        console.error('Live Auto‑trade CE order failed:', e.message);
      }
    }
  }

  // PE Live Order
  if (pePass && !hasPELive) {
    const peContract = marketData.optionChain.find(c => c.strike === strike)?.pe;
    if (peContract) {
      const qty = 2 * config.NIFTY_LOT_SIZE; // 2 lots
      try {
        await angelOneService.placeOrder({
          symbol: peContract.symbol,
          strike,
          quantity: qty,
          transactionType: 'BUY',
          optionType: 'PE'
        });
        await liveTrader.recordEntry({
          symbol: peContract.symbol,
          strike,
          quantity: qty,
          entryPrice: peContract.ltp,
          optionType: 'PE',
          slPoints: 15,
          targetPoints: 30,
          isAutoSignal: true,
          entryCriteria: { niftySpot: marketData.niftySpot, ceProbability: ceProb, peProbability: peProb, reasons: ["Live Auto-trade: PE probability >= 50%"] }
        });
        broadcast({ type: 'AUTO_TRADE_LOG', message: `Live PE Auto‑trade executed at ${strike} (Qty: ${qty})` });
      } catch (e) {
        console.error('Live Auto‑trade PE order failed:', e.message);
      }
    }
  }
}


  // 4. Fetch latest paper and live trading account metrics
  const paperState = await paperTrader.getAccountState();
  const liveState = await liveTrader.getAccountState();

  // 5. Compile the consolidated real-time stream packet
  const streamPayload = {
    type: 'TICK',
    timestamp: marketData.timestamp,
    niftySpot: marketData.niftySpot,
    bankNiftySpot: marketData.bankNiftySpot,
    indiaVix: marketData.indiaVix,
    futuresOi: marketData.futuresOi,
    futuresPrice: marketData.futuresPrice || (marketData.niftySpot + 12),
    futuresContractOi: marketData.futuresContractOi || marketData.futuresOi,
    futuresOiChange: marketData.futuresOiChange || 0,
    optionChain: marketData.optionChain,
    signal: {
      type: signalResult.signalType,
      confidence: signalResult.confidence,
      reason: signalResult.reason,
      atmStrike: signalResult.atmStrike
    },
    indicators: signalResult.indicators,
    candles: marketData.candles,
    paper: paperState,
    liveState: liveState,
    liveModeActive: angelOneService.isConnected
  };

  broadcast(streamPayload);

  // Cache last updated live market data
  if (connected && marketData.niftySpot > 0) {
    try {
      const dataToSave = {
        niftySpot: marketData.niftySpot,
        bankNiftySpot: marketData.bankNiftySpot,
        indiaVix: marketData.indiaVix,
        futuresOi: marketData.futuresOi,
        futuresPrice: marketData.futuresPrice,
        futuresContractOi: marketData.futuresContractOi,
        optionChain: marketData.optionChain,
        candles: marketData.candles
      };
      fs.writeFileSync('./last_market_data.json', JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (e) {
      // Ignore write errors
    }
  }
});

// Boot Services
async function boot() {
  // Connect to MongoDB if MONGODB_URI is provided
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    console.log("Database: Connecting to MongoDB...");
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      console.log("Database: MongoDB Connected successfully!");
    } catch (err) {
      console.error("Database: MongoDB Connection failed:", err.message);
    }
  } else {
    console.log("Database: MONGODB_URI environment variable not found. Running in Local JSON file mode.");
  }

  // Fetch and cache Scrip Master list
  try {
    await scripMaster.initialize();
  } catch (err) {
    console.error("ScripMaster: Initialization failed:", err);
  }

  // Auto-login to Angel One if credentials are provided in .env
  const { CLIENT_CODE, PASSWORD, API_KEY, TOTP_SECRET } = config.ANGEL_ONE;
  if (CLIENT_CODE && PASSWORD && API_KEY && TOTP_SECRET) {
    console.log("AngelOne: Credentials detected in .env. Attempting auto-login...");
    try {
      await angelOneService.login({
        clientCode: CLIENT_CODE,
        password: PASSWORD,
        apiKey: API_KEY,
        totpSecret: TOTP_SECRET
      });
      console.log("AngelOne: Auto-login successful and stream connected.");
    } catch (err) {
      console.error("AngelOne: Auto-login failed on startup:", err.message || err);
    }
  } else {
    console.log("AngelOne: Credentials missing in .env. Running in standalone local simulator mode.");
  }

  // Load cached market data if available
  try {
    if (fs.existsSync('./last_market_data.json')) {
      const lastData = JSON.parse(fs.readFileSync('./last_market_data.json', 'utf8'));
      marketSimulator.niftySpot = lastData.niftySpot || 0;
      marketSimulator.bankNiftySpot = lastData.bankNiftySpot || 0;
      marketSimulator.indiaVix = lastData.indiaVix || 14.5;
      marketSimulator.futuresOi = lastData.futuresOi || 0;
      marketSimulator.futuresPrice = lastData.futuresPrice || 0;
      marketSimulator.futuresContractOi = lastData.futuresContractOi || 0;
      marketSimulator.optionChain = lastData.optionChain || [];
      marketSimulator.candles = lastData.candles || [];
      cachedOptionChain = lastData.optionChain || [];
      console.log(`Simulator: Seeded last updated market data. Spot: ${marketSimulator.niftySpot}`);
    }
  } catch (err) {
    console.error("Simulator: Failed to load last market data cache:", err.message);
  }

  // Start market data loop
  marketSimulator.start();
  console.log("Simulator: High-fidelity tick engine started.");

  server.listen(config.PORT, () => {
    console.log(`===================================================`);
    console.log(`  TRADING DASHBOARD SERVER RUNNING ON PORT ${config.PORT}`);
    console.log(`  http://localhost:${config.PORT}`);
    console.log(`===================================================`);
  });

  // Gracefully handle port-in-use errors (e.g. nodemon fast-restart)
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[WARN] Port ${config.PORT} already in use. Retrying in 1.5s...`);
      server.close();
      setTimeout(() => {
        server.listen(config.PORT);
      }, 1500);
    } else {
      throw err;
    }
  });
}

boot();

// Process cleanups
process.on('SIGTERM', () => {
  console.log("Shutting down server...");
  marketSimulator.stop();
  angelOneService.logout();
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log("Shutting down server...");
  marketSimulator.stop();
  angelOneService.logout();
  server.close(() => process.exit(0));
});
process.once('SIGUSR2', () => {
  console.log("Nodemon restarting, cleaning up...");
  marketSimulator.stop();
  angelOneService.logout();
  server.close(() => {
    process.kill(process.pid, 'SIGUSR2');
  });
});
