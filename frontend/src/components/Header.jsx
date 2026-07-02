import React, { useState } from 'react';
import { Shield, Key, AlertTriangle, Cloud, CloudOff, LogOut, CheckCircle, Sun, Moon } from 'lucide-react';
import { api } from '../services/api';

export default function Header({ 
  isConnected, 
  liveModeActive, 
  setLiveModeActive,
  apiStatus, 
  setApiStatus, 
  balance, 
  onRefreshState 
}) {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyText, setSafetyText] = useState('');
  
  // Theme switcher state
  const [isLightMode, setIsLightMode] = useState(document.body.classList.contains('light-mode'));

  const toggleTheme = () => {
    if (document.body.classList.contains('light-mode')) {
      document.body.classList.remove('light-mode');
      setIsLightMode(false);
    } else {
      document.body.classList.add('light-mode');
      setIsLightMode(true);
    }
  };
  
  // Credentials form state
  const [credentials, setCredentials] = useState({
    clientCode: '',
    password: '',
    apiKey: '',
    totpSecret: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleInputChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.loginAngelOne(credentials);
      if (res.success) {
        setApiStatus({
          connected: true,
          clientCode: res.clientCode,
          clientName: res.clientName
        });
        setShowConfigModal(false);
        // Refresh paper trading and global states
        onRefreshState();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Verify credentials and TOTP Secret.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logoutAngelOne();
      setApiStatus({ connected: false, clientCode: null, clientName: null });
      setLiveModeActive(false);
      onRefreshState();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const toggleLiveMode = () => {
    if (!liveModeActive) {
      if (!apiStatus.connected) {
        alert("You must log in to Angel One first before enabling Live Mode.");
        return;
      }
      setShowSafetyModal(true);
    } else {
      setLiveModeActive(false);
    }
  };

  const confirmLiveMode = () => {
    if (safetyText.trim() === '1232') {
      setLiveModeActive(true);
      setShowSafetyModal(false);
      setSafetyText('');
    } else {
      alert("Incorrect PIN. Access to Live Mode denied.");
    }
  };

  return (
    <>
      <header className="glass-panel sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-slate-800">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-tr from-emerald-500 to-teal-400 p-2.5 rounded-xl shadow-lg shadow-emerald-900/20">
            <Shield className="h-6 w-6 text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              ANTIGRAVITY TRADE
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">NIFTY 50 Options Lab</p>
          </div>
        </div>

        {/* Server & API Connection States */}
        <div className="flex items-center space-x-4">
          {/* Socket Connection */}
          <div className="flex items-center bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800 font-mono text-xs">
            <span className={`h-2.5 w-2.5 rounded-full mr-2 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className="text-slate-300">{isConnected ? 'FEED CONNECTED' : 'FEED OFFLINE'}</span>
          </div>

          {/* Theme Mode Switcher */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition duration-200"
            title="Toggle Light/Dark Theme"
          >
            {isLightMode ? (
              <Moon className="h-4 w-4 text-amber-500" />
            ) : (
              <Sun className="h-4 w-4 text-emerald-400" />
            )}
          </button>

          {/* Active Balance Display based on Mode */}
          {!liveModeActive ? (
            <div className="flex items-center bg-emerald-950/20 px-4 py-1.5 rounded-full border border-emerald-500/20 font-mono text-sm font-semibold">
              <span className="text-emerald-400 mr-1.5">Paper Wallet:</span>
              <span className="text-emerald-300">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ) : (
            apiStatus.connected && apiStatus.funds && (
              <div className="flex items-center bg-orange-950/20 px-4 py-1.5 rounded-full border border-orange-500/20 font-mono text-sm font-semibold animate-pulse">
                <span className="text-orange-400 mr-1.5">Live Funds:</span>
                <span className="text-orange-300">₹{apiStatus.funds.availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )
          )}

          {/* Angel One Connection Indicator */}
          {apiStatus.connected && (
            <div className="flex items-center bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800 text-xs">
              <CheckCircle className="h-4 w-4 text-emerald-400 mr-2" />
              <span className="text-slate-300 font-mono">{apiStatus.clientCode} ({apiStatus.clientName})</span>
            </div>
          )}

          {/* Mode Switcher Segmented Control */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 font-mono text-xs select-none">
            <button
              onClick={() => { if (liveModeActive) setLiveModeActive(false); }}
              className={`px-4 py-1.5 rounded-lg font-bold transition duration-200 ${
                !liveModeActive 
                  ? 'bg-emerald-500 text-slate-950 shadow font-extrabold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PAPER TRADING
            </button>
            <button
              onClick={toggleLiveMode}
              className={`px-4 py-1.5 rounded-lg font-bold transition duration-200 flex items-center ${
                liveModeActive 
                  ? 'bg-rose-600 text-white shadow font-extrabold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${liveModeActive ? 'bg-white animate-ping' : 'bg-rose-500'}`}></span>
              ANGEL LIVE
            </button>
          </div>
        </div>
      </header>

      {/* ANGEL ONE CREDENTIALS CONFIGURATION MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-800 shadow-2xl animate-soft-pulse">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-slate-200 flex items-center">
                <Shield className="h-5 w-5 text-emerald-400 mr-2" />
                Angel One SmartAPI Login
              </h3>
              <button 
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">CLIENT CODE</label>
                <input 
                  type="text" 
                  name="clientCode"
                  value={credentials.clientCode} 
                  onChange={handleInputChange} 
                  required
                  placeholder="e.g. S123456"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">PIN / PASSWORD</label>
                <input 
                  type="password" 
                  name="password"
                  value={credentials.password} 
                  onChange={handleInputChange} 
                  required
                  placeholder="Your 4-digit PIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">API KEY</label>
                <input 
                  type="text" 
                  name="apiKey"
                  value={credentials.apiKey} 
                  onChange={handleInputChange} 
                  required
                  placeholder="SmartAPI Key"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">TOTP SECRET KEY (16-CHAR)</label>
                <input 
                  type="text" 
                  name="totpSecret"
                  value={credentials.totpSecret} 
                  onChange={handleInputChange} 
                  required
                  placeholder="QR TOTP secret (for auto OTP codes)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition font-mono"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-950/20 border border-rose-800/40 rounded-xl text-xs text-rose-400 font-mono">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-900 py-2.5 rounded-xl text-sm font-semibold transition"
              >
                {loading ? 'Authenticating...' : 'Connect SmartAPI'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SAFETY CONFIRMATION MODAL FOR LIVE MODE */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-rose-900/30 shadow-2xl">
            <div className="flex items-center text-rose-500 space-x-2 pb-4 border-b border-slate-800 mb-4">
              <AlertTriangle className="h-6 w-6 animate-bounce" />
              <h3 className="text-lg font-bold">SAFETY WARNING</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                You are about to enable <strong className="text-rose-400">LIVE TRADING MODE</strong>. 
                Any signals executed hereafter will place <strong className="text-rose-400">REAL MONEY ORDERS</strong> in your connected Angel One account.
              </p>
              
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-400">
                - Live fund balances and real-market quotes will be active.<br />
                - Live order placement functionality is locked for account safety.<br />
                - To place paper trades, toggle back to Paper Trading.
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5">
                  Enter your 4-digit trading PIN to enable Live Mode:
                </label>
                <input 
                  type="password" 
                  maxLength="4"
                  value={safetyText} 
                  onChange={(e) => setSafetyText(e.target.value)} 
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 font-mono tracking-widest text-center focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => { setShowSafetyModal(false); setSafetyText(''); }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLiveMode}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded-xl text-sm font-semibold transition"
                >
                  Activate Live Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
