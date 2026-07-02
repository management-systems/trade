import React, { useState, useEffect } from 'react';
import { Shield, RotateCcw, AlertOctagon, Settings } from 'lucide-react';
import { api } from '../services/api';

export default function RiskPanel({ riskState, onRefresh }) {
  const { 
    maxTradesPerDay = 3, 
    maxLossPerDay = 1000, 
    tradesTakenToday = 0, 
    realizedPnlToday = 0, 
    totalDailyPnl = 0,
    limitHit = false,
    lossLimitHit = false,
    tradeLimitHit = false
  } = riskState || {};

  // Form State
  const [maxTrades, setMaxTrades] = useState(maxTradesPerDay.toString());
  const [maxLoss, setMaxLoss] = useState(maxLossPerDay.toString());
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Keep form fields synced with actual state from backend
  useEffect(() => {
    if (riskState) {
      setMaxTrades(maxTradesPerDay.toString());
      setMaxLoss(maxLossPerDay.toString());
    }
  }, [riskState, maxTradesPerDay, maxLossPerDay]);

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    try {
      await api.updateRiskConfig({
        maxTradesPerDay: parseInt(maxTrades),
        maxLossPerDay: parseFloat(maxLoss)
      });
      setSuccessMsg('Risk parameters updated!');
      onRefresh();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      alert(`Failed to update risk config: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetStats = async () => {
    if (window.confirm("Are you sure you want to reset today's trading counters? This resets daily loss and trade count.")) {
      try {
        await api.resetRiskLimits();
        onRefresh();
      } catch (error) {
        alert(`Reset failed: ${error.message}`);
      }
    }
  };

  const dailyPnlColor = totalDailyPnl >= 0 ? 'text-emerald-400' : 'text-rose-500';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      {/* 1. Risk Status Dashboard */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 mb-3 flex items-center">
            <Shield className="h-4 w-4 text-emerald-400 mr-1.5" />
            Risk Management State
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg">
              <span className="text-slate-500">Trades Taken Today:</span>
              <span className={`font-bold ${tradeLimitHit ? 'text-rose-500' : 'text-slate-200'}`}>
                {tradesTakenToday} / {maxTradesPerDay}
              </span>
            </div>
            
            <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg">
              <span className="text-slate-500">Realized P&L Today:</span>
              <span className={`font-bold ${realizedPnlToday >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                ₹{realizedPnlToday.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg">
              <span className="text-slate-500 font-semibold">Total Daily P&L:</span>
              <span className={`font-extrabold ${dailyPnlColor}`}>
                ₹{totalDailyPnl.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950/40 p-2 rounded-lg">
              <span className="text-slate-500">Daily Stop Loss Limit:</span>
              <span className="font-bold text-slate-300">₹{maxLossPerDay}</span>
            </div>
          </div>
        </div>

        {/* Alerts / Resets */}
        <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between">
          {limitHit ? (
            <div className="flex items-center text-rose-400 space-x-1.5">
              <AlertOctagon className="h-4.5 w-4.5 animate-pulse" />
              <span className="text-[10px] font-mono font-semibold uppercase">
                {lossLimitHit ? 'LOSS LIMIT BREACHED' : 'TRADE LIMIT REACHED'}
              </span>
            </div>
          ) : (
            <div className="flex items-center text-emerald-400 space-x-1.5 font-mono text-[9px]">
              <span className="h-2 w-2 bg-emerald-500 rounded-full animate-ping"></span>
              <span>SAFE STATUS (LIMITS ACTIVE)</span>
            </div>
          )}

          <button
            onClick={handleResetStats}
            className="flex items-center bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition"
            title="Reset Daily Stats"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Reset Today
          </button>
        </div>
      </div>

      {/* 2. Configure Limits */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 mb-3 flex items-center">
          <Settings className="h-4 w-4 text-emerald-400 mr-1.5" />
          Configure Safeguards
        </h3>

        <form onSubmit={handleUpdateConfig} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-mono text-slate-500 mb-1.5">
              MAX TRADES PER DAY
            </label>
            <input 
              type="number"
              min="1"
              max="10"
              value={maxTrades}
              onChange={(e) => setMaxTrades(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-500 mb-1.5">
              DAILY LOSS LIMIT (₹)
            </label>
            <input 
              type="number"
              min="100"
              max="50000"
              value={maxLoss}
              onChange={(e) => setMaxLoss(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-200 focus:outline-none"
            />
          </div>

          {successMsg && (
            <div className="p-2 bg-emerald-950/20 border border-emerald-900/30 rounded-lg text-emerald-400 text-[10px] font-mono">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg font-bold border border-slate-700 transition"
          >
            {loading ? 'Saving...' : 'Update Constraints'}
          </button>
        </form>
      </div>
    </div>
  );
}
