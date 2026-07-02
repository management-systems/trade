import React from 'react';
import { ToggleLeft, ToggleRight, Check, X, ShieldAlert, Settings, Info } from 'lucide-react';

export default function CriteriaPanel({ settings, onToggle, thresholds, onThresholdChange, marketData }) {
  const spot = marketData.niftySpot || 0;
  const indicators = marketData.indicators || {};
  const optionChain = marketData.optionChain || [];
  
  // Extract indicator values safely
  const ema20 = indicators.ema20 || 0;
  const ema50 = indicators.ema50 || 0;
  const vwap = indicators.vwap || 0;
  const support = indicators.support || 0;
  const resistance = indicators.resistance || 0;
  const avgVolume = indicators.avgVolume || 0;
  const latestVolume = indicators.latestVolume || 0;
  const rsi = indicators.rsi || 50;
  const macdData = indicators.macd || { macd: 0, signal: 0, histogram: 0 };
  const vix = marketData.indiaVix || 14.5;
  const futuresOi = marketData.futuresOi || 1250000;

  // ATM Strikes and Options Chain Calculations
  const atmStrike = Math.round(spot / 50) * 50;
  let ceOiChangeAtmNear = 0;
  let peOiChangeAtmNear = 0;
  optionChain.forEach(item => {
    if (Math.abs(item.strike - atmStrike) <= 150) {
      ceOiChangeAtmNear += item.ce?.oiChange || 0;
      peOiChangeAtmNear += item.pe?.oiChange || 0;
    }
  });

  // Check conditions
  const ceVwapMet = spot > vwap;
  const peVwapMet = spot < vwap;

  const ceEmaMet = ema20 && ema50 && ema20 > ema50;
  const peEmaMet = ema20 && ema50 && ema20 < ema50;

  const ceBreakoutMet = resistance && spot > resistance;
  const peBreakoutMet = support && spot < support;

  const volumeMet = latestVolume > avgVolume * (thresholds.volumeMult || 1.3);

  const ceRsiMet = rsi > (thresholds.rsiBullish || 55);
  const peRsiMet = rsi < (thresholds.rsiBearish || 45);

  const ceMacdMet = macdData.macd > macdData.signal;
  const peMacdMet = macdData.macd < macdData.signal;

  const ceOiMet = ceOiChangeAtmNear < -100 || peOiChangeAtmNear > 100;
  const peOiMet = peOiChangeAtmNear < -100 || ceOiChangeAtmNear > 100;

  const vixMet = vix < (thresholds.vixMax || 22);

  // Indicators list structure
  const indicatorsList = [
    {
      id: 'vwap',
      name: 'VWAP Boundary',
      liveValue: `Spot: ₹${spot.toFixed(1)} | VWAP: ₹${vwap.toFixed(1)}`,
      ceCondition: `Spot > VWAP`,
      peCondition: `Spot < VWAP`,
      ceMet: ceVwapMet,
      peMet: peVwapMet,
      weight: '25%'
    },
    {
      id: 'ema',
      name: 'EMA 20 / 50 Crossover',
      liveValue: `EMA20: ₹${ema20.toFixed(1)} | EMA50: ₹${ema50.toFixed(1)}`,
      ceCondition: 'EMA 20 > EMA 50',
      peCondition: 'EMA 20 < EMA 50',
      ceMet: ceEmaMet,
      peMet: peEmaMet,
      weight: '25%'
    },
    {
      id: 'breakout',
      name: 'Support & Resistance Floor',
      liveValue: `Resist: ₹${resistance.toFixed(1)} | Supp: ₹${support.toFixed(1)}`,
      ceCondition: 'Spot > Resistance',
      peCondition: 'Spot < Support',
      ceMet: ceBreakoutMet,
      peMet: peBreakoutMet,
      weight: '20%'
    },
    {
      id: 'volume',
      name: 'Volume Expansion',
      liveValue: `Vol: ${latestVolume.toLocaleString()} | MA: ${(Math.round(avgVolume * thresholds.volumeMult)).toLocaleString()}`,
      ceCondition: `Vol > MA * ${thresholds.volumeMult}`,
      peCondition: `Vol > MA * ${thresholds.volumeMult}`,
      ceMet: volumeMet,
      peMet: volumeMet,
      weight: '15%'
    },
    {
      id: 'rsi',
      name: 'RSI Momentum Oscillator',
      liveValue: `RSI: ${rsi.toFixed(1)}`,
      ceCondition: `RSI > ${thresholds.rsiBullish}`,
      peCondition: `RSI < ${thresholds.rsiBearish}`,
      ceMet: ceRsiMet,
      peMet: peRsiMet,
      weight: '15%'
    },
    {
      id: 'macd',
      name: 'MACD Trend Oscillator',
      liveValue: `MACD: ${macdData.macd.toFixed(2)} | Sig: ${macdData.signal.toFixed(2)}`,
      ceCondition: 'MACD > Signal Line',
      peCondition: 'MACD < Signal Line',
      ceMet: ceMacdMet,
      peMet: peMacdMet,
      weight: '15%'
    },
    {
      id: 'oi',
      name: 'Options Open Interest (OI)',
      liveValue: `CE Chg: ${(ceOiChangeAtmNear/1000).toFixed(1)}k | PE Chg: ${(peOiChangeAtmNear/1000).toFixed(1)}k`,
      ceCondition: 'Call Unwind / Put Write',
      peCondition: 'Put Unwind / Call Write',
      ceMet: ceOiMet,
      peMet: peOiMet,
      weight: '15%'
    },
    {
      id: 'vix',
      name: 'India VIX Fear Index',
      liveValue: `VIX: ${vix.toFixed(2)}%`,
      ceCondition: `VIX < ${thresholds.vixMax}%`,
      peCondition: `VIX < ${thresholds.vixMax}%`,
      ceMet: vixMet,
      peMet: vixMet,
      weight: 'Safety'
    }
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      
      {/* Col 1: Configurator and Thresholds */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 xl:col-span-1 space-y-6">
        <div className="border-b border-slate-800 pb-3 mb-2 flex items-center space-x-2">
          <Settings className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-bold font-mono text-slate-200">Rule Threshold Configurator</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1.5 uppercase">
              RSI Bullish Threshold (CE)
            </label>
            <input 
              type="number"
              value={thresholds.rsiBullish}
              onChange={(e) => onThresholdChange('rsiBullish', parseFloat(e.target.value))}
              min="50"
              max="90"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1.5 uppercase">
              RSI Bearish Threshold (PE)
            </label>
            <input 
              type="number"
              value={thresholds.rsiBearish}
              onChange={(e) => onThresholdChange('rsiBearish', parseFloat(e.target.value))}
              min="10"
              max="50"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1.5 uppercase">
              India VIX Max Safety Limit
            </label>
            <input 
              type="number"
              value={thresholds.vixMax}
              onChange={(e) => onThresholdChange('vixMax', parseFloat(e.target.value))}
              min="10"
              max="40"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1.5 uppercase">
              Volume MA Multiplier
            </label>
            <input 
              type="number"
              value={thresholds.volumeMult}
              onChange={(e) => onThresholdChange('volumeMult', parseFloat(e.target.value))}
              step="0.1"
              min="1.0"
              max="3.0"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl flex items-start space-x-2">
          <Info className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] font-mono text-slate-400 leading-normal">
            Adjusting these parameters overrides default settings, dynamically tailoring signals for high or low volatility setups.
          </p>
        </div>
      </div>

      {/* Col 2-3: Side-by-Side Live Indicators Verification */}
      <div className="xl:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
        <div>
          <div className="border-b border-slate-800 pb-3 mb-4 flex items-center justify-between">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider font-bold">
              CE vs PE Indicators Matrix Scanner
            </h3>
            <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded animate-pulse">
              Live Feed Synced
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px] min-w-[500px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-900 uppercase text-[9px] pb-1">
                  <th className="py-2">Rule Parameter</th>
                  <th className="py-2">Live Value</th>
                  <th className="py-2">CE (Call Option)</th>
                  <th className="py-2">PE (Put Option)</th>
                  <th className="py-2 text-center">Status</th>
                  <th className="py-2 text-center">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40 text-slate-300">
                {indicatorsList.map((item) => {
                  const isEnabled = settings[item.id];
                  return (
                    <tr key={item.id} className={`hover:bg-slate-900/10 ${!isEnabled ? 'opacity-40 bg-slate-950/20' : ''}`}>
                      <td className="py-3 font-semibold text-slate-200">{item.name}</td>
                      <td className="py-3 text-slate-400">{item.liveValue}</td>
                      
                      {/* CE Condition status */}
                      <td className="py-3">
                        <div className="flex items-center space-x-1.5">
                          {item.ceMet ? (
                            <Check className="h-4.5 w-4.5 text-emerald-400 bg-emerald-950/30 p-0.5 rounded border border-emerald-900/20" />
                          ) : (
                            <X className="h-4.5 w-4.5 text-rose-500 bg-rose-950/30 p-0.5 rounded border border-rose-900/20" />
                          )}
                          <span className="text-[10px] text-slate-400">{item.ceCondition}</span>
                        </div>
                      </td>

                      {/* PE Condition status */}
                      <td className="py-3">
                        <div className="flex items-center space-x-1.5">
                          {item.peMet ? (
                            <Check className="h-4.5 w-4.5 text-emerald-400 bg-emerald-950/30 p-0.5 rounded border border-emerald-900/20" />
                          ) : (
                            <X className="h-4.5 w-4.5 text-rose-500 bg-rose-950/30 p-0.5 rounded border border-rose-900/20" />
                          )}
                          <span className="text-[10px] text-slate-400">{item.peCondition}</span>
                        </div>
                      </td>

                      {/* Status indicator */}
                      <td className="py-3 text-center">
                        {isEnabled ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 text-[8px] tracking-widest font-extrabold animate-pulse">
                            LIVE
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-950/20 border border-amber-900/20 text-amber-500 text-[8px] tracking-widest font-extrabold">
                            NOT RUNNING
                          </span>
                        )}
                      </td>

                      {/* Toggle button */}
                      <td className="py-3 text-center">
                        <button 
                          onClick={() => onToggle(item.id)}
                          className="text-slate-400 hover:text-white transition"
                        >
                          {isEnabled ? (
                            <ToggleRight className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-slate-600" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-4 mt-6">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900 flex items-start space-x-3 text-[10px] text-slate-400">
            <ShieldAlert className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p>
              **Rule Compliance Safeguard**: Indicators labeled as <span className="text-amber-500">NOT RUNNING</span> are completely skipped during dynamic crossover evaluations. Toggling a rule off changes the divisor when generating cumulative confidence signals.
            </p>
          </div>
        </div>
      </div>
      
    </div>
  );
}
