import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Layers, Percent, Layers2 } from 'lucide-react';

export default function MarketWatch({ niftySpot, indiaVix, futuresOi, indicators }) {
  const [niftyFlash, setNiftyFlash] = useState('');
  const prevNifty = useRef(niftySpot);

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
    macd = { macd: 0, signal: 0, histogram: 0 }
  } = indicators || {};

  const isNiftyBullishVwap = niftySpot > vwap;
  const isEmaBullish = ema20 && ema50 && ema20 > ema50;

  return (
    <div className="flex flex-col space-y-4 h-full font-mono">
      {/* Indices Spot Quotes */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center border-b border-slate-800 pb-2">
          <Activity className="h-4 w-4 text-emerald-400 mr-1.5" />
          Market Watch
        </h3>
        
        <div className="grid grid-cols-2 gap-3">
          {/* NIFTY 50 (LIVE) */}
          <div className={`p-4 rounded-xl border border-slate-800/80 transition-all duration-300 col-span-2 ${niftyFlash || 'bg-slate-950/40'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-450 tracking-wider flex items-center">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                NIFTY 50 (LIVE)
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-bold tracking-tight text-slate-100">
                {niftySpot ? niftySpot.toFixed(2) : 'Loading...'}
              </span>
              {niftySpot && (
                <span className={`text-[10px] px-2 py-0.5 rounded flex items-center ${isNiftyBullishVwap ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {isNiftyBullishVwap ? <TrendingUp className="h-3 w-3 mr-0.5 animate-bounce" /> : <TrendingDown className="h-3 w-3 mr-0.5 animate-bounce" />}
                  {isNiftyBullishVwap ? 'BULL' : 'BEAR'}
                </span>
              )}
            </div>
          </div>

          {/* INDIA VIX */}
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 col-span-1">
            <span className="text-[9px] text-slate-500 tracking-wider flex items-center">
              <Percent className="h-2.5 w-2.5 mr-0.5 text-orange-400" />
              INDIA VIX
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-bold text-slate-200">
                {indiaVix ? `${indiaVix.toFixed(2)}%` : '14.50%'}
              </span>
            </div>
          </div>

          {/* FUTURES OI */}
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 col-span-1">
            <span className="text-[9px] text-slate-500 tracking-wider flex items-center">
              <Layers2 className="h-2.5 w-2.5 mr-0.5 text-teal-400" />
              FUTURES OI
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm font-bold text-slate-200">
                {futuresOi ? `${(futuresOi / 1000000).toFixed(2)}M` : '1.25M'}
              </span>
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
          <div className="space-y-3">
            {/* VWAP */}
            <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-900">
              <div>
                <span className="text-xs font-semibold text-slate-300 font-sans">VWAP</span>
                <p className="text-[9px] text-slate-500">Day volume average price</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-200">₹{vwap.toFixed(1)}</span>
                <span className={`block text-[8px] font-mono font-medium ${isNiftyBullishVwap ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isNiftyBullishVwap 
                    ? `+${(niftySpot - vwap).toFixed(1)} ABOVE` 
                    : `${(niftySpot - vwap).toFixed(1)} BELOW`}
                </span>
              </div>
            </div>

            {/* EMA Crossover */}
            <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-900">
              <div>
                <span className="text-xs font-semibold text-slate-300 font-sans">EMA Crossover</span>
                <p className="text-[9px] text-slate-500">EMA(20) vs EMA(50)</p>
              </div>
              <div className="text-right">
                <div className="flex space-x-1 justify-end text-[10px] text-slate-400">
                  <span className="text-emerald-400">₹{Math.round(ema20)}</span>
                  <span>/</span>
                  <span className="text-slate-500">₹{Math.round(ema50)}</span>
                </div>
                <span className={`block text-[8px] font-mono font-medium ${isEmaBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isEmaBullish ? 'GOLDEN CROSS' : 'DEATH CROSS'}
                </span>
              </div>
            </div>

            {/* Support and Resistance */}
            <div className="bg-slate-950/30 p-2.5 rounded-xl border border-slate-900 space-y-1.5">
              <span className="text-xs font-semibold text-slate-300 block mb-0.5 font-sans">Key Levels (30m Range)</span>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Resistance</span>
                <span className="text-rose-400 font-bold bg-rose-950/10 px-1.5 py-0.5 rounded border border-rose-950/20">
                  ₹{resistance ? resistance.toFixed(1) : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Support</span>
                <span className="text-emerald-400 font-bold bg-emerald-950/10 px-1.5 py-0.5 rounded border border-emerald-950/20">
                  ₹{support ? support.toFixed(1) : '-'}
                </span>
              </div>
            </div>

            {/* Volume Analysis */}
            <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-900">
              <div>
                <span className="text-xs font-semibold text-slate-300 font-sans">Volume</span>
                <p className="text-[9px] text-slate-500">Current vs 10-period avg</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-200">{latestVolume.toLocaleString()}</span>
                <span className={`block text-[8px] font-mono font-medium ${isVolumeExpansion ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isVolumeExpansion ? 'SPIKE (>1.3x)' : `Avg: ${Math.round(avgVolume).toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* RSI */}
            <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-900">
              <div>
                <span className="text-xs font-semibold text-slate-300 font-sans">RSI (14)</span>
                <p className="text-[9px] text-slate-500">Relative Strength Index</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold ${rsi >= 55 ? 'text-emerald-400' : rsi <= 45 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {rsi ? rsi.toFixed(1) : '-'}
                </span>
                <span className="block text-[8px] text-slate-500">
                  {rsi >= 55 ? 'BULLISH' : rsi <= 45 ? 'BEARISH' : 'NEUTRAL'}
                </span>
              </div>
            </div>

            {/* MACD */}
            <div className="flex justify-between items-center bg-slate-950/30 p-2.5 rounded-xl border border-slate-900">
              <div>
                <span className="text-xs font-semibold text-slate-300 font-sans">MACD (12, 26, 9)</span>
                <p className="text-[9px] text-slate-500">Moving Avg Conv/Div</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold ${macd.macd > macd.signal ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {macd.macd ? macd.macd.toFixed(2) : '-'}
                </span>
                <span className="block text-[8px] text-slate-500">
                  Hist: {macd.histogram ? macd.histogram.toFixed(2) : '-'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
            Waiting for indicator computations...
          </div>
        )}
      </div>
    </div>
  );
}
