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
  isAutoSignal: { type: Boolean, default: false },
  entryCriteria: { type: mongoose.Schema.Types.Mixed }
});

export default mongoose.model('Trade', TradeSchema);
