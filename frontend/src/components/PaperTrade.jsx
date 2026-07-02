import React, { useState, useEffect } from 'react';
import { ShoppingCart, LogOut, CheckCircle, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';

export default function PaperTrade({ 
  paperState, 
  optionChain, 
  selectedPreFill, 
  onClosePreFill, 
  onRefresh,
  liveModeActive
}) {
  const { positions = [], risk = {} } = paperState || {};

  // Form State
  const [formData, setFormData] = useState({
    optionType: 'CE',
    strike: '',
    quantity: '25', // 1 lot default
    slPoints: '15',
    targetPoints: '30',
    entryPrice: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handle selected pre-fills from clicking Option Chain cart icon
  useEffect(() => {
    if (selectedPreFill) {
      setFormData({
        optionType: selectedPreFill.optionType,
        strike: selectedPreFill.strike.toString(),
        quantity: '25',
        slPoints: '15',
        targetPoints: '30',
        entryPrice: selectedPreFill.ltp.toString()
      });
    }
  }, [selectedPreFill]);

  // Dynamically update the entry price if selected contract LTP moves
  useEffect(() => {
    if (!formData.strike || optionChain.length === 0) return;
    const match = optionChain.find(item => item.strike.toString() === formData.strike);
    if (match) {
      const currentPrice = formData.optionType === 'CE' ? match.ce.ltp : match.pe.ltp;
      setFormData(prev => ({
        ...prev,
        entryPrice: currentPrice.toString()
      }));
    }
  }, [optionChain, formData.strike, formData.optionType]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // PIN Verification for any manual buy
    const pin = prompt("Enter your 4-digit security PIN to authorize this trade:");
    if (pin === null) return; // User clicked Cancel
    if (pin.trim() !== '1232') {
      setError('Incorrect security PIN. Trade authorization aborted.');
      return;
    }

    const strikeNum = parseInt(formData.strike);
    const qtyNum = parseInt(formData.quantity);
    const priceNum = parseFloat(formData.entryPrice);
    const slNum = parseFloat(formData.slPoints);
    const tgtNum = parseFloat(formData.targetPoints);

    if (!strikeNum || isNaN(strikeNum)) {
      setError('Please select a valid Strike price.');
      return;
    }
    if (qtyNum <= 0 || qtyNum % 25 !== 0) {
      setError('Quantity must be a positive multiple of 25 (Nifty lot size).');
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('LTP must be a valid positive number.');
      return;
    }

    try {
      // Formulate contract symbol
      const symbol = `NIFTY26JUL${strikeNum}${formData.optionType}`;

      if (liveModeActive) {
        // In real live mode, order places through actual Angel One API
        const result = await api.placeLiveOrder({
          symbol,
          strike: strikeNum,
          quantity: qtyNum,
          transactionType: 'BUY',
          optionType: formData.optionType
        });
        setSuccess(`Live order placed! Trans ID: ${result.result?.data?.orderid || result.result?.orderid || 'Success'}`);
      } else {
        // Paper Order
        await api.placePaperOrder({
          symbol,
          type: 'BUY',
          optionType: formData.optionType,
          strike: strikeNum,
          entryPrice: priceNum,
          quantity: qtyNum,
          slPoints: slNum,
          targetPoints: tgtNum,
          isAutoSignal: false
        });
        setSuccess('Order filled! Position created.');
      }
      
      onClosePreFill();
      onRefresh();

      // Clear success alert after 3s
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Order execution failed.');
    }
  };

  const handleExitPosition = async (id, currentLtp) => {
    try {
      await api.closePaperPosition(id, currentLtp, "MANUAL EXIT");
      onRefresh();
    } catch (err) {
      alert(`Failed to exit position: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* 1. Active Positions List (Takes 2 columns on wide screens) */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 xl:col-span-2 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 mb-3">
            Active Positions ({positions.length})
          </h3>
          
          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-900 uppercase text-[9px] pb-1">
                    <th className="py-2">Instrument</th>
                    <th className="py-2">Qty</th>
                    <th className="py-2">Avg Price</th>
                    <th className="py-2">LTP</th>
                    <th className="py-2">SL / Tgt</th>
                    <th className="py-2 text-right">P&L</th>
                    <th className="py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/40 text-slate-300">
                  {positions.map((pos) => {
                    const pnl = pos.unrealizedPnl;
                    const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-rose-500';
                    return (
                      <tr key={pos.id} className="hover:bg-slate-900/10">
                        <td className="py-3 font-semibold text-slate-200">
                          {pos.symbol}
                          {pos.isAutoSignal && (
                            <span className="ml-1 text-[8px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-1 rounded">AUTO</span>
                          )}
                        </td>
                        <td className="py-3">{pos.quantity}</td>
                        <td className="py-3">₹{pos.entryPrice.toFixed(2)}</td>
                        <td className="py-3 font-bold text-slate-100">₹{pos.ltp.toFixed(2)}</td>
                        <td className="py-3 text-slate-400">
                          ₹{pos.stopLoss.toFixed(1)} / ₹{pos.target.toFixed(1)}
                        </td>
                        <td className={`py-3 text-right font-extrabold ${pnlColor}`}>
                          ₹{pnl >= 0 ? '+' : ''}{pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => handleExitPosition(pos.id, pos.ltp)}
                            className="bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-slate-950 px-2 py-0.5 rounded border border-rose-500/25 transition text-[9px] font-bold"
                          >
                            EXIT
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <ShieldAlert className="h-8 w-8 mb-2 opacity-55" />
              <p className="text-xs font-mono">No active trading positions.</p>
            </div>
          )}
        </div>

        {/* Unrealized summary */}
        {positions.length > 0 && (
          <div className="border-t border-slate-900 pt-3 mt-4 flex items-center justify-between font-mono">
            <span className="text-xs text-slate-400">Total Floating Unrealized P&L:</span>
            <span className={`text-sm font-extrabold ${
              positions.reduce((sum, p) => sum + p.unrealizedPnl, 0) >= 0 ? 'text-emerald-400' : 'text-rose-500'
            }`}>
              ₹{positions.reduce((sum, p) => sum + p.unrealizedPnl, 0) >= 0 ? '+' : ''}
              {positions.reduce((sum, p) => sum + p.unrealizedPnl, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {/* 2. Manual Order Entry Form */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 mb-3">
          Manual Trade Panel
        </h3>

        <form onSubmit={handlePlaceOrder} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono text-slate-500 mb-1">OPTION TYPE</label>
              <select
                name="optionType"
                value={formData.optionType}
                onChange={handleInputChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-200 focus:outline-none"
              >
                <option value="CE">CALL (CE)</option>
                <option value="PE">PUT (PE)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-mono text-slate-500 mb-1">STRIKE PRICE</label>
              <select
                name="strike"
                value={formData.strike}
                onChange={handleInputChange}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-200 focus:outline-none"
              >
                <option value="">Select Strike</option>
                {optionChain.map(row => (
                  <option key={row.strike} value={row.strike}>{row.strike}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono text-slate-500 mb-1">QUANTITY (SHARES)</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                step="25"
                min="25"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-200 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-mono text-slate-500 mb-1">LTP PREMIUM (₹)</label>
              <input
                type="text"
                name="entryPrice"
                value={formData.entryPrice}
                onChange={handleInputChange}
                readOnly
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-500 select-all focus:outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono text-slate-500 mb-1">STOP LOSS (POINTS)</label>
              <input
                type="number"
                name="slPoints"
                value={formData.slPoints}
                onChange={handleInputChange}
                min="1"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-200 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-mono text-slate-500 mb-1">TARGET (POINTS)</label>
              <input
                type="number"
                name="targetPoints"
                value={formData.targetPoints}
                onChange={handleInputChange}
                min="1"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-2 bg-rose-950/20 border border-rose-900/30 rounded-lg text-rose-400 font-mono text-[10px]">
              {error}
            </div>
          )}

          {success && (
            <div className="p-2 bg-emerald-950/20 border border-emerald-900/30 rounded-lg text-emerald-400 font-mono text-[10px]">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={risk.limitHit}
            className={`w-full flex items-center justify-center py-2 rounded-lg font-bold transition ${
              risk.limitHit 
                ? 'bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800' 
                : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950'
            }`}
          >
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            {liveModeActive ? 'Place Live Order' : 'Buy Option'}
          </button>
        </form>
      </div>
    </div>
  );
}
