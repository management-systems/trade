import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Sun, Moon } from 'lucide-react';

export default function Header({ 
  isConnected, 
  liveModeActive, 
  setLiveModeActive,
  apiStatus, 
  balance, 
  onRefreshState 
}) {
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyText, setSafetyText] = useState('');
  
  // Theme switcher state — light is default, dark is opt-in
  const [isDark, setIsDark] = useState(document.body.classList.contains('dark-mode'));

  const toggleTheme = () => {
    if (document.body.classList.contains('dark-mode')) {
      document.body.classList.remove('dark-mode');
      setIsDark(false);
    } else {
      document.body.classList.add('dark-mode');
      setIsDark(true);
    }
  };
  
  const toggleLiveMode = () => {
    if (!liveModeActive) {
      setShowSafetyModal(true);
    } else {
      setLiveModeActive(false);
    }
  };

  const confirmLiveMode = () => {
    if (safetyText.trim() === '999266') {
      setLiveModeActive(true);
      setShowSafetyModal(false);
      setSafetyText('');
      onRefreshState();
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
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-500" />
            )}
          </button>


          {/* Live Funds when connected */}
          {liveModeActive && apiStatus.connected && apiStatus.funds && (
            <div className="flex items-center bg-purple-950/20 px-4 py-1.5 rounded-full border border-purple-500/20 font-mono text-sm font-semibold mr-2">
              <span className="text-purple-400 mr-1.5">Live Funds:</span>
              <span className="text-purple-300">₹{apiStatus.funds.availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          {/* Paper Wallet Balance */}
          {!liveModeActive && (
            <div className="flex items-center bg-emerald-950/20 px-4 py-1.5 rounded-full border border-emerald-500/20 font-mono text-sm font-semibold">
              <span className="text-emerald-400 mr-1.5">Paper Wallet:</span>
              <span className="text-emerald-300">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
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

      {/* SAFETY CONFIRMATION MODAL FOR LIVE MODE */}
      {showSafetyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-rose-900/30 shadow-2xl">
            <div className="flex items-center text-rose-500 space-x-2 pb-4 border-b border-slate-800 mb-4">
              <AlertTriangle className="h-6 w-6 animate-bounce" />
              <h3 className="text-lg font-bold">ACTIVATE LIVE MODE</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Enter your <strong className="text-rose-400">6-digit security PIN</strong> to enable Live Trading Mode.
              </p>

              <div>
                <input 
                  type="password" 
                  maxLength="6"
                  value={safetyText} 
                  onChange={(e) => {
                    setSafetyText(e.target.value);
                    if (e.target.value.length === 6) {
                      if (e.target.value === '999266') {
                        setLiveModeActive(true);
                        setShowSafetyModal(false);
                        setSafetyText('');
                        onRefreshState();
                      } else {
                        alert("Incorrect PIN. Access denied.");
                        setSafetyText('');
                      }
                    }
                  }}
                  placeholder="••••••"
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-lg text-slate-200 font-mono tracking-widest text-center focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              <button
                onClick={() => { setShowSafetyModal(false); setSafetyText(''); }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-sm font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
