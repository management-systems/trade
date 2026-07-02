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
import CriteriaPanel from './components/CriteriaPanel';
import { api } from './services/api';
import { socket } from './services/socket';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [liveModeActive, setLiveModeActive] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Custom signal criteria active settings
  const [criteriaSettings, setCriteriaSettings] = useState({
    vwap: true,
    ema: true,
    breakout: true,
    volume: true,
    oi: true,
    rsi: true,
    macd: true,
    vix: true
  });

  // Dynamic Rule Threshold settings
  const [thresholds, setThresholds] = useState({
    rsiBullish: 55,
    rsiBearish: 45,
    vixMax: 22,
    volumeMult: 1.3
  });

  // Angel One Login state
  const [apiStatus, setApiStatus] = useState({
    connected: false,
    clientCode: null,
    clientName: null,
    funds: null
  });

  // Market & Indicators state
  const [marketData, setMarketData] = useState({
    niftySpot: 24150,
    bankNiftySpot: 52200,
    indiaVix: 14.5,
    futuresOi: 1250000,
    optionChain: [],
    signal: { type: 'NO TRADE', confidence: 0, reason: 'Connecting feed...', atmStrike: null },
    indicators: {},
    candles: []
  });

  // Paper trading balance & logs state
  const [paperState, setPaperState] = useState({
    balance: 100000,
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
      console.error("Error synchronizing status on startup:", err);
    }
  };

  useEffect(() => {
    syncSystemState();

    // Poll live credentials status and account funds every 10 seconds
    const statusInterval = setInterval(() => {
      syncSystemState();
    }, 10000);

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
          indiaVix: data.indiaVix || 14.5,
          futuresOi: data.futuresOi || 1250000,
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
      clearInterval(statusInterval);
      socket.close();
    };
  }, []);

  // Quick select prefill from Option Chain
  const handleSelectContract = (symbol, optionType, strike, ltp) => {
    setSelectedPreFill({ symbol, optionType, strike, ltp });
  };

  // Toggle active indicators
  const handleToggleCriteria = (id) => {
    setCriteriaSettings(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Handle threshold modifications
  const handleThresholdChange = (key, val) => {
    setThresholds(prev => ({
      ...prev,
      [key]: val
    }));
  };

  // Dynamically calculate signals locally based on toggled CE/PE rules & custom thresholds
  const getCustomSignal = () => {
    const defaultSignal = marketData.signal || { signalType: 'NO TRADE', confidence: 0, reason: 'Waiting for data...', atmStrike: null };
    if (!marketData.niftySpot || !marketData.candles || marketData.candles.length === 0) {
      return defaultSignal;
    }

    const spot = marketData.niftySpot;
    const indicators = marketData.indicators || {};
    const optionChain = marketData.optionChain || [];
    const vix = marketData.indiaVix || 14.5;
    
    const { ema20, ema50, vwap, support, resistance, isVolumeExpansion, rsi, macd: macdData } = indicators;
    
    // Check if VIX is above max safety limit
    const isVixTooHigh = vix > thresholds.vixMax;

    const atmStrike = Math.round(spot / 50) * 50;
    let ceOiChangeAtmNear = 0;
    let peOiChangeAtmNear = 0;

    optionChain.forEach(item => {
      if (Math.abs(item.strike - atmStrike) <= 150) {
        ceOiChangeAtmNear += item.ce?.oiChange || 0;
        peOiChangeAtmNear += item.pe?.oiChange || 0;
      }
    });

    const isCallOiDecreasing = ceOiChangeAtmNear < -100;
    const isPutOiIncreasing = peOiChangeAtmNear > 100;
    const isPutOiDecreasing = peOiChangeAtmNear < -100;
    const isCallOiIncreasing = ceOiChangeAtmNear > 100;

    let buyCeScore = 0;
    let totalCeWeight = 0;
    const ceReasons = [];

    // VIX safety filter
    if (criteriaSettings.vix) {
      totalCeWeight += 10;
      if (!isVixTooHigh) {
        buyCeScore += 10;
        ceReasons.push(`VIX is safe at ${vix.toFixed(1)}% (<${thresholds.vixMax}%)`);
      }
    }

    if (criteriaSettings.vwap) {
      totalCeWeight += 25;
      if (spot > vwap) {
        buyCeScore += 25;
        ceReasons.push("Spot price is above VWAP (Bullish)");
      }
    }
    if (criteriaSettings.ema) {
      totalCeWeight += 25;
      if (ema20 && ema50 && ema20 > ema50) {
        buyCeScore += 25;
        ceReasons.push("EMA 20 is above EMA 50 (Golden Cross)");
      }
    }
    if (criteriaSettings.breakout) {
      totalCeWeight += 20;
      if (resistance && spot > resistance) {
        buyCeScore += 20;
        ceReasons.push(`Spot broke out above resistance ₹${resistance}`);
      }
    }
    if (criteriaSettings.volume) {
      totalCeWeight += 15;
      if (isVolumeExpansion) {
        buyCeScore += 15;
        ceReasons.push(`Volume is expanding (>1.3x average)`);
      }
    }
    if (criteriaSettings.rsi) {
      totalCeWeight += 15;
      if (rsi && rsi > thresholds.rsiBullish) {
        buyCeScore += 15;
        ceReasons.push(`RSI is above bullish threshold ${thresholds.rsiBullish} (RSI: ${rsi.toFixed(1)})`);
      }
    }
    if (criteriaSettings.macd) {
      totalCeWeight += 15;
      if (macdData && macdData.macd > macdData.signal) {
        buyCeScore += 15;
        ceReasons.push(`MACD Line is above Signal Line`);
      }
    }
    if (criteriaSettings.oi) {
      totalCeWeight += 15;
      if (isCallOiDecreasing || isPutOiIncreasing) {
        buyCeScore += 15;
        if (isCallOiDecreasing && isPutOiIncreasing) {
          ceReasons.push("Bullish OI: CE unwinding & PE writing");
        } else if (isCallOiDecreasing) {
          ceReasons.push("Bullish OI: Calls are unwinding");
        } else {
          ceReasons.push("Bullish OI: Puts are written heavily");
        }
      }
    }

    let buyPeScore = 0;
    let totalPeWeight = 0;
    const peReasons = [];

    // VIX safety filter
    if (criteriaSettings.vix) {
      totalPeWeight += 10;
      if (!isVixTooHigh) {
        buyPeScore += 10;
        peReasons.push(`VIX is safe at ${vix.toFixed(1)}% (<${thresholds.vixMax}%)`);
      }
    }

    if (criteriaSettings.vwap) {
      totalPeWeight += 25;
      if (spot < vwap) {
        buyPeScore += 25;
        peReasons.push("Spot price is below VWAP (Bearish)");
      }
    }
    if (criteriaSettings.ema) {
      totalPeWeight += 25;
      if (ema20 && ema50 && ema20 < ema50) {
        buyPeScore += 25;
        peReasons.push("EMA 20 is below EMA 50 (Death Cross)");
      }
    }
    if (criteriaSettings.breakout) {
      totalPeWeight += 20;
      if (support && spot < support) {
        buyPeScore += 20;
        peReasons.push(`Spot broke down below support ₹${support}`);
      }
    }
    if (criteriaSettings.volume) {
      totalPeWeight += 15;
      if (isVolumeExpansion) {
        buyPeScore += 15;
        peReasons.push("Volume is expanding on down move");
      }
    }
    if (criteriaSettings.rsi) {
      totalPeWeight += 15;
      if (rsi && rsi < thresholds.rsiBearish) {
        buyPeScore += 15;
        peReasons.push(`RSI is below bearish threshold ${thresholds.rsiBearish} (RSI: ${rsi.toFixed(1)})`);
      }
    }
    if (criteriaSettings.macd) {
      totalPeWeight += 15;
      if (macdData && macdData.macd < macdData.signal) {
        buyPeScore += 15;
        peReasons.push("MACD Line is below Signal Line");
      }
    }
    if (criteriaSettings.oi) {
      totalPeWeight += 15;
      if (isPutOiDecreasing || isCallOiIncreasing) {
        buyPeScore += 15;
        if (isPutOiDecreasing && isCallOiIncreasing) {
          peReasons.push("Bearish OI: PE unwinding & CE writing");
        } else if (isCallOiIncreasing) {
          peReasons.push("Bearish OI: Calls are written heavily");
        } else {
          peReasons.push("Bearish OI: Puts are unwinding");
        }
      }
    }

    const ceConfidence = totalCeWeight > 0 ? Math.round((buyCeScore / totalCeWeight) * 100) : 0;
    const peConfidence = totalPeWeight > 0 ? Math.round((buyPeScore / totalPeWeight) * 100) : 0;

    let signalType = 'NO TRADE';
    let confidence = 0;
    let reasonsList = [];

    // Safety Override: Block all entries if VIX is dangerously high
    if (criteriaSettings.vix && isVixTooHigh) {
      return {
        type: 'NO TRADE',
        confidence: 0,
        reasons: [`Risk Block: India VIX (${vix.toFixed(1)}%) exceeds safety limit ${thresholds.vixMax}%`],
        atmStrike
      };
    }

    if (ceConfidence >= 60 && ceConfidence >= peConfidence) {
      signalType = 'BUY CE';
      confidence = ceConfidence;
      reasonsList = ceReasons;
    } else if (peConfidence >= 60 && peConfidence > ceConfidence) {
      signalType = 'BUY PE';
      confidence = peConfidence;
      reasonsList = peReasons;
    }

    return {
      type: signalType,
      confidence,
      reasons: reasonsList,
      atmStrike
    };
  };

  const customSignal = getCustomSignal();

  // Signal panel auto execution helper
  const handleExecuteSignal = async ({ symbol, optionType, strike }) => {
    setSelectedPreFill(null);
    
    // PIN Verification for Signal Execution
    const pin = prompt("Enter your 4-digit security PIN to authorize this automated signal trade:");
    if (pin === null) return; 
    if (pin.trim() !== '1232') {
      alert('Incorrect security PIN. Signal execution aborted.');
      return;
    }

    try {
      if (liveModeActive) {
        const result = await api.placeLiveOrder({
          symbol,
          strike,
          quantity: 25, 
          transactionType: 'BUY',
          optionType
        });
        alert(`Live order placed! Order ID: ${result.result?.data?.orderid || result.result?.orderid || 'Success'}`);
      } else {
        // Paper Order
        await api.placePaperOrder({
          symbol,
          type: 'BUY',
          optionType,
          strike,
          entryPrice: marketData.optionChain.find(i => i.strike === strike)?.[optionType === 'CE' ? 'ce' : 'pe'].ltp || 10,
          quantity: 25, 
          isAutoSignal: true
        });
        syncSystemState();
      }
    } catch (error) {
      alert(`Signal Execution failed: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col text-slate-100 font-sans">
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

      {/* Tabs Navigation Bar */}
      <div className="border-b border-slate-800 bg-[#0c1220]/60 sticky top-[73px] z-30 backdrop-blur-md">
        <div className="max-w-[1600px] w-full mx-auto px-6 flex space-x-2 py-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            DASHBOARD
          </button>
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap ${
              activeTab === 'charts'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            CHARTS & METRICS
          </button>
          <button
            onClick={() => setActiveTab('criteria')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap ${
              activeTab === 'criteria'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            CE | PE CRITERIA
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            RISK SAFEGUARDS
          </button>
          <button
            onClick={() => setActiveTab('more')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition whitespace-nowrap ${
              activeTab === 'more'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            MORE OPTIONS
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 p-6 space-y-6 max-w-[1600px] w-full mx-auto">
        
        {/* Tab 1: Dashboard Console */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Col 1: Market Watch & Custom Signals */}
              <div className="space-y-6 lg:col-span-1">
                <MarketWatch 
                  niftySpot={marketData.niftySpot} 
                  bankNiftySpot={marketData.bankNiftySpot} 
                  indiaVix={marketData.indiaVix}
                  futuresOi={marketData.futuresOi}
                  indicators={marketData.indicators} 
                />
                <SignalPanel 
                  signal={customSignal} 
                  riskLimitHit={paperState.risk.limitHit}
                  onExecuteTrade={handleExecuteSignal}
                  liveModeActive={liveModeActive}
                />
              </div>

              {/* Col 2-4: Option Chain */}
              <div className="lg:col-span-3">
                <OptionChain 
                  optionChain={marketData.optionChain} 
                  niftySpot={marketData.niftySpot} 
                  onSelectContract={handleSelectContract}
                />
              </div>
            </div>

            {/* Positions Table & Manual Entry */}
            <PaperTrade 
              paperState={paperState}
              optionChain={marketData.optionChain}
              selectedPreFill={selectedPreFill}
              onClosePreFill={() => setSelectedPreFill(null)}
              onRefresh={syncSystemState}
              liveModeActive={liveModeActive}
            />
          </div>
        )}

        {/* Tab 2: Performance Charts & Logs */}
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800">
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800/60 pb-2">
                  Equity Curve Chart
                </h3>
                <PnLChart history={paperState.history} />
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                    Performance Metrics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                      <span className="text-[10px] font-mono text-slate-500 block">TOTAL TRADES</span>
                      <span className="text-2xl font-bold font-mono text-slate-200">{paperState.metrics.totalTrades}</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                      <span className="text-[10px] font-mono text-slate-500 block">WIN RATIO</span>
                      <span className="text-2xl font-bold font-mono text-emerald-400">{paperState.metrics.winRatio}%</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                      <span className="text-[10px] font-mono text-slate-500 block">WINS</span>
                      <span className="text-xl font-bold font-mono text-emerald-400">{paperState.metrics.winningTrades}</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900">
                      <span className="text-[10px] font-mono text-slate-500 block">LOSSES</span>
                      <span className="text-xl font-bold font-mono text-rose-500">{paperState.metrics.losingTrades}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 mt-6">
                  <span className="text-[10px] font-mono text-slate-500 block">REALIZED SESSION P&L</span>
                  <span className={`text-2xl font-black font-mono ${paperState.risk.realizedPnlToday >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    ₹{paperState.risk.realizedPnlToday >= 0 ? '+' : ''}{paperState.risk.realizedPnlToday.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <HistoryPanel 
              history={paperState.history} 
              metrics={paperState.metrics} 
            />
          </div>
        )}

        {/* Tab 3: CE/PE Criteria Table Matrix */}
        {activeTab === 'criteria' && (
          <CriteriaPanel 
            settings={criteriaSettings} 
            onToggle={handleToggleCriteria} 
            thresholds={thresholds}
            onThresholdChange={handleThresholdChange}
            marketData={marketData}
          />
        )}

        {/* Tab 4: Risk Settings */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <RiskPanel 
              riskState={paperState.risk} 
              onRefresh={syncSystemState} 
            />
          </div>
        )}

        {/* Tab 5: More Options & Diagnostics */}
        {activeTab === 'more' && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6 max-w-4xl mx-auto">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-sm font-bold font-mono text-slate-200">SYSTEM DIAGNOSTICS</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-900">
                <span className="text-emerald-400 font-bold block">Angel One SmartAPI Profile</span>
                <div>Client Code: <span className="text-slate-300">{apiStatus.clientCode || 'M430587'}</span></div>
                <div>Status: <span className="text-slate-300">{apiStatus.connected ? 'CONNECTED (AUTO-LOGIN)' : 'DISCONNECTED'}</span></div>
                <div>Websocket Feed: <span className="text-slate-300">{isConnected ? 'ONLINE (WebSocket V2)' : 'OFFLINE'}</span></div>
                <div>Client Name: <span className="text-slate-300">{apiStatus.clientName || 'Active User'}</span></div>
              </div>

              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-900">
                <span className="text-emerald-400 font-bold block">Database Integration</span>
                <div>Connection Mode: <span className="text-slate-300">MongoDB Atlas (Cloud)</span></div>
                <div>Status: <span className="text-slate-300">ACTIVE & READY</span></div>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 font-mono text-xs text-slate-400">
              <span className="text-slate-300 font-bold block mb-2">Instrument Info:</span>
              <p>- Option contracts are resolved dynamically around Nifty spot strikes.</p>
              <p>- Automatic caching layers prevent slow network startups.</p>
              <p>- Active Port Bindings: Backend Port **5071** | Frontend Port **5072**</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
