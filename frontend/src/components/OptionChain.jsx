import React from 'react';
import { ShoppingCart } from 'lucide-react';

export default function OptionChain({ optionChain, niftySpot, onSelectContract }) {
  if (!optionChain || optionChain.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex items-center justify-center h-[400px]">
        <div className="text-slate-500 font-mono text-xs animate-pulse">
          Streaming NIFTY 50 Option Chain...
        </div>
      </div>
    );
  }

  // Find ATM strike
  const atmStrike = Math.round(niftySpot / 50) * 50;

  // Find highest Open Interest strikes
  const maxCeOi = Math.max(...optionChain.map(row => row.ce?.oi || 0));
  const maxPeOi = Math.max(...optionChain.map(row => row.pe?.oi || 0));

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-200">NIFTY 50 Option Chain</h3>
          <p className="text-[10px] text-slate-400 font-mono">Centered ATM: {atmStrike} | Expiry: 26-JUL-2026</p>
        </div>
        <div className="text-xs bg-slate-950 px-3 py-1 rounded-full border border-slate-800 font-mono text-slate-300">
          Spot: <span className="text-emerald-400 font-bold">₹{niftySpot?.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-[400px]">
        <table className="w-full text-left font-mono text-[11px] border-collapse">
          {/* Header Row */}
          <thead className="bg-slate-950/80 sticky top-0 border-b border-slate-800 text-slate-400 text-center font-bold">
            <tr>
              <th colSpan="4" className="py-2 border-r border-slate-800 text-emerald-400/90 bg-emerald-950/5">CALLS (CE)</th>
              <th className="py-2 bg-slate-950 text-slate-300">STRIKE</th>
              <th colSpan="4" className="py-2 border-l border-slate-800 text-rose-400/90 bg-rose-950/5">PUTS (PE)</th>
            </tr>
            <tr className="border-b border-slate-800 bg-slate-950 text-slate-500 text-[9px] uppercase">
              <th className="py-1 px-1.5 text-left">Volume</th>
              <th className="py-1 px-1.5">OI Chg%</th>
              <th className="py-1 px-1.5">OI</th>
              <th className="py-1 px-1.5 border-r border-slate-800">LTP</th>
              <th className="py-1 px-2 bg-slate-900 text-slate-400">Strike</th>
              <th className="py-1 px-1.5 border-l border-slate-800">LTP</th>
              <th className="py-1 px-1.5">OI</th>
              <th className="py-1 px-1.5">OI Chg%</th>
              <th className="py-1 px-1.5 text-right">Volume</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-900/60 text-center">
            {optionChain.map((row) => {
              const isAtm = row.strike === atmStrike;
              const isItmCe = row.strike < niftySpot;
              const isItmPe = row.strike > niftySpot;
              
              const isMaxCeOi = row.ce.oi === maxCeOi && maxCeOi > 0;
              const isMaxPeOi = row.pe.oi === maxPeOi && maxPeOi > 0;

              return (
                <tr 
                  key={row.strike} 
                  className={`hover:bg-slate-800/20 transition-colors ${
                    isAtm ? 'bg-slate-800/10 border-y-2 border-emerald-500/20' : ''
                  }`}
                >
                  {/* CE: Volume */}
                  <td className={`py-2.5 px-2 text-left text-slate-400 text-[10px] ${isItmCe ? 'bg-emerald-950/5' : ''}`}>
                    {row.ce.volume.toLocaleString('en-IN')}
                  </td>

                  {/* CE: OI Chg% */}
                  <td className={`py-2.5 px-1 ${
                    row.ce.oiChange >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  } ${isItmCe ? 'bg-emerald-950/5' : ''}`}>
                    {row.ce.oiChange >= 0 ? '+' : ''}{row.ce.oiChangePercent}%
                  </td>

                  {/* CE: OI */}
                  <td className={`py-2.5 px-1.5 text-slate-350 ${
                    isMaxCeOi ? 'text-yellow-400 bg-yellow-950/20 border border-yellow-800/30 font-bold rounded' : ''
                  } ${isItmCe ? 'bg-emerald-950/5' : ''}`}>
                    {Math.round(row.ce.oi / 1000)}k {isMaxCeOi && <span className="text-[7px] bg-yellow-500 text-slate-950 px-1 py-0.5 rounded font-extrabold ml-1">MAX</span>}
                  </td>

                  {/* CE: LTP + Buy Trigger */}
                  <td className={`py-2.5 px-1 border-r border-slate-800/70 text-right ${isItmCe ? 'bg-emerald-950/10 font-semibold' : ''}`}>
                    <div className="flex items-center justify-end space-x-1.5">
                      <span className="text-emerald-400 font-bold">₹{row.ce.ltp.toFixed(2)}</span>
                      <button
                        onClick={() => onSelectContract(row.ce.symbol, 'CE', row.strike, row.ce.ltp)}
                        className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 p-1 rounded transition"
                        title="Buy Call Option"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* STRIKE PRICE */}
                  <td className={`py-2.5 px-2 font-bold text-slate-200 text-xs ${
                    isAtm ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-900/60'
                  }`}>
                    {row.strike}
                  </td>

                  {/* PE: LTP + Buy Trigger */}
                  <td className={`py-2.5 px-1 border-l border-slate-800/70 text-left ${isItmPe ? 'bg-rose-950/10 font-semibold' : ''}`}>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => onSelectContract(row.pe.symbol, 'PE', row.strike, row.pe.ltp)}
                        className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-slate-950 p-1 rounded transition"
                        title="Buy Put Option"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-rose-400 font-bold">₹{row.pe.ltp.toFixed(2)}</span>
                    </div>
                  </td>

                  {/* PE: OI */}
                  <td className={`py-2.5 px-1.5 text-slate-350 ${
                    isMaxPeOi ? 'text-yellow-400 bg-yellow-950/20 border border-yellow-800/30 font-bold rounded' : ''
                  } ${isItmPe ? 'bg-rose-950/5' : ''}`}>
                    {Math.round(row.pe.oi / 1000)}k {isMaxPeOi && <span className="text-[7px] bg-yellow-500 text-slate-950 px-1 py-0.5 rounded font-extrabold ml-1">MAX</span>}
                  </td>

                  {/* PE: OI Chg% */}
                  <td className={`py-2.5 px-1 ${
                    row.pe.oiChange >= 0 ? 'text-emerald-500' : 'text-rose-500'
                  } ${isItmPe ? 'bg-rose-950/5' : ''}`}>
                    {row.pe.oiChange >= 0 ? '+' : ''}{row.pe.oiChangePercent}%
                  </td>

                  {/* PE: Volume */}
                  <td className={`py-2.5 px-2 text-right text-slate-400 text-[10px] ${isItmPe ? 'bg-rose-950/5' : ''}`}>
                    {row.pe.volume.toLocaleString('en-IN')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
