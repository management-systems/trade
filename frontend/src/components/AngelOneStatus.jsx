import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function AngelOneStatus() {
  const [status, setStatus] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await api.checkAngelOneStatus();
        setStatus({ loading: false, data: res, error: null });
      } catch (e) {
        setStatus({ loading: false, data: null, error: e.message });
      }
    }
    fetchStatus();
  }, []);

  if (status.loading) return <div className="text-slate-400">Loading Angel One status...</div>;
  if (status.error) return <div className="text-red-500">Error: {status.error}</div>;

  const { clientCode, clientName, connected, wsStatus, funds } = status.data || {};

  // Use `connected` from backend; fallback to false if undefined
  const isConnected = connected ?? false;

  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-2">
      <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1 mb-2">
        Angel One Profile
      </h3>
      <p className="text-sm text-slate-300"><strong>Client Code:</strong> {clientCode || '—'}</p>
      <p className="text-sm text-slate-300"><strong>Client Name:</strong> {clientName || '—'}</p>
      <p className="text-sm text-slate-300"><strong>Status:</strong> {isConnected ? 'CONNECTED' : 'DISCONNECTED'}</p>
      <p className="text-sm text-slate-300"><strong>Websocket Feed:</strong> {wsStatus || '—'}</p>
      {funds && (
        <div className="mt-2">
          <p className="text-sm text-slate-300"><strong>Available Margin:</strong> {funds.availableMargin ?? '—'}</p>
          <p className="text-sm text-slate-300"><strong>Collateral:</strong> {funds.collateral ?? '—'}</p>
          <p className="text-sm text-slate-300"><strong>Utilised:</strong> {funds.utilised ?? '—'}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-2">
      <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1 mb-2">Angel One Profile</h3>
      <p className="text-sm text-slate-300"><strong>Client Code:</strong> {clientCode || '—'}</p>
      <p className="text-sm text-slate-300"><strong>Client Name:</strong> {clientName || '—'}</p>
      <p className="text-sm text-slate-300"><strong>Status:</strong> {isConnected ? 'CONNECTED' : 'DISCONNECTED'}</p>
      <p className="text-sm text-slate-300"><strong>Websocket Feed:</strong> {wsStatus || '—'}</p>
    </div>
  );
}
