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
  }
});

// Main Tick Loop: simulator emits updates every second
marketSimulator.on('tick', async (marketData) => {
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

      if (tokens.length > 0) {
        // Fetch accurate quotes from SmartAPI
        const quotes = await angelOneService.getMarketQuotes(tokens);
        if (quotes && quotes.length > 0) {
          const quoteMap = {};
          quotes.forEach(q => {
            quoteMap[q.symbolToken] = q;
          });

          // Enrich simulated option chain with true market numbers
          marketData.optionChain = contracts.map(c => {
            const ceQuote = c.ce ? quoteMap[c.ce.token] : null;
            const peQuote = c.pe ? quoteMap[c.pe.token] : null;

            return {
              strike: c.strike,
              ce: {
                symbol: c.ce ? c.ce.symbol : `NIFTY26JUL${c.strike}CE`,
                ltp: ceQuote ? parseFloat(ceQuote.ltp || 0) : (c.ce ? 10 : 0),
                oi: ceQuote ? parseInt(ceQuote.openInterest || 0) : 0,
                oiChange: ceQuote ? parseInt(ceQuote.oiChange || 0) : 0,
                oiChangePercent: ceQuote ? parseFloat(ceQuote.oiChangePercent || 0) : 0,
                volume: ceQuote ? parseInt(ceQuote.volume || 0) : 0
              },
              pe: {
                symbol: c.pe ? c.pe.symbol : `NIFTY26JUL${c.strike}PE`,
                ltp: peQuote ? parseFloat(peQuote.ltp || 0) : (c.pe ? 10 : 0),
                oi: peQuote ? parseInt(peQuote.openInterest || 0) : 0,
                oiChange: peQuote ? parseInt(peQuote.oiChange || 0) : 0,
                oiChangePercent: peQuote ? parseFloat(peQuote.oiChangePercent || 0) : 0,
                volume: peQuote ? parseInt(peQuote.volume || 0) : 0
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
