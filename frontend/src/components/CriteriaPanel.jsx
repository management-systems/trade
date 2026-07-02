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
      id: 'structure',
      name: 'Market Structure',
      liveValue: `Trend: ${indicators.structure?.trend || 'NEUTRAL'} [H: ₹${Math.round(indicators.structure?.currentHigh || 0)} | L: ₹${Math.round(indicators.structure?.currentLow || 0)}]`,
      ceCondition: 'High > Prev High & Low > Prev Low',
      peCondition: 'High < Prev High & Low < Prev Low',
      ceMet: indicators.structure?.trend === 'BULLISH',
      peMet: indicators.structure?.trend === 'BEARISH',
      weight: 20
    },
    {
      id: 'vwap',
      name: 'VWAP',
      liveValue: `Spot: ₹${spot.toFixed(1)} | VWAP: ₹${vwap.toFixed(1)}`,
      ceCondition: `Spot > VWAP`,
      peCondition: `Spot < VWAP`,
      ceMet: ceVwapMet,
      peMet: peVwapMet,
      weight: 10
    },
    {
      id: 'ema',
      name: 'EMA 20 > 50 Cross',
      liveValue: `EMA20: ₹${ema20.toFixed(1)} | EMA50: ₹${ema50.toFixed(1)}`,
      ceCondition: 'EMA 20 > EMA 50',
      peCondition: 'EMA 20 < EMA 50',
      ceMet: ceEmaMet,
      peMet: peEmaMet,
      weight: 10
    },
    {
      id: 'breakout',
      name: 'Support & Resistance',
      liveValue: `Resist: ₹${resistance.toFixed(1)} | Supp: ₹${support.toFixed(1)}`,
      ceCondition: 'Spot > Resistance',
      peCondition: 'Spot < Support',
      ceMet: ceBreakoutMet,
      peMet: peBreakoutMet,
      weight: 15
    },
    {
      id: 'volume',
      name: 'Volume Expansion',
      liveValue: `Vol: ${latestVolume.toLocaleString()} | MA: ${(Math.round(avgVolume * thresholds.volumeMult)).toLocaleString()}`,
      ceCondition: `Vol > MA * ${thresholds.volumeMult}`,
      peCondition: `Vol > MA * ${thresholds.volumeMult}`,
      ceMet: volumeMet,
      peMet: volumeMet,
      weight: 10
    },
    {
      id: 'vix',
      name: 'Futures OI / Volatility',
      liveValue: `VIX: ${vix.toFixed(2)}% | Futures OI Chg: ${(marketData.futuresOiChange || 0).toLocaleString()}`,
      ceCondition: `VIX < ${thresholds.vixMax}% & Fut OI > 0`,
      peCondition: `VIX < ${thresholds.vixMax}% & Fut OI < 0`,
      ceMet: vixMet && (marketData.futuresOiChange || 0) > 0,
      peMet: vixMet && (marketData.futuresOiChange || 0) < 0,
      weight: 15
    },
    {
      id: 'oi',
      name: 'Option Chain (OI)',
      liveValue: `CE Chg: ${(ceOiChangeAtmNear/1000).toFixed(1)}k | PE Chg: ${(peOiChangeAtmNear/1000).toFixed(1)}k`,
      ceCondition: 'Call Unwind / Put Write',
      peCondition: 'Put Unwind / Call Write',
      ceMet: ceOiMet,
      peMet: peOiMet,
      weight: 10
    },
    {
      id: 'rsi',
      name: 'RSI Momentum',
      liveValue: `RSI: ${rsi.toFixed(1)}`,
      ceCondition: `RSI > ${thresholds.rsiBullish}`,
      peCondition: `RSI < ${thresholds.rsiBearish}`,
      ceMet: ceRsiMet,
      peMet: peRsiMet,
      weight: 5
    },
    {
      id: 'macd',
      name: 'MACD Oscillator',
      liveValue: `MACD: ${macdData.macd.toFixed(2)} | Sig: ${macdData.signal.toFixed(2)}`,
      ceCondition: 'MACD > Signal Line',
      peCondition: 'MACD < Signal Line',
      ceMet: ceMacdMet,
      peMet: peMacdMet,
      weight: 5
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

      {/* Col 2-3: Side-by-Side Split Scanner Tables (CE left, PE right) */}
      <div className="xl:col-span-2 flex flex-col justify-between space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* CE Call Scanners Table */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4">
            <div className="border-b border-slate-800 pb-3 mb-2 flex items-center justify-between">
              <h3 className="text-xs font-mono text-emerald-450 uppercase tracking-wider font-bold">
                CALL (CE) SCANNER CRITERIA
              </h3>
              <span className="text-[9px] font-mono bg-emerald-950/40 border border-emerald-900/30 text-emerald-450 px-2 py-0.5 rounded">
                Score Weight
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-900 uppercase text-[8px] pb-1">
                    <th className="py-2">Rule Parameter</th>
                    <th className="py-2 text-center">Wt</th>
                    <th className="py-2">CE Condition</th>
                    <th className="py-2 text-center">Status</th>
                    <th className="py-2 text-center">Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40 text-slate-350">
                  {indicatorsList.map((item) => {
                    const isEnabled = settings[item.id];
                    return (
                      <tr key={item.id} className={`hover:bg-slate-900/10 ${!isEnabled ? 'opacity-40 bg-slate-950/20' : ''}`}>
                        <td className="py-3 font-semibold text-slate-200">
                          <div>{item.name}</div>
                          <div className="text-[8px] text-slate-500 font-normal mt-0.5">{item.liveValue}</div>
                        </td>
                        <td className="py-3 text-center text-slate-400 font-bold">{item.weight}</td>
                        <td className="py-3 text-slate-400">{item.ceCondition}</td>
                        <td className="py-3 text-center">
                          {item.ceMet ? (
                            <span className="text-emerald-450 text-xs font-bold">🟢</span>
                          ) : (
                            <span className="text-rose-455 text-xs font-bold">🔴</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <button 
                            onClick={() => onToggle(item.id)}
                            className="text-slate-450 hover:text-white transition"
                          >
                            {isEnabled ? (
                              <ToggleRight className="h-4.5 w-4.5 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="h-4.5 w-4.5 text-slate-600" />
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

          {/* PE Put Scanners Table */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4">
            <div className="border-b border-slate-800 pb-3 mb-2 flex items-center justify-between">
              <h3 className="text-xs font-mono text-rose-450 uppercase tracking-wider font-bold">
                PUT (PE) SCANNER CRITERIA
              </h3>
              <span className="text-[9px] font-mono bg-rose-950/40 border border-rose-900/30 text-rose-450 px-2 py-0.5 rounded">
                Score Weight
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-900 uppercase text-[8px] pb-1">
                    <th className="py-2">Rule Parameter</th>
                    <th className="py-2 text-center">Wt</th>
                    <th className="py-2">PE Condition</th>
                    <th className="py-2 text-center">Status</th>
                    <th className="py-2 text-center">Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40 text-slate-350">
                  {indicatorsList.map((item) => {
                    const isEnabled = settings[item.id];
                    return (
                      <tr key={item.id} className={`hover:bg-slate-900/10 ${!isEnabled ? 'opacity-40 bg-slate-950/20' : ''}`}>
                        <td className="py-3 font-semibold text-slate-200">
                          <div>{item.name}</div>
                          <div className="text-[8px] text-slate-500 font-normal mt-0.5">{item.liveValue}</div>
                        </td>
                        <td className="py-3 text-center text-slate-400 font-bold">{item.weight}</td>
                        <td className="py-3 text-slate-400">{item.peCondition}</td>
                        <td className="py-3 text-center">
                          {item.peMet ? (
                            <span className="text-emerald-450 text-xs font-bold">🟢</span>
                          ) : (
                            <span className="text-rose-455 text-xs font-bold">🔴</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <button 
                            onClick={() => onToggle(item.id)}
                            className="text-slate-450 hover:text-white transition"
                          >
                            {isEnabled ? (
                              <ToggleRight className="h-4.5 w-4.5 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="h-4.5 w-4.5 text-slate-600" />
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

        </div>

        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-900 flex items-start space-x-3 text-[10px] text-slate-400">
          <ShieldAlert className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p>
            **Rules Matrix Sync**: Disabling any indicator flips the scanning status for both CE and PE pipelines. Disabled indicators are completely skipped during signal score weight compilations.
          </p>
        </div>
      </div>
      
    </div>
  );
}
