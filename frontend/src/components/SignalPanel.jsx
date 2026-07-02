import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, PlayCircle, Lock } from 'lucide-react';

export default function SignalPanel({ signal, riskLimitHit, onExecuteTrade, liveModeActive }) {
  const { type, confidence, reason, atmStrike } = signal || { type: 'NO TRADE', confidence: 0, reason: 'Establishing feed connection...', atmStrike: null };

  const parsedReasons = reason ? reason.split('|').map(r => r.trim()) : [];

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
    
    // Choose appropriate contract symbol based on signal and ATM strike
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
      {/* Title & Badge Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
          <span className="text-xs font-mono text-slate-400 tracking-wider">SIGNAL ENGINE</span>
          <span className={`text-[10px] font-mono border px-2 py-0.5 rounded-full ${badgeStyles}`}>
            {type}
          </span>
        </div>

        {/* Central Display: Signal Indicator & Confidence */}
        <div className="flex items-center space-x-6">
          {/* Circular Indicator */}
          <div className="relative flex items-center justify-center h-20 w-20 flex-shrink-0 bg-slate-950/50 rounded-full border border-slate-800">
            <Icon className={`h-10 w-10 ${
              type === 'BUY CE' ? 'text-emerald-400' : type === 'BUY PE' ? 'text-rose-400' : 'text-slate-500'
            }`} />
            
            {/* Confidence Arc (Overlay ring) */}
            {confidence > 0 && (
              <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="37.5"
                  stroke={type === 'BUY CE' ? '#10b981' : '#ef4444'}
                  strokeWidth="2.5"
                  fill="transparent"
                  strokeDasharray="235.6"
                  strokeDashoffset={235.6 - (235.6 * confidence) / 100}
                />
              </svg>
            )}
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase">Recommendation</span>
            <h4 className={`text-2xl font-black bg-gradient-to-r bg-clip-text text-transparent ${textGrad}`}>
              {type === 'NO TRADE' ? 'NO ACTIVE TRADE' : `${type} @ ${atmStrike || ''}`}
            </h4>
            
            {confidence > 0 ? (
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs font-mono text-slate-400">Confidence:</span>
                <span className={`text-xs font-bold font-mono ${
                  confidence >= 75 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {confidence}%
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono mt-0.5">Scanning indicators...</p>
            )}
          </div>
        </div>

        {/* Checklist of met criteria */}
        <div className="mt-5 space-y-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Conditions checklist</span>
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {parsedReasons.map((r, i) => (
              <div key={i} className="flex items-start space-x-2 text-xs">
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
      <div className="mt-5 pt-4 border-t border-slate-800/80">
        {riskLimitHit ? (
          <div className="flex items-center bg-rose-950/20 border border-rose-900/40 p-3 rounded-xl space-x-2">
            <Lock className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span className="text-[10px] font-mono text-rose-400">
              TRADING HALTED: Daily loss/trade limit breached.
            </span>
          </div>
        ) : hasTradeSignal ? (
          <button
            onClick={handleExecute}
            className={`w-full flex items-center justify-center py-2.5 rounded-xl font-semibold text-sm transition ${
              type === 'BUY CE'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-950/20'
                : 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-md shadow-rose-950/20'
            }`}
          >
            <PlayCircle className="h-4.5 w-4.5 mr-2" />
            {liveModeActive ? 'Place Live Order' : 'Execute Paper Trade'}
          </button>
        ) : (
          <button
            disabled
            className="w-full py-2.5 bg-slate-800 text-slate-500 rounded-xl font-semibold text-sm cursor-not-allowed text-center"
          >
            Waiting for Signal...
          </button>
        )}
      </div>
    </div>
  );
}
