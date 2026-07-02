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
import CEDecisionCard from './components/CEDecisionCard';
import PEDecisionCard from './components/PEDecisionCard';
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
    vix: true,
    structure: true
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
    futuresPrice: 24162,
    futuresContractOi: 1250000,
    futuresOiChange: 0,
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
          futuresPrice: data.futuresPrice || (data.niftySpot + 12),
          futuresContractOi: data.futuresContractOi || (data.futuresOi || 1250000),
          futuresOiChange: data.futuresOiChange || 0,
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

  const isMarketOpen = () => {
    const now = new Date();
    // Get UTC time in milliseconds, add 5.5 hours for IST offset (19800000 ms)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const istTime = new Date(utc + 19800000);
    
    const day = istTime.getDay(); // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) return false;
    
    const currentMinutes = istTime.getHours() * 60 + istTime.getMinutes();
    // 9:15 AM to 3:30 PM (555 to 930)
    return currentMinutes >= 555 && currentMinutes <= 930;
  };

  // Dynamically calculate signals locally based on toggled CE/PE rules & custom thresholds
  const getCustomSignal = () => {
    const defaultSignal = { 
      type: 'NO TRADE', 
      confidence: 0, 
      reasons: ['Connecting feed...'], 
      atmStrike: null,
      ceConfidence: 0,
      peConfidence: 0,
      ceList: [],
      peList: [],
      bias: 0
    };
    if (!marketData.niftySpot || !marketData.candles || marketData.candles.length === 0) {
      return defaultSignal;
    }

    const spot = marketData.niftySpot;
    const atmStrike = Math.round(spot / 50) * 50;

    const isLive = apiStatus.connected && isMarketOpen();

    if (!isLive) {
      return {
        type: 'NO TRADE',
        confidence: 0,
        reasons: ['Exchange is Closed / Offline. Live evaluation only.'],
        atmStrike,
        ceConfidence: 0,
        peConfidence: 0,
        ceList: [
          { name: 'Market Structure', status: 'FAIL', weight: 20, score: 0 },
          { name: 'VWAP', status: 'FAIL', weight: 10, score: 0 },
          { name: 'EMA20 > EMA50', status: 'FAIL', weight: 10, score: 0 },
          { name: 'Support Break', status: 'FAIL', weight: 15, score: 0 },
          { name: 'Volume', status: 'FAIL', weight: 10, score: 0 },
          { name: 'Futures OI', status: 'FAIL', weight: 15, score: 0 },
          { name: 'Option Chain', status: 'FAIL', weight: 10, score: 0 },
          { name: 'RSI', status: 'FAIL', weight: 5, score: 0 },
          { name: 'MACD', status: 'FAIL', weight: 5, score: 0 }
        ],
        peList: [
          { name: 'Market Structure', status: 'FAIL', weight: 20, score: 0 },
          { name: 'VWAP', status: 'FAIL', weight: 10, score: 0 },
          { name: 'EMA20 < EMA50', status: 'FAIL', weight: 10, score: 0 },
          { name: 'Breakdown', status: 'FAIL', weight: 15, score: 0 },
          { name: 'Volume', status: 'FAIL', weight: 10, score: 0 },
          { name: 'Short Build-up', status: 'FAIL', weight: 15, score: 0 },
          { name: 'Option Chain', status: 'FAIL', weight: 10, score: 0 },
          { name: 'RSI', status: 'FAIL', weight: 5, score: 0 },
          { name: 'MACD', status: 'FAIL', weight: 5, score: 0 }
        ],
        bias: 0
      };
    }

    const indicators = marketData.indicators || {};
    const optionChain = marketData.optionChain || [];
    const vix = marketData.indiaVix || 14.5;
    const futuresOiChange = marketData.futuresOiChange || 0;
    
    const { 
      ema20 = 0, 
      ema50 = 0, 
      vwap = 0, 
      support = 0, 
      resistance = 0, 
      avgVolume = 0, 
      latestVolume = 0, 
      isVolumeExpansion = false,
      rsi = 50,
      macd: macdData = { macd: 0, signal: 0, histogram: 0 },
      structure = { trend: 'NEUTRAL' }
    } = indicators;
    
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

    // CE Analysis checklist
    const isCeStructureMet = structure.trend === 'BULLISH';
    const isCeVwapMet = spot > vwap;
    const isCeEmaMet = ema20 && ema50 && ema20 > ema50;
    const isCeBreakoutMet = resistance && spot > resistance;
    const isCeVolumeMet = isVolumeExpansion;
    const isCeVolumeWeak = !isVolumeExpansion && latestVolume > avgVolume;
    const isCeFuturesMet = futuresOiChange > 0;
    const isCeOiMet = isCallOiDecreasing || isPutOiIncreasing;
    const isCeRsiMet = rsi > thresholds.rsiBullish;
    const isCeRsiWeak = !isCeRsiMet && rsi > 50;
    const isCeMacdMet = macdData.macd > macdData.signal;

    const ceList = [
      { name: 'Market Structure', status: isCeStructureMet ? 'PASS' : 'FAIL', weight: 20, score: isCeStructureMet ? 20 : 0 },
      { name: 'VWAP', status: isCeVwapMet ? 'PASS' : 'FAIL', weight: 10, score: isCeVwapMet ? 10 : 0 },
      { name: 'EMA20 > EMA50', status: isCeEmaMet ? 'PASS' : 'FAIL', weight: 10, score: isCeEmaMet ? 10 : 0 },
      { name: 'Support Break', status: isCeBreakoutMet ? 'PASS' : 'FAIL', weight: 15, score: isCeBreakoutMet ? 15 : 0 },
      { name: 'Volume', status: isCeVolumeMet ? 'PASS' : (isCeVolumeWeak ? 'WEAK' : 'FAIL'), weight: 10, score: isCeVolumeMet ? 10 : (isCeVolumeWeak ? 5 : 0) },
      { name: 'Futures OI', status: isCeFuturesMet ? 'PASS' : 'FAIL', weight: 15, score: isCeFuturesMet ? 15 : 0 },
      { name: 'Option Chain', status: isCeOiMet ? 'PASS' : 'FAIL', weight: 10, score: isCeOiMet ? 10 : 0 },
      { name: 'RSI', status: isCeRsiMet ? 'PASS' : (isCeRsiWeak ? 'WEAK' : 'FAIL'), weight: 5, score: isCeRsiMet ? 5 : (isCeRsiWeak ? 3 : 1) },
      { name: 'MACD', status: isCeMacdMet ? 'PASS' : 'FAIL', weight: 5, score: isCeMacdMet ? 5 : 0 }
    ];

    // PE Analysis checklist
    const isPeStructureMet = structure.trend === 'BEARISH';
    const isPeVwapMet = spot < vwap;
    const isPeEmaMet = ema20 && ema50 && ema20 < ema50;
    const isPeBreakdownMet = support && spot < support;
    const isPeVolumeMet = isVolumeExpansion;
    const isPeVolumeWeak = !isVolumeExpansion && latestVolume > avgVolume;
    const isPeFuturesMet = futuresOiChange < 0;
    const isPeOiMet = isPutOiDecreasing || isCallOiIncreasing;
    const isPeRsiMet = rsi < thresholds.rsiBearish;
    const isPeRsiWeak = !isPeRsiMet && rsi < 50;
    const isPeMacdMet = macdData.macd < macdData.signal;

    const peList = [
      { name: 'Market Structure', status: isPeStructureMet ? 'PASS' : 'FAIL', weight: 20, score: isPeStructureMet ? 20 : 0 },
      { name: 'VWAP', status: isPeVwapMet ? 'PASS' : 'FAIL', weight: 10, score: isPeVwapMet ? 10 : 0 },
      { name: 'EMA20 < EMA50', status: isPeEmaMet ? 'PASS' : 'FAIL', weight: 10, score: isPeEmaMet ? 10 : 0 },
      { name: 'Breakdown', status: isPeBreakdownMet ? 'PASS' : 'FAIL', weight: 15, score: isPeBreakdownMet ? 15 : 0 },
      { name: 'Volume', status: isPeVolumeMet ? 'PASS' : (isPeVolumeWeak ? 'WEAK' : 'FAIL'), weight: 10, score: isPeVolumeMet ? 10 : (isPeVolumeWeak ? 5 : 0) },
      { name: 'Short Build-up', status: isPeFuturesMet ? 'PASS' : 'FAIL', weight: 15, score: isPeFuturesMet ? 15 : 0 },
      { name: 'Option Chain', status: isPeOiMet ? 'PASS' : 'FAIL', weight: 10, score: isPeOiMet ? 10 : 0 },
      { name: 'RSI', status: isPeRsiMet ? 'PASS' : (isPeRsiWeak ? 'WEAK' : 'FAIL'), weight: 5, score: isPeRsiMet ? 5 : (isPeRsiWeak ? 3 : 1) },
      { name: 'MACD', status: isPeMacdMet ? 'PASS' : 'FAIL', weight: 5, score: isPeMacdMet ? 5 : 0 }
    ];

    // Calculate dynamic scores based on rules configuration
    const ceScore = ceList.reduce((sum, item) => sum + (criteriaSettings[item.name.toLowerCase().includes('structure') ? 'structure' : item.name.toLowerCase().includes('vwap') ? 'vwap' : item.name.toLowerCase().includes('ema') ? 'ema' : item.name.toLowerCase().includes('support') || item.name.toLowerCase().includes('breakdown') ? 'breakout' : item.name.toLowerCase().includes('volume') ? 'volume' : item.name.toLowerCase().includes('futures') || item.name.toLowerCase().includes('short') ? 'vix' : item.name.toLowerCase().includes('option') ? 'oi' : item.name.toLowerCase().includes('rsi') ? 'rsi' : 'macd'] !== false ? item.score : 0), 0);
    const peScore = peList.reduce((sum, item) => sum + (criteriaSettings[item.name.toLowerCase().includes('structure') ? 'structure' : item.name.toLowerCase().includes('vwap') ? 'vwap' : item.name.toLowerCase().includes('ema') ? 'ema' : item.name.toLowerCase().includes('support') || item.name.toLowerCase().includes('breakdown') ? 'breakout' : item.name.toLowerCase().includes('volume') ? 'volume' : item.name.toLowerCase().includes('short') || item.name.toLowerCase().includes('futures') ? 'vix' : item.name.toLowerCase().includes('option') ? 'oi' : item.name.toLowerCase().includes('rsi') ? 'rsi' : 'macd'] !== false ? item.score : 0), 0);

    const ceConfidence = ceScore;
    const peConfidence = peScore;

    let signalType = 'NO TRADE';
    let confidence = 0;
    let reasonsList = [];

    // Safety Override: Block all entries if VIX is dangerously high
    if (criteriaSettings.vix && isVixTooHigh) {
      return {
        type: 'NO TRADE',
        confidence: 0,
        reasons: [`Risk Override: India VIX (${vix.toFixed(1)}%) exceeds safety limit ${thresholds.vixMax}%`],
        atmStrike,
        ceConfidence: 0,
        peConfidence: 0,
        ceList,
        peList,
        bias: 0
      };
    }

    if (ceConfidence >= 60 && ceConfidence >= peConfidence) {
      signalType = 'BUY CE';
      confidence = ceConfidence;
      
      // Build reason list from met items
      ceList.forEach(item => {
        if (item.score > 0) reasonsList.push(`${item.name} is Confirmed (+${item.score})`);
      });
    } else if (peConfidence >= 60 && peConfidence > ceConfidence) {
      signalType = 'BUY PE';
      confidence = peConfidence;
      
      // Build reason list from met items
      peList.forEach(item => {
        if (item.score > 0) reasonsList.push(`${item.name} is Confirmed (+${item.score})`);
      });
    }

    return {
      type: signalType,
      confidence,
      reasons: reasonsList.slice(0, 7), // top 7 reasons
      atmStrike,
      ceConfidence,
      peConfidence,
      ceList,
      peList,
      bias: ceConfidence - peConfidence
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
          isAutoSignal: true,
          entryCriteria: {
            niftySpot: marketData.niftySpot,
            indiaVix: marketData.indiaVix,
            bias: customSignal.bias,
            ceConfidence: customSignal.ceConfidence,
            peConfidence: customSignal.peConfidence,
            reasons: customSignal.reasons
          }
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
            
            {/* Top Summary Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* CE Buy Probability */}
              <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between font-mono">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">CE BUY PROBABILITY</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-extrabold text-emerald-450">{customSignal.ceConfidence}%</span>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2 border border-slate-900/60">
                  <div className="bg-emerald-500 h-full" style={{ width: `${customSignal.ceConfidence}%` }}></div>
                </div>
              </div>

              {/* PE Buy Probability */}
              <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between font-mono">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">PE BUY PROBABILITY</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-extrabold text-rose-400">{customSignal.peConfidence}%</span>
                </div>
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-2 border border-slate-900/60">
                  <div className="bg-rose-500 h-full" style={{ width: `${customSignal.peConfidence}%` }}></div>
                </div>
              </div>

              {/* Market Trend */}
              <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between font-mono">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">MARKET TREND</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-lg font-black uppercase ${
                    customSignal.bias > 15 ? 'text-emerald-400' :
                    customSignal.bias < -15 ? 'text-rose-400' :
                    'text-slate-400'
                  }`}>
                    {customSignal.bias > 15 ? 'Bullish' : customSignal.bias < -15 ? 'Bearish' : 'Neutral'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 mt-2 block">Crossover Confirmed</span>
              </div>

              {/* India VIX / Volatility */}
              <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between font-mono">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">MARKET VOLATILITY</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-lg font-black uppercase ${
                    marketData.indiaVix > 20 ? 'text-rose-455' :
                    marketData.indiaVix > 15 ? 'text-amber-400' :
                    'text-emerald-405'
                  }`}>
                    {marketData.indiaVix > 20 ? 'High Risk' : marketData.indiaVix > 15 ? 'Medium' : 'Low Vol'}
                  </span>
                </div>
                <span className="text-[9px] text-slate-550 mt-2 block">VIX: {marketData.indiaVix.toFixed(2)}%</span>
              </div>

              {/* Directional Bias */}
              <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-col justify-between font-mono">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">DIRECTIONAL BIAS</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className={`text-lg font-black ${
                    customSignal.bias > 0 ? 'text-emerald-400' :
                    customSignal.bias < 0 ? 'text-rose-450' :
                    'text-slate-400'
                  }`}>
                    {customSignal.bias > 0 ? '+' : ''}{customSignal.bias} ({
                      Math.abs(customSignal.bias) > 30 ? 'Strong' : 'Moderate'
                    })
                  </span>
                </div>
                <span className="text-[9px] text-slate-500 mt-2 block">CE Score - PE Score</span>
              </div>
            </div>

            {/* Core Three-Column F&O Workspace Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Call scoring parameters */}
              <div className="lg:col-span-3">
                <CEDecisionCard list={customSignal.ceList} totalScore={customSignal.ceConfidence} />
              </div>

              {/* Center Column: Options Chain */}
              <div className="lg:col-span-6">
                <OptionChain 
                  optionChain={marketData.optionChain} 
                  niftySpot={marketData.niftySpot} 
                  onSelectContract={handleSelectContract}
                />
              </div>

              {/* Right Column: Put scoring parameters */}
              <div className="lg:col-span-3">
                <PEDecisionCard list={customSignal.peList} totalScore={customSignal.peConfidence} />
              </div>
            </div>

            {/* AI Explanation & Live Indicators Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Col 1-8: AI Explanation */}
              <div className="lg:col-span-9">
                <SignalPanel 
                  signal={customSignal} 
                  riskLimitHit={paperState.risk.limitHit}
                  onExecuteTrade={handleExecuteSignal}
                  liveModeActive={liveModeActive}
                  indiaVix={marketData.indiaVix}
                />
              </div>

              {/* Col 9-12: Spot Candlestick summary */}
              <div className="lg:col-span-3">
                <MarketWatch 
                  niftySpot={marketData.niftySpot} 
                  indiaVix={marketData.indiaVix}
                  futuresOi={marketData.futuresOi}
                  futuresPrice={marketData.futuresPrice}
                  futuresContractOi={marketData.futuresContractOi}
                  futuresOiChange={marketData.futuresOiChange}
                  indicators={marketData.indicators} 
                  candles={marketData.candles}
                />
              </div>
            </div>

            {/* Positions Table & Manual Entry Console */}
            <PaperTrade 
              paperState={paperState}
              optionChain={marketData.optionChain}
              selectedPreFill={selectedPreFill}
              onClosePreFill={() => setSelectedPreFill(null)}
              onRefresh={syncSystemState}
              liveModeActive={liveModeActive}
              marketData={marketData}
              customSignal={customSignal}
            />

            {/* Trade History Executions Log */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3.5 font-mono text-[11px]">
              <span className="text-[10px] text-slate-500 uppercase font-bold block border-b border-slate-900 pb-2">
                Execution Log (Trade History)
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-900 text-[9px] uppercase pb-1.5">
                      <th className="py-1">Timestamp</th>
                      <th className="py-1">Contract</th>
                      <th className="py-1">Action</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Entry Price</th>
                      <th className="py-1 text-right">Exit Price</th>
                      <th className="py-1 text-right">PnL Result</th>
                      <th className="py-1 text-center">Trigger Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-950/20 text-slate-300">
                    {paperState.history.slice(0, 5).map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/10">
                        <td className="py-2.5">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2.5 text-slate-200 font-bold">{log.symbol}</td>
                        <td className="py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            log.type === 'BUY' ? 'bg-emerald-950/40 text-emerald-400' : 'bg-rose-950/40 text-rose-455'
                          }`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="py-2.5 text-center">{log.quantity}</td>
                        <td className="py-2.5 text-right">₹{log.entryPrice.toFixed(2)}</td>
                        <td className="py-2.5 text-right">{log.exitPrice ? `₹${log.exitPrice.toFixed(2)}` : '-'}</td>
                        <td className={`py-2.5 text-right font-bold ${log.pnl >= 0 ? 'text-emerald-400' : 'text-rose-455'}`}>
                          {log.pnl !== undefined ? `₹${log.pnl >= 0 ? '+' : ''}${log.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            log.reason.includes('HIT') || log.pnl > 0 ? 'bg-emerald-950/40 text-emerald-400' : 'bg-slate-900 text-slate-400'
                          }`}>
                            {log.reason || 'CLOSED'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {paperState.history.length === 0 && (
                      <tr>
                        <td colSpan="8" className="py-4 text-center text-slate-500 italic">
                          No recent executions logged. Terminal is ready to scan breakout signals.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
