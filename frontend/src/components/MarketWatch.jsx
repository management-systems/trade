import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Maximize2, Activity, Layers } from 'lucide-react';

export default function MarketWatch({ niftySpot, bankNiftySpot, indicators }) {
  const [niftyFlash, setNiftyFlash] = useState('');
  const [bankFlash, setBankFlash] = useState('');
  
  const prevNifty = useRef(niftySpot);
  const prevBank = useRef(bankNiftySpot);

  useEffect(() => {
    if (niftySpot > prevNifty.current) {
      setNiftyFlash('bg-emerald-500/10 text-emerald-400');
      setTimeout(() => setNiftyFlash(''), 500);
    } else if (niftySpot < prevNifty.current) {
      setNiftyFlash('bg-rose-500/10 text-rose-400');
      setTimeout(() => setNiftyFlash(''), 500);
    }
    prevNifty.current = niftySpot;
  }, [niftySpot]);

  useEffect(() => {
    if (bankNiftySpot > prevBank.current) {
      setBankFlash('bg-emerald-500/10 text-emerald-400');
      setTimeout(() => setBankFlash(''), 500);
    } else if (bankNiftySpot < prevBank.current) {
      setBankFlash('bg-rose-500/10 text-rose-400');
      setTimeout(() => setBankFlash(''), 500);
    }
    prevBank.current = bankNiftySpot;
  }, [bankNiftySpot]);

  const { ema20, ema50, vwap, support, resistance, avgVolume, latestVolume, isVolumeExpansion } = indicators || {};

  const isNiftyBullishVwap = niftySpot > vwap;
  const isEmaBullish = ema20 && ema50 && ema20 > ema50;

  return (
    <div className="flex flex-col space-y-4 h-full">
      {/* Indices Spot Quotes */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center border-b border-slate-800 pb-2">
          <Activity className="h-4 w-4 text-emerald-400 mr-1.5" />
          Market Watch
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* NIFTY 50 */}
          <div className={`p-4 rounded-xl border border-slate-800/80 transition-all duration-300 ${niftyFlash || 'bg-slate-950/40'}`}>
            <span className="text-[10px] font-mono text-slate-400 tracking-wider">NIFTY 50</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-mono tracking-tight text-slate-100">
                {niftySpot ? niftySpot.toFixed(2) : 'Loading...'}
              </span>
              {niftySpot && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center ${isNiftyBullishVwap ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {isNiftyBullishVwap ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {isNiftyBullishVwap ? 'BULL' : 'BEAR'}
                </span>
              )}
            </div>
          </div>

          {/* BANK NIFTY */}
          <div className={`p-4 rounded-xl border border-slate-800/80 transition-all duration-300 ${bankFlash || 'bg-slate-950/40'}`}>
            <span className="text-[10px] font-mono text-slate-400 tracking-wider">BANK NIFTY</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-bold font-mono tracking-tight text-slate-100">
                {bankNiftySpot ? bankNiftySpot.toFixed(2) : 'Loading...'}
              </span>
              {bankNiftySpot && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  SPOT
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Technical Indicators Panel */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex-1 space-y-4">
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center border-b border-slate-800 pb-2">
          <Layers className="h-4 w-4 text-emerald-400 mr-1.5" />
          Technical Summary
        </h3>

        {indicators && vwap ? (
          <div className="space-y-3.5">
            {/* VWAP */}
            <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-900">
              <div>
                <span className="text-xs font-semibold text-slate-300">VWAP</span>
                <p className="text-[10px] font-mono text-slate-500">Day volume average price</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-slate-200">₹{vwap.toFixed(2)}</span>
                <span className={`block text-[9px] font-mono font-medium ${isNiftyBullishVwap ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isNiftyBullishVwap 
                    ? `+${(niftySpot - vwap).toFixed(1)} ABOVE` 
                    : `${(niftySpot - vwap).toFixed(1)} BELOW`}
                </span>
              </div>
            </div>

            {/* EMA Crossover */}
            <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-900">
              <div>
                <span className="text-xs font-semibold text-slate-300">EMA Crossover</span>
                <p className="text-[10px] font-mono text-slate-500">EMA(20) vs EMA(50)</p>
              </div>
              <div className="text-right">
                <div className="flex space-x-1.5 justify-end text-xs font-mono text-slate-400">
                  <span className="text-emerald-400">{ema20}</span>
                  <span>/</span>
                  <span className="text-slate-500">{ema50}</span>
                </div>
                <span className={`block text-[9px] font-mono font-medium ${isEmaBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isEmaBullish ? 'BULLISH ALIGNMENT' : 'BEARISH ALIGNMENT'}
                </span>
              </div>
            </div>

            {/* Support and Resistance */}
            <div className="bg-slate-950/30 p-3 rounded-xl border border-slate-900 space-y-2">
              <span className="text-xs font-semibold text-slate-300 block mb-1">Key Levels (30m Range)</span>
              
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 font-semibold">Resistance (Max)</span>
                <span className="text-rose-400 font-bold bg-rose-950/10 px-1.5 py-0.5 rounded border border-rose-950/20">
                  ₹{resistance ? resistance.toFixed(1) : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500 font-semibold">Support (Min)</span>
                <span className="text-emerald-400 font-bold bg-emerald-950/10 px-1.5 py-0.5 rounded border border-emerald-950/20">
                  ₹{support ? support.toFixed(1) : '-'}
                </span>
              </div>
            </div>

            {/* Volume Analysis */}
            <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-900">
              <div>
                <span className="text-xs font-semibold text-slate-300">Volume Multiplier</span>
                <p className="text-[10px] font-mono text-slate-500">Current vs 10-period avg</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-slate-200">{latestVolume}</span>
                <span className={`block text-[9px] font-mono font-medium ${isVolumeExpansion ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
                  {isVolumeExpansion ? 'VOLUME SPIKE (1.3x)' : `Avg: ${avgVolume}`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-500 text-xs font-mono">
            Waiting for indicator computations...
          </div>
        )}
      </div>
    </div>
  );
}
