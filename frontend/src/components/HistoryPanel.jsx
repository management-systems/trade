import React from 'react';
import { History, Award, TrendingUp, TrendingDown } from 'lucide-react';

export default function HistoryPanel({ history, metrics }) {
  const { totalTrades = 0, winningTrades = 0, losingTrades = 0, winRatio = 0 } = metrics || {};

  const totalPnl = history.reduce((sum, t) => sum + t.pnl, 0);
  const totalPnlColor = totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-500';

  return (
    <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4">
      {/* Header & Trade Metrics Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-3 gap-3">
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center">
          <History className="h-4 w-4 text-emerald-400 mr-1.5" />
          Trade History & Logs
        </h3>

        {totalTrades > 0 && (
          <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
            <div className="bg-slate-950 px-2.5 py-1 rounded border border-slate-900 text-slate-400">
              Total Trades: <span className="text-slate-100 font-bold">{totalTrades}</span>
            </div>
            <div className="bg-slate-950 px-2.5 py-1 rounded border border-slate-900 text-slate-400">
              Win/Loss: <span className="text-emerald-400 font-bold">{winningTrades}</span>/<span className="text-rose-400 font-bold">{losingTrades}</span>
            </div>
            <div className="bg-slate-950 px-2.5 py-1 rounded border border-slate-900 text-slate-400 flex items-center">
              <Award className="h-3.5 w-3.5 text-amber-400 mr-1" />
              Win Ratio: <span className="text-amber-400 font-bold">{winRatio}%</span>
            </div>
            <div className="bg-slate-950 px-2.5 py-1 rounded border border-slate-900 text-slate-400">
              Total Realized: <span className={`font-extrabold ${totalPnlColor}`}>
                ₹{totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      {history.length > 0 ? (
        <div className="overflow-x-auto max-h-[350px] overflow-y-auto pr-1">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-slate-950 sticky top-0 border-b border-slate-900 text-slate-500 uppercase text-[9px]">
              <tr>
                <th className="py-2">Date/Time</th>
                <th className="py-2">Instrument</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Entry</th>
                <th className="py-2">Exit</th>
                <th className="py-2">Exit Trigger</th>
                <th className="py-2 text-right">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/40 text-slate-300">
              {[...history].reverse().map((trade, idx) => {
                const timeString = new Date(trade.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const isWin = trade.pnl > 0;
                
                return (
                  <tr key={trade.id || idx} className="hover:bg-slate-900/10">
                    <td className="py-2.5 text-slate-500">{timeString}</td>
                    <td className="py-2.5 font-bold text-slate-200">
                      {trade.symbol}
                      {trade.isAutoSignal && (
                        <span className="ml-1 text-[8px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-1 rounded">AUTO</span>
                      )}
                    </td>
                    <td className="py-2.5">{trade.quantity}</td>
                    <td className="py-2.5 text-slate-400">₹{trade.entryPrice.toFixed(2)}</td>
                    <td className="py-2.5 text-slate-300">₹{trade.exitPrice.toFixed(2)}</td>
                    <td className="py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        trade.reason === 'TARGET HIT' 
                          ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-950/40' 
                          : trade.reason === 'STOP LOSS HIT' 
                            ? 'bg-rose-950/20 text-rose-400 border border-rose-950/40' 
                            : 'bg-slate-950 border border-slate-900 text-slate-400'
                      }`}>
                        {trade.reason}
                      </span>
                    </td>
                    <td className={`py-2.5 text-right font-extrabold flex items-center justify-end space-x-1 ${
                      isWin ? 'text-emerald-400' : 'text-rose-500'
                    }`}>
                      {isWin ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>₹{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-slate-600 font-mono text-xs">
          No trades logged in history.
        </div>
      )}
    </div>
  );
}
