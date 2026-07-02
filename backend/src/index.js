import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { config } from './config.js';
import apiRouter from './routes/api.js';
import marketSimulator from './services/simulator.js';
import angelOneService from './services/angelone.js';
import paperTrader from './services/paperTrader.js';
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

wss.on('connection', (ws) => {
  console.log(`WebSocket: Client connected. Total: ${clients.size + 1}`);
  clients.add(ws);
  
  // Send immediate snapshot on connection
  const latestMarket = marketSimulator.getLatestData();
  const signalResult = analyzeSignal(latestMarket);
  const paperState = paperTrader.getAccountState();
  
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
marketSimulator.on('tick', (marketData) => {
  // 1. Process positions and check stop losses / targets
  const closedPositions = paperTrader.updatePositionsLtp(marketData.niftySpot, marketData.optionChain) || [];

  // Notify clients if any positions closed automatically
  closedPositions.forEach(trade => {
    broadcast({
      type: 'POSITION_CLOSED_ALERT',
      trade
    });
  });

  // 2. Perform Signal analysis
  const signalResult = analyzeSignal(marketData);

  // 3. Fetch latest paper trading account metrics
  const paperState = paperTrader.getAccountState();

  // 4. Compile the consolidated real-time stream packet
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

// Start simulator and Express listener
marketSimulator.start();
console.log("Simulator: High-fidelity tick engine started.");

server.listen(config.PORT, () => {
  console.log(`===================================================`);
  console.log(`  TRADING DASHBOARD SERVER RUNNING ON PORT ${config.PORT}`);
  console.log(`  http://localhost:${config.PORT}`);
  console.log(`===================================================`);
});

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
