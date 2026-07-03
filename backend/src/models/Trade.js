import mongoose from 'mongoose';

const TradeSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  type: { type: String, default: 'BUY' },
  optionType: { type: String, enum: ['CE', 'PE'], required: true },
  strike: { type: Number, required: true },
  quantity: { type: Number, required: true },
  entryPrice: { type: Number, required: true },
  ltp: { type: Number },
  unrealizedPnl: { type: Number },
  stopLoss: { type: Number },
  target: { type: Number },
  slPoints: { type: Number },
  targetPoints: { type: Number },
  entryTime: { type: Date, default: Date.now },
  exitTime: { type: Date },
  pnl: { type: Number },
  reason: { type: String },
  lots: { type: Number, default: 1 },
  stopLossPct: { type: Number },
  profitPct: { type: Number },
  isAutoTrade: { type: Boolean, default: false },
  isAutoSignal: { type: Boolean, default: false },
  isLive: { type: Boolean, default: false },
});

export default mongoose.model('Trade', TradeSchema);
