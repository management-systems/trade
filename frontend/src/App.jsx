import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import Header from './components/Header';
import MarketWatch from './components/MarketWatch';
import OptionChain from './components/OptionChain';
import SignalPanel from './components/SignalPanel';
import PaperTrade from './components/PaperTrade';
import RiskPanel from './components/RiskPanel';
import HistoryPanel from './components/HistoryPanel';
import PnLChart from './components/PnLChart';
import { api } from './services/api';
import { socket } from './services/socket';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [liveModeActive, setLiveModeActive] = useState(false);
  
  // Angel One Login state
  const [apiStatus, setApiStatus] = useState({
    connected: false,
    clientCode: null,
    clientName: null
  });

  // Market & Indicators state
  const [marketData, setMarketData] = useState({
    niftySpot: 24150,
    bankNiftySpot: 52200,
    optionChain: [],
    signal: { type: 'NO TRADE', confidence: 0, reason: 'Connecting feed...', atmStrike: null },
    indicators: {},
    candles: []
  });

  // Paper trading balance & logs state
  const [paperState, setPaperState] = useState({
    balance: 100000,
    equity: 100000,
    unrealizedPnl: 0,
    positions: [],
    history: [],
    metrics: { totalTrades: 0, winningTrades: 0, losingTrades: 0, winRatio: 0 },
    risk: { maxTradesPerDay: 3, maxLossPerDay: 1000, tradesTakenToday: 0, realizedPnlToday: 0, totalDailyPnl: 0, limitHit: false }
  });

  // Prefill state from clicking option chain cart icon
  const [selectedPreFill, setSelectedPreFill] = useState(null);

  // Sync Angel One and Paper Trading details on startup
  const syncSystemState = async () => {
    try {
      const authStatus = await api.checkAngelOneStatus();
      setApiStatus(authStatus);

      const paperData = await api.getPaperState();
      setPaperState(paperData);
    } catch (err) {
      console.error("Error synchroning status on startup:", err);
    }
  };

  useEffect(() => {
    syncSystemState();

    // Establish WebSocket Connection
    socket.connect();
    
    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Handle streamed data ticks
    socket.on('message', (payload) => {
      if (payload.type === 'WELCOME' || payload.type === 'TICK') {
        const data = payload.type === 'WELCOME' ? payload.data : payload;
        
        setMarketData({
          niftySpot: data.niftySpot,
          bankNiftySpot: data.bankNiftySpot,
          optionChain: data.optionChain,
          signal: data.signal,
          indicators: data.indicators,
          candles: data.candles
        });

        if (data.paper) {
          setPaperState(data.paper);
        }
      }

      // Handle win/loss close notifications
      if (payload.type === 'POSITION_CLOSED_ALERT') {
        const { trade } = payload;
        
        if (trade.reason === 'TARGET HIT') {
          // Play confetti!
          confetti({
            particleCount: 100,
            spread: 75,
            origin: { y: 0.6 }
          });
        }
        
        // Sync account states immediately
        syncSystemState();
      }
    });

    return () => {
      socket.close();
    };
  }, []);

  // Quick select prefill from Option Chain
  const handleSelectContract = (symbol, optionType, strike, ltp) => {
    setSelectedPreFill({ symbol, optionType, strike, ltp });
  };

  // Signal panel auto execution helper
  const handleExecuteSignal = async ({ symbol, optionType, strike, isAutoSignal }) => {
    setSelectedPreFill(null);
    try {
      if (liveModeActive) {
        alert(`LIVE MODE: Placing real order -> BUY NIFTY ${strike} ${optionType} via SmartAPI.`);
        const result = await api.placeOrder({
          symbol,
          strike,
          quantity: 25, // Default 1 lot
          transactionType: 'BUY',
          optionType
        });
        alert(`Live order placed! Order ID: ${result.data?.orderid}`);
      } else {
        // Paper Order
        await api.placePaperOrder({
          symbol,
          type: 'BUY',
          optionType,
          strike,
          entryPrice: marketData.optionChain.find(i => i.strike === strike)?.[optionType === 'CE' ? 'ce' : 'pe'].ltp || 10,
          quantity: 25, // 1 lot default
          isAutoSignal: true
        });
        
        // Fetch fresh status
        syncSystemState();
      }
    } catch (error) {
      alert(`Signal Execution failed: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col">
      {/* Navbar Header */}
      <Header 
        isConnected={isConnected} 
        liveModeActive={liveModeActive} 
        setLiveModeActive={setLiveModeActive}
        apiStatus={apiStatus} 
        setApiStatus={setApiStatus} 
        balance={paperState.balance}
        onRefreshState={syncSystemState}
      />

      {/* Main Grid Area */}
      <main className="flex-1 p-6 space-y-6 max-w-[1600px] w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Col 1: Watchlists & Chart */}
          <div className="space-y-6 lg:col-span-1">
            <MarketWatch 
              niftySpot={marketData.niftySpot} 
              bankNiftySpot={marketData.bankNiftySpot} 
              indicators={marketData.indicators} 
            />
            <PnLChart history={paperState.history} />
          </div>

          {/* Col 2-3: Option Chain */}
          <div className="lg:col-span-2">
            <OptionChain 
              optionChain={marketData.optionChain} 
              niftySpot={marketData.niftySpot} 
              onSelectContract={handleSelectContract}
            />
          </div>

          {/* Col 4: Engine Signal & Safety Limits */}
          <div className="space-y-6 lg:col-span-1">
            <SignalPanel 
              signal={marketData.signal} 
              riskLimitHit={paperState.risk.limitHit}
              onExecuteTrade={handleExecuteSignal}
              liveModeActive={liveModeActive}
            />
            <RiskPanel 
              riskState={paperState.risk} 
              onRefresh={syncSystemState} 
            />
          </div>
        </div>

        {/* Floating Positions & Manual Orders */}
        <PaperTrade 
          paperState={paperState}
          optionChain={marketData.optionChain}
          selectedPreFill={selectedPreFill}
          onClosePreFill={() => setSelectedPreFill(null)}
          onRefresh={syncSystemState}
          liveModeActive={liveModeActive}
        />

        {/* Trade Logs & Statistics History */}
        <HistoryPanel 
          history={paperState.history} 
          metrics={paperState.metrics} 
        />
      </main>
    </div>
  );
}
