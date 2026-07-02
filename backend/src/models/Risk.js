import mongoose from 'mongoose';

const RiskSchema = new mongoose.Schema({
  // Date in YYYY-MM-DD format as unique key
  date: { type: String, required: true, unique: true },
  maxTradesPerDay: { type: Number, required: true },
  maxLossPerDay: { type: Number, required: true },
  tradesTakenToday: { type: Number, default: 0 },
  realizedPnlToday: { type: Number, default: 0 }
});

export default mongoose.model('Risk', RiskSchema);
