import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function PnLChart({ history }) {
  // Construct cumulative P&L data series
  const dataPoints = [0];
  let currentTotal = 0;
  
  history.forEach(trade => {
    currentTotal += trade.pnl;
    dataPoints.push(currentTotal);
  });

  const labels = ['Start', ...history.map((_, i) => `Trade ${i + 1}`)];
  const isNetPositive = currentTotal >= 0;

  const data = {
    labels,
    datasets: [
      {
        label: 'Cumulative P&L (₹)',
        data: dataPoints,
        borderColor: isNetPositive ? '#10b981' : '#ef4444',
        borderWidth: 2,
        pointBackgroundColor: isNetPositive ? '#34d399' : '#f87171',
        pointHoverRadius: 6,
        tension: 0.2,
        fill: true,
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 150);
          gradient.addColorStop(0, isNetPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)');
          gradient.addColorStop(1, 'rgba(11, 15, 25, 0)');
          return gradient;
        },
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleFont: { family: 'Inter', size: 10 },
        bodyFont: { family: 'JetBrains Mono', size: 11 },
        borderColor: '#1e293b',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const val = context.parsed.y;
            return `P&L: ₹${val >= 0 ? '+' : ''}${val.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: '#1e293b',
          borderColor: '#1e293b',
          drawOnChartArea: false,
        },
        ticks: {
          color: '#64748b',
          font: { family: 'Inter', size: 9 },
        },
      },
      y: {
        grid: {
          color: '#1e293b',
          borderColor: '#1e293b',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: { family: 'Inter', size: 9 },
          callback: (value) => `₹${value}`,
        },
      },
    },
  };

  return (
    <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col justify-between h-[230px]">
      <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 mb-2 flex items-center">
        <TrendingUp className="h-4 w-4 text-emerald-400 mr-1.5" />
        Equity Performance Curve
      </h3>
      
      <div className="flex-1 relative w-full h-[160px]">
        {history.length > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 font-mono text-xs">
            Awaiting completed trades to render performance graph.
          </div>
        )}
      </div>
    </div>
  );
}
