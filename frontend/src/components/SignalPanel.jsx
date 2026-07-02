import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, AlertCircle, PlayCircle, Lock, ShieldAlert, Award } from 'lucide-react';

export default function SignalPanel({ signal, riskLimitHit, onExecuteTrade, liveModeActive, indiaVix }) {
  const { 
    type = 'NO TRADE', 
    confidence = 0, 
    reasons = [], 
    atmStrike = 24100, 
    ceConfidence = 0, 
    peConfidence = 0,
    ceList = [],
    peList = [],
    bias = 0
  } = signal || {};

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

  // Dynamic Stop Loss & Target calculations matching mockup
  const sl = type === 'BUY CE' ? (atmStrike - 40) : type === 'BUY PE' ? (atmStrike + 40) : '-';
  const target1 = type === 'BUY CE' ? (atmStrike + 80) : type === 'BUY PE' ? (atmStrike - 80) : '-';
  const target2 = type === 'BUY CE' ? (atmStrike + 150) : type === 'BUY PE' ? (atmStrike - 150) : '-';
  const riskLevel = indiaVix > 20 ? 'HIGH' : indiaVix > 15 ? 'MEDIUM' : 'LOW';

  // Badges calculation helpers
  const getBadgeStatus = (indicatorName) => {
    const list = type === 'BUY PE' ? peList : ceList;
    const match = list.find(item => item.name.toLowerCase().includes(indicatorName.toLowerCase()));
    if (!match) return { label: 'Neutral', color: 'bg-slate-900 text-slate-400 border-slate-800' };
    
    if (match.score > 0) {
      if (indicatorName === 'structure') return { label: 'Very Strong', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' };
      if (indicatorName === 'vwap' || indicatorName === 'ema') return { label: 'Confirmed', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' };
      return { label: 'Strong', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' };
    }
    return { label: 'Failed', color: 'bg-rose-950/40 text-rose-400 border-rose-900/30' };
  };

  const msBadge = getBadgeStatus('structure');
  const oiBadge = getBadgeStatus('option chain');
  const volBadge = getBadgeStatus('volume');
  const vwapBadge = getBadgeStatus('vwap');
  const emaBadge = getBadgeStatus('ema');
  const vixBadge = indiaVix < 20 
    ? { label: 'Good', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' }
    : { label: 'High Vol', color: 'bg-rose-950/40 text-rose-400 border-rose-900/30' };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full font-mono text-xs text-slate-300">
      
      {/* Col 1: AI Trade Parameters Explanation */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <span className="text-[10px] text-slate-400 tracking-wider font-bold">AI SIGNAL EXPLANATION</span>
            <span className={`text-[10px] border px-2 py-0.5 rounded ${
              type === 'BUY CE' ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40' :
              type === 'BUY PE' ? 'bg-rose-950 text-rose-400 border-rose-800/40' :
              'bg-slate-900 text-slate-400 border-slate-850'
            }`}>
              {type === 'NO TRADE' ? 'SCANNING' : type}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-[9px] text-slate-500 uppercase block">Execution Setup</span>
              <h4 className="text-md font-bold text-slate-100 mt-0.5">
                {type === 'NO TRADE' ? 'SCANNING MARKETS...' : `${type} Trigger @ ${atmStrike}`}
              </h4>
            </div>

            {/* SL and Targets */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/45 p-3 rounded-xl border border-slate-900">
              <div>
                <span className="text-[8px] text-slate-500 block">STOP LOSS</span>
                <span className="text-rose-400 font-bold text-[11px]">{sl === '-' ? '-' : `₹${sl}`}</span>
              </div>
              <div>
                <span className="text-[8px] text-slate-500 block">RISK INDEX</span>
                <span className={`font-bold text-[11px] ${riskLevel === 'HIGH' ? 'text-rose-450' : 'text-emerald-400'}`}>
                  {riskLevel}
                </span>
              </div>
              <div className="border-t border-slate-900/60 pt-2 mt-1">
                <span className="text-[8px] text-slate-500 block">TARGET 1</span>
                <span className="text-emerald-400 font-bold text-[11px]">{target1 === '-' ? '-' : `₹${target1}`}</span>
              </div>
              <div className="border-t border-slate-900/60 pt-2 mt-1">
                <span className="text-[8px] text-slate-500 block">TARGET 2</span>
                <span className="text-emerald-400 font-bold text-[11px]">{target2 === '-' ? '-' : `₹${target2}`}</span>
              </div>
            </div>

            {/* Checklist of met criteria */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Trigger Factors</span>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {reasons.length > 0 ? (
                  reasons.map((r, i) => (
                    <div key={i} className="flex items-start space-x-1.5 text-[10px]">
                      <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                        type === 'BUY CE' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}></span>
                      <span className="text-slate-300 leading-normal">{r}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-550 italic text-[10px]">Evaluating signal triggers...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-slate-800/60">
          {riskLimitHit ? (
            <div className="flex items-center bg-rose-950/20 border border-rose-900/40 p-2.5 rounded-xl space-x-2">
              <Lock className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span className="text-[9px] text-rose-450 font-bold">
                TRADING HALTED: Daily limits hit.
              </span>
            </div>
          ) : hasTradeSignal ? (
            <button
              onClick={handleExecute}
              className={`w-full flex items-center justify-center py-2 rounded-xl font-bold text-[11px] transition ${
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
              className="w-full py-2 bg-slate-800 text-slate-500 rounded-xl font-bold text-[11px] cursor-not-allowed text-center"
            >
              Waiting for Signal...
            </button>
          )}
        </div>
      </div>

      {/* Col 2: Extra Features / Factor Badges */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <span className="text-[10px] text-slate-400 tracking-wider font-bold">FACTOR DIAGNOSTICS</span>
            <Award className="h-4 w-4 text-emerald-400" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-900 flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Structure</span>
              <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${msBadge.color}`}>
                {msBadge.label}
              </span>
            </div>

            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-900 flex justify-between items-center">
              <span className="text-slate-500 font-semibold">OI Sentiment</span>
              <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${oiBadge.color}`}>
                {oiBadge.label}
              </span>
            </div>

            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-900 flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Volume</span>
              <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${volBadge.color}`}>
                {volBadge.label}
              </span>
            </div>

            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-900 flex justify-between items-center">
              <span className="text-slate-500 font-semibold">VWAP Cross</span>
              <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${vwapBadge.color}`}>
                {vwapBadge.label}
              </span>
            </div>

            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-900 flex justify-between items-center">
              <span className="text-slate-500 font-semibold">EMA Cross</span>
              <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${emaBadge.color}`}>
                {emaBadge.label}
              </span>
            </div>

            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-900 flex justify-between items-center">
              <span className="text-slate-500 font-semibold">India VIX</span>
              <span className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${vixBadge.color}`}>
                {vixBadge.label}
              </span>
            </div>

            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-900 flex justify-between items-center col-span-2">
              <span className="text-slate-500 font-semibold">System Bias</span>
              <span className={`px-2 py-0.5 rounded-md border text-[9px] font-extrabold ${
                bias > 15 ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30' :
                bias < -15 ? 'bg-rose-950/40 text-rose-450 border-rose-900/30' :
                'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {bias > 15 ? 'BULLISH BIAS' : bias < -15 ? 'BEARISH BIAS' : 'NEUTRAL BIAS'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-900/80 p-3 rounded-xl flex items-start space-x-2">
          <ShieldAlert className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-[9.5px] text-slate-500 leading-normal">
            **Diagnostics Log**: Met indicators represent active weight multipliers. Adjust parameters in the Criteria tab to dynamically adapt scoring filters.
          </p>
        </div>
      </div>
      
    </div>
  );
}
