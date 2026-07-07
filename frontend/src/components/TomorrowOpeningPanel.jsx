import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const CRITERIA = [
  { key: 'giftNifty',    label: 'GIFT Nifty / SGX Proxy',         max: 20, desc: (d) => `Weighted US overnight move (S&P 60% + Nasdaq 40%). Avg change: ${d.sp500Pct > 0 ? '+' : ''}${d.sp500Pct}% S&P | ${d.nasdaqPct > 0 ? '+' : ''}${d.nasdaqPct}% Nasdaq.` },
  { key: 'sp500',        label: 'S&P 500',                         max: 15, desc: (d) => `Most correlated US index with Nifty gap. Change: ${d.sp500Pct > 0 ? '+' : ''}${d.sp500Pct}%.` },
  { key: 'nasdaq',       label: 'Nasdaq Composite',                max: 10, desc: (d) => `Tech-heavy index. Change: ${d.nasdaqPct > 0 ? '+' : ''}${d.nasdaqPct}%.` },
  { key: 'dow',          label: 'Dow Jones Industrial',            max: 5,  desc: (d) => `Blue-chip index. Change: ${d.dowPct > 0 ? '+' : ''}${d.dowPct}%.` },
  { key: 'nikkei',       label: 'Nikkei 225 (Japan)',              max: 5,  desc: (d) => `Asian session leader. Change: ${d.nikkeiPct > 0 ? '+' : ''}${d.nikkeiPct}%.` },
  { key: 'hangseng',     label: 'Hang Seng (Hong Kong)',           max: 5,  desc: (d) => `Asian market sentiment. Change: ${d.hangsengPct > 0 ? '+' : ''}${d.hangsengPct}%.` },
  { key: 'vix',          label: 'India VIX (Volatility Index)',    max: 8,  desc: (d) => `Fear gauge. Lower VIX = calmer market = bullish. Live VIX: ${d.vixVal?.toFixed(2)}%.` },
  { key: 'optionChain',  label: 'Put-Call Ratio (PCR)',            max: 8,  desc: (d) => `PCR > 1.2 = put writing = bullish. PCR < 0.7 = call writing = bearish. Live PCR: ${d.pcr}.` },
  { key: 'crudeOil',     label: 'Brent Crude Oil',                 max: 5,  desc: (d) => `Crude rise = bearish for India (import cost). Change: ${d.crudePct > 0 ? '+' : ''}${d.crudePct}%.` },
  { key: 'usdInr',       label: 'USD / INR Exchange Rate',         max: 5,  desc: (d) => `INR strengthening (USD/INR falling) = FII inflows = bullish. Change: ${d.usdInrPct > 0 ? '+' : ''}${d.usdInrPct}%.` },
  { key: 'gold',         label: 'Gold (Safe Haven)',               max: 4,  desc: (d) => `Gold rising = risk-off sentiment = bearish for equities. Change: ${d.goldPct > 0 ? '+' : ''}${d.goldPct}%.` },
  { key: 'prevDayClose', label: 'Prev Day Close Strength',         max: 5,  desc: (d) => `Nifty closed at ${d.closePosPct}% of day range. Near high = bullish carry.` },
  { key: 'fiiDii',       label: 'FII / DII Flow Proxy',            max: 5,  desc: (d) => `Estimated from Nifty close position + S&P direction. Proxy score.` },
];

export default function TomorrowOpeningPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchForecastData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTomorrowOpeningData();
      if (res?.success) {
        setData(res.data);
        setLastUpdated(new Date());
      } else {
        throw new Error('Failed to get forecast response.');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch forecast.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecastData();
    const interval = setInterval(fetchForecastData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="glass-panel p-12 rounded-3xl border border-slate-800 flex flex-col justify-center items-center space-y-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400"></div>
      <span className="text-xs font-mono text-slate-400 animate-pulse">FETCHING GLOBAL MARKETS & COMPUTING 100-POINT MATRIX...</span>
    </div>
  );

  if (error) return (
    <div className="glass-panel p-8 rounded-3xl border border-rose-500/20 bg-rose-950/10 text-center space-y-4">
      <span className="text-xl">⚠️</span>
      <h3 className="text-sm font-bold font-mono text-rose-400 uppercase">Forecast Engine Error</h3>
      <p className="text-xs text-slate-400">{error}</p>
      <button onClick={fetchForecastData} className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-mono text-slate-200">RETRY</button>
    </div>
  );

  if (!data) return null;

  const totalScore = CRITERIA.reduce((sum, c) => sum + (data[c.key] || 0), 0);
  const t = parseFloat(totalScore.toFixed(1));

  const isBullish = t >= 60;
  const isBearish = t <= 40;
  const isNeutral = !isBullish && !isBearish;

  const scoreColor = isBullish ? 'text-emerald-400' : isBearish ? 'text-rose-400' : 'text-amber-400';
  const borderColor = isBullish ? 'border-emerald-500/40' : isBearish ? 'border-rose-500/40' : 'border-amber-500/30';
  const bgColor = isBullish ? 'bg-emerald-950/10' : isBearish ? 'bg-rose-950/10' : 'bg-amber-950/10';

  const openingLabel = t >= 72 ? '🚀 GAP-UP OPENING' : t >= 60 ? '↗️ POSITIVE OPENING' : t <= 28 ? '📉 GAP-DOWN OPENING' : t <= 40 ? '↘️ NEGATIVE OPENING' : '➡️ FLAT OPENING';

  const recColor = data.recommendation?.startsWith('BUY CE') ? 'text-emerald-400' :
                   data.recommendation?.startsWith('BUY PE') ? 'text-rose-400' : 'text-amber-400';
  const recIcon  = data.recommendation?.startsWith('BUY CE') ? '🟢' :
                   data.recommendation?.startsWith('BUY PE') ? '🔴' : '🟡';

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className={`glass-panel p-8 rounded-3xl border ${borderColor} shadow-2xl`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-slate-500 tracking-widest uppercase">Multi-Factor Forecasting Model</span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded animate-pulse">LIVE API SYNCED</span>
            </div>
            <h2 className="text-2xl font-black font-mono text-slate-200">TOMORROW'S OPENING FORECAST</h2>
            <p className="text-xs text-slate-400 max-w-xl">13 global indicators scored across 100 points — US markets, Asian session, VIX, PCR, crude, gold, FX, and institutional flows.</p>
            <div className="flex items-center space-x-3 pt-1">
              <button onClick={fetchForecastData} className="px-3 py-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-md text-[10px] font-mono text-slate-300 transition">
                🔄 Refresh
              </button>
              {lastUpdated && <span className="text-[10px] font-mono text-slate-600">Updated: {lastUpdated.toLocaleTimeString()}</span>}
            </div>
          </div>

          <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-900 min-w-[240px] text-center shadow-inner">
            <span className="text-[10px] font-mono text-slate-500 block mb-1">PREDICTED OPENING</span>
            <span className={`text-lg font-black font-mono ${scoreColor}`}>{openingLabel}</span>
            <div className="mt-3 flex items-baseline justify-center space-x-1">
              <span className={`text-4xl font-black font-mono ${scoreColor}`}>{t}</span>
              <span className="text-xs font-mono text-slate-500">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation Card */}
      <div className={`glass-panel p-5 rounded-2xl border ${borderColor} ${bgColor} flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Tomorrow's Trade Recommendation</span>
          <div className={`text-xl font-black font-mono ${recColor}`}>{recIcon} {data.recommendation}</div>
          <p className="text-xs text-slate-400 max-w-2xl">{data.recReason}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] font-mono text-slate-500 block">SCORE</span>
          <span className={`text-3xl font-black font-mono ${scoreColor}`}>{t}<span className="text-sm text-slate-500">/100</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Criteria List */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest">Live Criteria Breakdown</h3>
            <span className="text-[10px] font-mono text-slate-600">13 indicators · 100 pts total</span>
          </div>

          {CRITERIA.map((c, idx) => {
            const score = data[c.key] || 0;
            const pct = (score / c.max) * 100;
            const barColor = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
            return (
              <div key={c.key} className="bg-slate-950/50 p-3 rounded-xl border border-slate-900">
                <div className="flex justify-between items-start mb-1.5">
                  <div>
                    <span className="text-[11px] font-mono text-slate-200 font-bold">{idx + 1}. {c.label}</span>
                    <span className="text-[10px] font-mono text-slate-500 ml-2">max {c.max} pts</span>
                  </div>
                  <span className={`text-sm font-black font-mono ${pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {score} <span className="text-slate-600 text-xs font-normal">/ {c.max}</span>
                  </span>
                </div>
                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden mb-1.5">
                  <div className={`${barColor} h-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                </div>
                <p className="text-[10px] text-slate-500">{c.desc(data)}</p>
              </div>
            );
          })}
        </div>

        {/* Scorecard + Signal Summary */}
        <div className="space-y-4">

          {/* Scorecard */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-3 mb-3">Scorecard Matrix</h3>
            <div className="space-y-2 font-mono text-xs">
              {CRITERIA.map(c => {
                const score = data[c.key] || 0;
                const pct = (score / c.max) * 100;
                return (
                  <div key={c.key} className="flex justify-between items-center border-b border-slate-900/60 pb-1.5">
                    <span className="text-slate-400 truncate pr-2">{c.label.split(' (')[0]}</span>
                    <span className={`font-bold shrink-0 ${pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {score} / {c.max}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 bg-slate-950 p-3 rounded-xl border border-slate-900 flex justify-between items-center">
              <span className="text-xs font-mono text-slate-500">TOTAL</span>
              <span className={`text-2xl font-black font-mono ${scoreColor}`}>{t} / 100</span>
            </div>
          </div>

          {/* Signal Zones */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-3 mb-1">Score Zones</h3>
            {[
              { range: '72 – 100', label: 'BUY CE at Open',         color: 'text-emerald-400', bg: 'bg-emerald-500/10', active: t >= 72 },
              { range: '60 – 71',  label: 'BUY CE after 9:20 confirm', color: 'text-emerald-300', bg: 'bg-emerald-500/5', active: t >= 60 && t < 72 },
              { range: '41 – 59',  label: 'NO TRADE — Wait & Watch', color: 'text-amber-400',   bg: 'bg-amber-500/10',  active: t > 40 && t < 60 },
              { range: '29 – 40',  label: 'BUY PE after 9:20 confirm', color: 'text-rose-300',   bg: 'bg-rose-500/5',    active: t > 28 && t <= 40 },
              { range: '0 – 28',   label: 'BUY PE at Open',          color: 'text-rose-400',    bg: 'bg-rose-500/10',   active: t <= 28 },
            ].map(z => (
              <div key={z.range} className={`flex justify-between items-center p-2 rounded-lg text-[10px] font-mono ${z.active ? z.bg + ' border border-current/20' : ''}`}>
                <span className={z.active ? z.color : 'text-slate-600'}>{z.range}</span>
                <span className={z.active ? z.color + ' font-bold' : 'text-slate-600'}>{z.label}</span>
                {z.active && <span className="text-[8px] bg-current/20 px-1 rounded">◀ NOW</span>}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
