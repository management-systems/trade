import React from 'react';
import { ToggleLeft, ToggleRight, CheckCircle2, XCircle, Info } from 'lucide-react';

export default function CriteriaPanel({ settings, onToggle }) {
  const criteriaList = [
    {
      id: 'vwap',
      name: 'VWAP Alignment Boundary',
      desc: 'Bullish when Spot is above VWAP; Bearish when Spot is below VWAP.',
      weight: '25%',
      impact: 'Core Trend Filter'
    },
    {
      id: 'ema',
      name: 'EMA 20 & 50 Crossover',
      desc: 'Bullish golden-cross (EMA 20 > 50) or Bearish death-cross (EMA 20 < 50).',
      weight: '25%',
      impact: 'Trend Speed Indicator'
    },
    {
      id: 'breakout',
      name: 'Support & Resistance Breakout',
      desc: 'Triggers on breakout above resistance ranges or breakdown below support floors.',
      weight: '20%',
      impact: 'Volatile Range Breakout'
    },
    {
      id: 'volume',
      name: 'Volume Expansion Guard',
      desc: 'Verifies if current candle volume is higher than average (1.3x expansion multiplier).',
      weight: '15%',
      impact: 'Market Momentum Confirm'
    },
    {
      id: 'oi',
      name: 'Open Interest (OI) Swings',
      desc: 'Reads options chain net additions (Call unwinding & Put writing) to spot trend direction.',
      weight: '15%',
      impact: 'Institutional Action Feed'
    }
  ];

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800">
      <div className="border-b border-slate-800 pb-4 mb-5">
        <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>CE | PE Signal Rules Dashboard</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1 font-sans">
          Toggle rules on/off. When you toggle a rule, the live signal engine instantly recalculates confidence scores in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {criteriaList.map((item) => {
          const isEnabled = settings[item.id];
          return (
            <div 
              key={item.id}
              className={`p-4 rounded-xl border transition ${
                isEnabled 
                  ? 'bg-slate-900/30 border-emerald-500/20' 
                  : 'bg-slate-950/40 border-slate-900/60 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold font-mono text-slate-200 flex items-center space-x-1.5">
                    <span>{item.name}</span>
                    <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                      Weight: {item.weight}
                    </span>
                  </h4>
                  <span className="text-[9px] font-mono text-emerald-400 tracking-wide uppercase mt-1 block">
                    {item.impact}
                  </span>
                </div>
                
                <button 
                  onClick={() => onToggle(item.id)}
                  className="text-slate-400 hover:text-white transition"
                >
                  {isEnabled ? (
                    <ToggleRight className="h-6 w-6 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-slate-600" />
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 font-sans leading-relaxed">
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl mt-6 flex items-start space-x-3">
        <Info className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] font-mono text-slate-400 space-y-1">
          <p className="text-slate-200 font-bold">How Signal Scoring Works:</p>
          <p>- When criteria are evaluated, the engine checks only your **Enabled Rules**.</p>
          <p>- Active score percentages are calculated relative to the total sum of enabled weights.</p>
          <p>- A signal of `BUY CE` or `BUY PE` is generated once confidence crosses **60%**.</p>
        </div>
      </div>
    </div>
  );
}
