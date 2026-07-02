import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, PlayCircle, Lock } from 'lucide-react';

export default function SignalPanel({ signal, riskLimitHit, onExecuteTrade, liveModeActive }) {
  const { type, confidence, reasons = [], atmStrike, ceConfidence = 0, peConfidence = 0 } = signal || { 
    type: 'NO TRADE', 
    confidence: 0, 
    reasons: ['Establishing feed connection...'], 
    atmStrike: null,
    ceConfidence: 0,
    peConfidence: 0
  };

  // Visual formatting parameters based on trade recommendations
  let cardStyles = "border-slate-800 bg-slate-900/20";
  let badgeStyles = "bg-slate-800 text-slate-400 border-slate-700";
  let Icon = AlertCircle;
  let textGrad = "from-slate-400 to-slate-200";
  let glowColor = "rgba(100, 116, 139, 0.15)";
  
  if (type === 'BUY CE') {
    cardStyles = "border-emerald-500/30 bg-emerald-950/10 shadow-lg shadow-emerald-950/20 border-t-4 border-t-emerald-500";
    badgeStyles = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    Icon = ArrowUpCircle;
    textGrad = "from-emerald-400 to-teal-300";
    glowColor = "rgba(16, 185, 129, 0.25)";
  } else if (type === 'BUY PE') {
    cardStyles = "border-rose-500/30 bg-rose-950/10 shadow-lg shadow-rose-950/20 border-t-4 border-t-rose-500";
    badgeStyles = "bg-rose-500/10 text-rose-400 border-rose-500/30";
    Icon = ArrowDownCircle;
    textGrad = "from-rose-400 to-orange-300";
    glowColor = "rgba(239, 68, 68, 0.25)";
  }

  const hasTradeSignal = type === 'BUY CE' || type === 'BUY PE';

  const handleExecute = () => {
    if (riskLimitHit) return;
    if (!atmStrike) return;
    
    const optionType = type === 'BUY CE' ? 'CE' : 'PE';
    const symbol = `NIFTY26JUL${atmStrike}${optionType}`;
    
    onExecuteTrade({
      symbol,
      optionType,
      strike: atmStrike,
      isAutoSignal: true
    });
  };

  return (
    <div 
      className={`glass-panel p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between h-full ${cardStyles}`}
      style={{ boxShadow: `0 8px 32px 0 ${glowColor}` }}
    >
      <div>
        {/* Title & Badge Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
          <span className="text-xs font-mono text-slate-400 tracking-wider">SIGNAL ENGINE</span>
          <span className={`text-[10px] font-mono border px-2 py-0.5 rounded-full ${badgeStyles}`}>
            {type}
          </span>
        </div>

        {/* Central Display: Signal Indicator & Confidence */}
        <div className="flex items-center space-x-5">
          {/* Circular Indicator */}
          <div className="relative flex items-center justify-center h-16 w-16 flex-shrink-0 bg-slate-950/50 rounded-full border border-slate-800">
            <Icon className={`h-8 w-8 ${
              type === 'BUY CE' ? 'text-emerald-400' : type === 'BUY PE' ? 'text-rose-400' : 'text-slate-500'
            }`} />
            
            {/* Confidence Arc (Overlay ring) */}
            {confidence > 0 && (
              <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="29.5"
                  stroke={type === 'BUY CE' ? '#10b981' : '#ef4444'}
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray="185.3"
                  strokeDashoffset={185.3 - (185.3 * confidence) / 100}
                />
              </svg>
            )}
          </div>

          <div>
            <span className="text-[9px] font-mono text-slate-500 uppercase">Recommendation</span>
            <h4 className={`text-lg font-black bg-gradient-to-r bg-clip-text text-transparent ${textGrad}`}>
              {type === 'NO TRADE' ? 'NO ACTIVE TRADE' : `${type} @ ${atmStrike || ''}`}
            </h4>
            
            {confidence > 0 ? (
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-[10px] font-mono text-slate-450">Confidence:</span>
                <span className={`text-[10px] font-bold font-mono ${
                  confidence >= 75 ? 'text-emerald-400' : 'text-amber-405'
                }`}>
                  {confidence}%
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Scanning market structure...</p>
            )}
          </div>
        </div>

        {/* Probability comparative gauges */}
        <div className="mt-5 space-y-3 bg-slate-950/40 p-3.5 rounded-xl border border-slate-900/60">
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <span>BUY CE PROBABILITY</span>
              <span className="text-emerald-400 font-bold">{ceConfidence}%</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${ceConfidence}%` }}
              ></div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <span>BUY PE PROBABILITY</span>
              <span className="text-rose-400 font-bold">{peConfidence}%</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
              <div 
                className="bg-rose-500 h-full transition-all duration-500" 
                style={{ width: `${peConfidence}%` }}
              ></div>
            </div>
          </div>

          {hasTradeSignal && (
            <div className="text-[9px] font-mono text-center text-slate-350 border-t border-slate-900/50 pt-2 mt-1.5">
              DIFFERENCE: <span className="font-extrabold text-emerald-400">
                {Math.abs(ceConfidence - peConfidence)}% {type === 'BUY CE' ? 'CALL' : 'PUT'} BREADTH BIAS
              </span>
            </div>
          )}
        </div>

        {/* Checklist of met criteria */}
        <div className="mt-4 space-y-1.5">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider block">Conditions met</span>
          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start space-x-1.5 text-[10px]">
                <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  type === 'BUY CE' ? 'bg-emerald-500' : type === 'BUY PE' ? 'bg-rose-500' : 'bg-slate-500'
                }`}></span>
                <span className="text-slate-300 leading-normal font-sans">{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action triggers */}
      <div className="mt-4 pt-3 border-t border-slate-800/60">
        {riskLimitHit ? (
          <div className="flex items-center bg-rose-950/20 border border-rose-900/40 p-2.5 rounded-xl space-x-2">
            <Lock className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span className="text-[9px] font-mono text-rose-450">
              TRADING HALTED: Daily limits hit.
            </span>
          </div>
        ) : hasTradeSignal ? (
          <button
            onClick={handleExecute}
            className={`w-full flex items-center justify-center py-2 rounded-xl font-semibold text-xs transition ${
              type === 'BUY CE'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/20'
                : 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-md shadow-rose-950/20'
            }`}
          >
            <PlayCircle className="h-4 w-4 mr-1.5" />
            {liveModeActive ? 'Place Live Order' : 'Execute Paper Trade'}
          </button>
        ) : (
          <button
            disabled
            className="w-full py-2 bg-slate-800 text-slate-500 rounded-xl font-semibold text-xs cursor-not-allowed text-center"
          >
            Waiting for Signal...
          </button>
        )}
      </div>
    </div>
  );
}
