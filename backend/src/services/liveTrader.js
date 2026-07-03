import mongoose from 'mongoose';
import TradeModel from '../models/Trade.js';
import angelOneService from './angelone.js';

class LiveTrader {
  constructor() {
    this.history = [];
    this.mongoLoaded = false;
  }

  async ensureLoaded() {
    if (mongoose.connection.readyState === 1 && !this.mongoLoaded) {
      try {
        console.log("LiveTrader: Fetching live trade history from MongoDB...");
        const closedDocs = await TradeModel.find({ isLive: true, exitTime: { $exists: true } });
        this.history = closedDocs.map(doc => {
          const obj = doc.toObject();
          obj.id = doc._id.toString();
          return obj;
        });
        this.mongoLoaded = true;
        console.log(`LiveTrader: MongoDB Sync successful. Live History: ${this.history.length}`);
      } catch (error) {
        console.error("LiveTrader: MongoDB state query failed:", error);
      }
    }
  }

  // Record a live trade buy entry in DB
  async recordEntry({ symbol, strike, quantity, entryPrice, optionType, slPoints, targetPoints, isAutoSignal, entryCriteria }) {
    await this.ensureLoaded();

    const sl = slPoints || 15;
    const target = targetPoints || 30;
    const stopLossPrice = parseFloat((entryPrice - sl).toFixed(2));
    const targetPrice = parseFloat((entryPrice + target).toFixed(2));

    const newPosition = {
      symbol,
      type: 'BUY',
      optionType,
      strike: parseInt(strike),
      quantity: parseInt(quantity),
      entryPrice: parseFloat(entryPrice),
      ltp: parseFloat(entryPrice),
      unrealizedPnl: 0,
      stopLoss: stopLossPrice,
      target: targetPrice,
      slPoints: sl,
      targetPoints: target,
      entryTime: new Date(),
      isAutoSignal: !!isAutoSignal,
      entryCriteria,
      isLive: true
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await TradeModel.create(newPosition);
        newPosition.id = doc._id.toString();
        console.log(`LiveTrader: Saved live trade entry to DB: ${symbol} at ₹${entryPrice}`);
      } catch (error) {
        console.error("LiveTrader: MongoDB order write failed:", error);
      }
    }
    return newPosition;
  }

  // Record a live trade close/exit in DB
  async recordExit(symbol, exitPrice, reason = "MANUAL EXIT") {
    await this.ensureLoaded();

    try {
      // Find the most recent active live trade for this symbol in DB
      const activeTrade = await TradeModel.findOne({ symbol, isLive: true, exitTime: { $exists: false } }).sort({ entryTime: -1 });
      if (!activeTrade) {
        console.warn(`LiveTrader: No active trade found to exit for symbol: ${symbol}`);
        return null;
      }

      const pnl = parseFloat(((exitPrice - activeTrade.entryPrice) * activeTrade.quantity).toFixed(2));
      
      activeTrade.exitPrice = parseFloat(exitPrice.toFixed(2));
      activeTrade.exitTime = new Date();
      activeTrade.pnl = pnl;
      activeTrade.reason = reason;

      await activeTrade.save();
      console.log(`LiveTrader: Saved live trade exit to DB: ${symbol} exited at ₹${exitPrice} (P&L: ₹${pnl})`);

      const obj = activeTrade.toObject();
      obj.id = activeTrade._id.toString();
      this.history.push(obj);

      return obj;
    } catch (error) {
      console.error(`LiveTrader: Failed to record live trade exit:`, error);
      return null;
    }
  }

  async getAccountState() {
    await this.ensureLoaded();

    const totalTrades = this.history.length;
    const winningTrades = this.history.filter(t => t.pnl > 0).length;
    const winRatio = totalTrades > 0 ? parseFloat(((winningTrades / totalTrades) * 100).toFixed(2)) : 0;
    const realizedPnlToday = this.history.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return {
      history: this.history,
      metrics: {
        totalTrades,
        winningTrades,
        losingTrades: totalTrades - winningTrades,
        winRatio
      },
      risk: {
        realizedPnlToday
      }
    };
  }
}

export default new LiveTrader();
