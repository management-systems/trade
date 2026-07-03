import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Zap, 
  Settings, 
  Sliders, 
  Shield, 
  Play, 
  Square, 
  Save, 
  CheckCircle, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  AlertTriangle
} from 'lucide-react';

export default function AutoTradePanel({ onRefresh }) {
  const [config, setConfig] = useState({ 
    liveEnabled: false, 
    params: { lots: 1, stopLossPct: 2, profitPct: 3 }, 
    criteria: { 
      ce: { betterModel: false, bullishStructure: false, priceAboveVWAP: false, resistanceBreakout: false, volumeAbove150: false, futuresLongBuild: false }, 
      pe: { marketStructure: false, priceBelowVWAP: false, ema20BelowEma50: false, supportBreakdown: false, sellingVolumeAbove150: false, futuresShortBuild: false } 
    } 
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [filterMsg, setFilterMsg] = useState('');

  const fetchConfig = async () => {
    try {
      const data = await api.getAutoTradeConfig();
      if (data.success && data.config) {
        setConfig(prev => ({ ...prev, ...data.config }));
      }
    } catch (e) {
      console.error('Failed to load auto‑trade config', e);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleChange = (field, value) => {
    setConfig(prev => ({
      ...prev,
      params: { ...prev.params, [field]: value }
    }));
  };

  const saveConfig = async () => {
    setLoading(true);
    setMsg('');
    try {
      await api.updateAutoTradeConfig({
        lotSize: Number(config.params.lots),
        stopLossPct: Number(config.params.stopLossPct),
        profitPct: Number(config.params.profitPct),
        criteria: config.criteria
      });
      setMsg('Configuration saved successfully.');
      fetchConfig();
      if (onRefresh) onRefresh();
    } catch (e) {
      alert('Failed to save auto‑trade config: ' + e.message);
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const toggleLive = async () => {
    const pin = prompt(`Enter your 4-digit security PIN to ${config.liveEnabled ? 'deactivate' : 'activate'} the Live Auto-Trade Engine:`);
    if (pin === null) return;
    if (pin.trim() !== '1232') {
      alert('Incorrect security PIN. Action aborted.');
      return;
    }

    setLoading(true);
    try {
      await api.toggleAutoTradeLive(!config.liveEnabled);
      fetchConfig();
    } catch (e) {
      alert('Failed to toggle live mode: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCeToggle = async (key) => {
    const updatedCe = {
      ...config.criteria.ce,
      [key]: !config.criteria.ce[key]
    };
    
    setConfig(prev => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        ce: updatedCe
      }
    }));

    try {
      await api.updateAutoTradeConfig({
        lotSize: Number(config.params.lots),
        stopLossPct: Number(config.params.stopLossPct),
        profitPct: Number(config.params.profitPct),
        criteria: {
          ...config.criteria,
          ce: updatedCe
        }
      });
    } catch (e) {
      console.error('Failed to autosave CE criteria preference:', e);
    }
  };

  const handlePeToggle = async (key) => {
    const updatedPe = {
      ...config.criteria.pe,
      [key]: !config.criteria.pe[key]
    };

    setConfig(prev => ({
      ...prev,
      criteria: {
        ...prev.criteria,
        pe: updatedPe
      }
    }));

    try {
      await api.updateAutoTradeConfig({
        lotSize: Number(config.params.lots),
        stopLossPct: Number(config.params.stopLossPct),
        profitPct: Number(config.params.profitPct),
        criteria: {
          ...config.criteria,
          pe: updatedPe
        }
      });
    } catch (e) {
      console.error('Failed to autosave PE criteria preference:', e);
    }
  };

  const saveFilters = async () => {
    try {
      await api.updateAutoTradeConfig({
        lotSize: Number(config.params.lots),
        stopLossPct: Number(config.params.stopLossPct),
        profitPct: Number(config.params.profitPct),
        criteria: config.criteria
      });
      setFilterMsg('Filters saved successfully.');
      setTimeout(() => setFilterMsg(''), 3500);
    } catch (e) {
      setFilterMsg('Failed to save filters.');
      setTimeout(() => setFilterMsg(''), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Status Card */}
      <div className={`glass-panel p-6 rounded-2xl border transition-all duration-300 ${
        config.liveEnabled 
          ? 'border-emerald-500/30 bg-emerald-950/5 shadow-lg shadow-emerald-950/15' 
          : 'border-slate-800 bg-slate-900/10'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className={`p-3 rounded-xl transition ${
              config.liveEnabled 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-slate-800 text-slate-400'
            }`}>
              <Zap className={`h-6 w-6 ${config.liveEnabled ? 'animate-bounce' : ''}`} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-slate-100 font-sans tracking-wide">
                  Autonomous Signal Execution Engine
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold font-mono tracking-wider ${
                  config.liveEnabled 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse' 
                    : 'bg-slate-800/80 text-slate-400 border border-slate-700/50'
                }`}>
                  {config.liveEnabled ? 'LIVE & ACTIVE' : 'STANDBY MODE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                When enabled, the execution engine automatically evaluates technical signals based on your rules and executes option buy/sell orders in live mode.
              </p>
            </div>
          </div>
          
          <button
            onClick={toggleLive}
            disabled={loading}
            className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-mono text-xs font-black uppercase tracking-wider transition duration-300 border ${
              config.liveEnabled 
                ? 'bg-rose-500/10 hover:bg-rose-500 hover:text-slate-950 text-rose-455 border-rose-500/30' 
                : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 border-emerald-400/40 shadow-lg shadow-emerald-500/10'
            }`}
          >
            {config.liveEnabled ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                <span>Deactivate Engine</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Activate Engine</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Settings & Criteria */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Settings Column */}
        <div className="lg:col-span-1 glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-3">
              <Sliders className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-mono font-extrabold text-slate-350 uppercase tracking-wider">
                Risk & Position Sizing
              </h4>
            </div>

            <div className="space-y-4">
              {/* Paper Auto-Trading Config Box */}
              <div className="bg-emerald-950/10 border border-emerald-900/30 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">Paper Auto‑Trading</span>
                  <span className="text-[9px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-black uppercase">ALWAYS ACTIVE</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-xs pt-1">
                  <div>Quantity: <span className="text-white font-bold">10 Lots (650 Qty)</span></div>
                  <div>Stop-Loss: <span className="text-rose-455 font-bold">10% SL</span></div>
                  <div>Target Profit: <span className="text-emerald-400 font-bold">15% Target</span></div>
                  <div>Order Type: <span className="text-slate-400 font-bold">Market Buy</span></div>
                </div>
              </div>

              {/* Live Auto-Trading Config Box */}
              <div className={`p-4 rounded-xl space-y-2 border transition ${
                config.liveEnabled 
                  ? 'bg-purple-950/20 border-purple-500/30' 
                  : 'bg-slate-900/40 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                    config.liveEnabled ? 'text-purple-400' : 'text-slate-500'
                  }`}>Live Auto‑Trading</span>
                  <span className={`text-[9px] font-mono border px-2 py-0.5 rounded font-black uppercase ${
                    config.liveEnabled 
                      ? 'bg-purple-950 text-purple-400 border-purple-800 animate-pulse' 
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}>
                    {config.liveEnabled ? 'ACTIVE & SCANNING' : 'STANDBY'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono text-xs pt-1">
                  <div>Quantity: <span className="text-white font-bold">2 Lots (130 Qty)</span></div>
                  <div>Stop-Loss: <span className="text-rose-455 font-bold">10% SL</span></div>
                  <div>Target Profit: <span className="text-emerald-400 font-bold">15% Target</span></div>
                  <div>Order Type: <span className="text-slate-400 font-bold">Market Buy</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-900 flex items-start space-x-2.5">
            <Shield className="h-4.5 w-4.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-[10.5px] font-mono text-slate-400 leading-normal">
              Autonomous engines enforce daily risk bounds. Auto-trade triggers automatically if active checklist filters combine to produce a CE or PE probability &gt;= 50%.
            </p>
          </div>
        </div>

        {/* CE Trigger Checklist */}
        <div className="lg:col-span-1 glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-emerald-455" />
              <h4 className="text-xs font-mono font-extrabold text-slate-350 uppercase tracking-wider">
                Call Option (CE) Filters
              </h4>
            </div>
            <span className="text-[9px] bg-emerald-950/30 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/10 font-bold uppercase">
              Bullish Rules
            </span>
          </div>

          {/* Toggle checklist */}
          <div className="space-y-2">
            {[
              { key: 'betterModel', label: 'Signal Engine Approval' },
              { key: 'bullishStructure', label: 'Bullish Market Structure' },
              { key: 'priceAboveVWAP', label: 'Price Above VWAP' },
              { key: 'resistanceBreakout', label: 'Resistance Breakout' },
              { key: 'volumeAbove150', label: 'Volume > 150% Average' },
              { key: 'futuresLongBuild', label: 'Futures Long Build-Up' }
            ].map(item => (
              <label 
                key={item.key} 
                className={`relative flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none ${
                  config.criteria.ce[item.key]
                    ? 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/30'
                    : 'bg-slate-950/30 border-slate-900/60 hover:border-slate-800/80'
                }`}
              >
                <span className={`text-xs font-medium font-sans transition ${
                  config.criteria.ce[item.key] ? 'text-emerald-300 font-bold' : 'text-slate-400'
                }`}>
                  {item.label}
                </span>
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={config.criteria.ce[item.key]} 
                    onChange={() => handleCeToggle(item.key)} 
                    className="sr-only peer" 
                  />
                  <div className="w-8 h-4 bg-slate-800/80 rounded-full peer peer-checked:bg-emerald-500 transition duration-200 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-slate-950"></div>
                </div>
              </label>
            ))}
          </div>

          {/* Save CE Filters */}
          <div className="pt-3 border-t border-slate-800/60">
            <button
              onClick={saveFilters}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-[10px] font-mono font-extrabold uppercase tracking-wider transition duration-150 bg-emerald-950/20 hover:bg-emerald-500 hover:text-slate-950 text-emerald-500 border border-emerald-500/25 hover:border-emerald-400"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save CE Filters</span>
            </button>
            {filterMsg && (
              <div className="mt-2 flex items-center space-x-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-[10px] font-mono">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{filterMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* PE Trigger Checklist */}
        <div className="lg:col-span-1 glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <TrendingDown className="h-4 w-4 text-rose-455" />
              <h4 className="text-xs font-mono font-extrabold text-slate-350 uppercase tracking-wider">
                Put Option (PE) Filters
              </h4>
            </div>
            <span className="text-[9px] bg-rose-950/30 text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/10 font-bold uppercase">
              Bearish Rules
            </span>
          </div>

          {/* Toggle checklist */}
          <div className="space-y-2">
            {[
              { key: 'marketStructure', label: 'Bearish Market Structure' },
              { key: 'priceBelowVWAP', label: 'Price Below VWAP' },
              { key: 'ema20BelowEma50', label: 'EMA 20 < EMA 50 Crossover' },
              { key: 'supportBreakdown', label: 'Support Breakdown' },
              { key: 'sellingVolumeAbove150', label: 'Selling Volume > 150%' },
              { key: 'futuresShortBuild', label: 'Futures Short Build-Up' }
            ].map(item => (
              <label 
                key={item.key} 
                className={`relative flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none ${
                  config.criteria.pe[item.key]
                    ? 'bg-rose-950/10 border-rose-500/20 hover:border-rose-500/30'
                    : 'bg-slate-950/30 border-slate-900/60 hover:border-slate-800/80'
                }`}
              >
                <span className={`text-xs font-medium font-sans transition ${
                  config.criteria.pe[item.key] ? 'text-rose-300 font-bold' : 'text-slate-400'
                }`}>
                  {item.label}
                </span>
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={config.criteria.pe[item.key]} 
                    onChange={() => handlePeToggle(item.key)} 
                    className="sr-only peer" 
                  />
                  <div className="w-8 h-4 bg-slate-800/80 rounded-full peer peer-checked:bg-rose-500 transition duration-200 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-slate-950"></div>
                </div>
              </label>
            ))}
          </div>

          {/* Save PE Filters */}
          <div className="pt-3 border-t border-slate-800/60">
            <button
              onClick={saveFilters}
              className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl text-[10px] font-mono font-extrabold uppercase tracking-wider transition duration-150 bg-rose-950/20 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/25 hover:border-rose-400"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save PE Filters</span>
            </button>
            {filterMsg && (
              <div className="mt-2 flex items-center space-x-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-[10px] font-mono">
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{filterMsg}</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
