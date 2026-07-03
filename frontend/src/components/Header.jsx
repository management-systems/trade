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
          <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 p-2.5 rounded-xl shadow-md">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-200" style={{color: 'inherit'}}>
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">ANTIGRAVITY</span>
              <span className="text-slate-300" style={{color:'inherit'}}> TRADE</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">NIFTY 50 Options Lab</p>
          </div>
        </div>

        {/* Server & API Connection States */}
        <div className="flex items-center space-x-3">
          {/* Socket Connection */}
          <div className="flex items-center px-3 py-1.5 rounded-full border font-mono text-xs"
            style={{background: 'rgba(0,0,0,0.04)', borderColor: '#c8d3e2'}}>
            <span className={`h-2 w-2 rounded-full mr-2 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
            <span className="text-slate-400 font-semibold">{isConnected ? 'LIVE FEED' : 'OFFLINE'}</span>
          </div>

          {/* Theme Mode Switcher */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-lg border transition duration-200 hover:scale-105"
            style={{background:'rgba(0,0,0,0.04)', borderColor:'#c8d3e2'}}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-500" />
            ) : (
              <Moon className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {/* Live Funds when connected */}
          {liveModeActive && apiStatus.connected && apiStatus.funds && (
            <div className="flex items-center px-4 py-1.5 rounded-full font-mono text-sm font-bold"
              style={{background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.25)', color:'#7c3aed'}}>
              <span className="opacity-70 mr-1.5">Funds:</span>
              <span>₹{apiStatus.funds.availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Paper Wallet Balance */}
          {!liveModeActive && (
            <div className="flex items-center px-4 py-1.5 rounded-full font-mono text-sm font-bold"
              style={{background:'rgba(5,150,105,0.08)', border:'1px solid rgba(5,150,105,0.25)', color:'#059669'}}>
              <span className="opacity-70 mr-1.5">Paper:</span>
              <span>₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Angel One Connection Indicator */}
          {apiStatus.connected && (
            <div className="flex items-center px-3 py-1.5 rounded-full border font-mono text-xs"
              style={{background:'rgba(5,150,105,0.06)', borderColor:'rgba(5,150,105,0.25)'}}>
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mr-1.5" />
              <span className="text-slate-400 font-semibold">{apiStatus.clientCode}</span>
            </div>
          )}

          {/* Mode Switcher Segmented Control */}
          <div className="flex p-1 rounded-xl border font-mono text-xs select-none"
            style={{background:'rgba(0,0,0,0.05)', borderColor:'#c8d3e2'}}>
            <button
              onClick={() => { if (liveModeActive) setLiveModeActive(false); }}
              className={`px-4 py-1.5 rounded-lg font-bold transition duration-200 ${
                !liveModeActive 
                  ? 'bg-emerald-500 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              PAPER
            </button>
            <button
              onClick={toggleLiveMode}
              className={`px-4 py-1.5 rounded-lg font-bold transition duration-200 flex items-center ${
                liveModeActive 
                  ? 'bg-rose-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-rose-600'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${liveModeActive ? 'bg-white animate-ping' : 'bg-rose-400'}`}></span>
              LIVE
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
