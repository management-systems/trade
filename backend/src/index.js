import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config.js';
import apiRouter from './routes/api.js';
import marketSimulator from './services/simulator.js';
import angelOneService from './services/angelone.js';
import paperTrader from './services/paperTrader.js';
import scripMaster from './services/scripMaster.js';
import { analyzeSignal } from './services/signalEngine.js';

const app = express();
app.use(cors());
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

// Connect Angel One live spot feed to the simulator
angelOneService.on('spotTick', ({ index, price }) => {
  if (index === 'NIFTY') {
    marketSimulator.niftySpot = price;
  } else if (index === 'BANKNIFTY') {
    marketSimulator.bankNiftySpot = price;
  } else if (index === 'VIX') {
    marketSimulator.indiaVix = price;
  }
});

// Storing previous OI values to calculate live OI Change (%) dynamically
const prevOiMap = new Map();

// Main Tick Loop: simulator emits updates every second
marketSimulator.on('tick', async (marketData) => {
  // Sync the live mode state to block simulated movements when connected
  marketSimulator.isLiveMode = angelOneService.isConnected;

  // 1. If Angel One is authenticated, fetch real, accurate options data
  if (angelOneService.isConnected) {
    try {
      const spot = marketData.niftySpot;
      const atmStrike = Math.round(spot / 50) * 50;
      const strikes = [];
      for (let i = -5; i <= 5; i++) {
        strikes.push(atmStrike + i * 50);
      }

      // Look up strike contracts in cached master list
      const contracts = scripMaster.getStrikeContracts('NIFTY', strikes);
      const tokens = [];
      contracts.forEach(c => {
        if (c.ce) tokens.push(c.ce.token);
        if (c.pe) tokens.push(c.pe.token);
      });

      // Get Nifty Futures contract token
      const futScrip = scripMaster.getNiftyFutures();
      if (futScrip) {
        tokens.push(futScrip.token);
      }

      if (tokens.length > 0) {
        // Fetch accurate quotes from SmartAPI
        const quotes = await angelOneService.getMarketQuotes(tokens);
        if (quotes && quotes.length > 0) {
          const quoteMap = {};
          quotes.forEach(q => {
            quoteMap[q.symbolToken] = q;
          });

          // Process Futures Contract details
          let futLtp = marketData.niftySpot + 12; // default premium
          let futOi = marketData.futuresOi;
          let futOiChange = 0;

          if (futScrip && quoteMap[futScrip.token]) {
            const fQuote = quoteMap[futScrip.token];
            futLtp = parseFloat(fQuote.ltp || 0);
            futOi = parseInt(fQuote.opnInterest || 0);

            if (prevOiMap.has(futScrip.token)) {
              futOiChange = futOi - prevOiMap.get(futScrip.token);
            }
            prevOiMap.set(futScrip.token, futOi);
          }

          marketData.futuresPrice = futLtp;
          marketData.futuresContractOi = futOi;
          marketData.futuresOiChange = futOiChange;

          // Enrich simulated option chain with true market numbers
          marketData.optionChain = contracts.map(c => {
            const ceQuote = c.ce ? quoteMap[c.ce.token] : null;
            const peQuote = c.pe ? quoteMap[c.pe.token] : null;

            const ceOi = ceQuote ? parseInt(ceQuote.opnInterest || 0) : 0;
            const peOi = peQuote ? parseInt(peQuote.opnInterest || 0) : 0;

            let ceOiChange = 0;
            let peOiChange = 0;

            if (c.ce) {
              if (prevOiMap.has(c.ce.token)) {
                ceOiChange = ceOi - prevOiMap.get(c.ce.token);
              }
              prevOiMap.set(c.ce.token, ceOi);
            }
            if (c.pe) {
              if (prevOiMap.has(c.pe.token)) {
                peOiChange = peOi - prevOiMap.get(c.pe.token);
              }
              prevOiMap.set(c.pe.token, peOi);
            }

            return {
              strike: c.strike,
              ce: {
                symbol: c.ce ? c.ce.symbol : `NIFTY26JUL${c.strike}CE`,
                ltp: ceQuote ? parseFloat(ceQuote.ltp || 0) : (c.ce ? 10 : 0),
                oi: ceOi,
                oiChange: ceOiChange,
                oiChangePercent: ceOiChange && ceOi ? parseFloat(((ceOiChange / (ceOi - ceOiChange)) * 100).toFixed(2)) : 0,
                volume: ceQuote ? parseInt(ceQuote.tradeVolume || 0) : 0
              },
              pe: {
                symbol: c.pe ? c.pe.symbol : `NIFTY26JUL${c.strike}PE`,
                ltp: peQuote ? parseFloat(peQuote.ltp || 0) : (c.pe ? 10 : 0),
                oi: peOi,
                oiChange: peOiChange,
                oiChangePercent: peOiChange && peOi ? parseFloat(((peOiChange / (peOi - peOiChange)) * 100).toFixed(2)) : 0,
                volume: peQuote ? parseInt(peQuote.tradeVolume || 0) : 0
              }
            };
          });
        }
      }
    } catch (err) {
      console.error("Index: Failed to fetch real option chain quotes:", err);
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

  // 4. Fetch latest paper trading account metrics
  const paperState = await paperTrader.getAccountState();

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
    liveModeActive: angelOneService.isConnected
  };

  broadcast(streamPayload);
});

// Boot Services
async function boot() {
  // Connect to MongoDB if MONGODB_URI is provided
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    console.log("Database: Connecting to MongoDB...");
    try {
      await mongoose.connect(mongoUri);
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

  // Start market data loop
  marketSimulator.start();
  console.log("Simulator: High-fidelity tick engine started.");

  server.listen(config.PORT, () => {
    console.log(`===================================================`);
    console.log(`  TRADING DASHBOARD SERVER RUNNING ON PORT ${config.PORT}`);
    console.log(`  http://localhost:${config.PORT}`);
    console.log(`===================================================`);
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
