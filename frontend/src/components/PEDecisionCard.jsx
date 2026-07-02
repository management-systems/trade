import React from 'react';
import { ArrowDownRight } from 'lucide-react';

export default function PEDecisionCard({ list, totalScore }) {
  return (
    <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between h-full font-mono text-[11px]">
      <div>
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <span className="text-rose-450 font-bold uppercase tracking-wider flex items-center">
            <ArrowDownRight className="h-4 w-4 mr-1" />
            PE Put Analysis
          </span>
          <span className="text-[10px] bg-rose-950/40 text-rose-400 border border-rose-900/30 px-2 py-0.5 rounded">
            Score: {totalScore} / 100
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-500 border-b border-slate-900 text-[9px] uppercase">
                <th className="pb-1">Indicator</th>
                <th className="pb-1 text-center">Status</th>
                <th className="pb-1 text-center">Weight</th>
                <th className="pb-1 text-center">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-950/20 text-slate-300">
              {list.map((item, idx) => {
                let badge = '🔴';
                if (item.status === 'PASS') badge = '🟢';
                else if (item.status === 'WEAK') badge = '🟡';

                return (
                  <tr key={idx} className="hover:bg-slate-900/10">
                    <td className="py-2.5 font-semibold text-slate-200">{item.name}</td>
                    <td className="py-2.5 text-center text-sm">{badge}</td>
                    <td className="py-2.5 text-center text-slate-400">{item.weight}</td>
                    <td className="py-2.5 text-center text-slate-100 font-bold">{item.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-slate-800/80 pt-3 mt-4">
        <div className="bg-rose-950/10 border border-rose-900/20 rounded-xl p-2.5 flex justify-between items-center text-[10px] text-rose-450">
          <span>Cumulative PE Confidence</span>
          <span className="font-extrabold text-xs">{totalScore}%</span>
        </div>
      </div>
    </div>
  );
}
