import fs from 'fs';
import mongoose from 'mongoose';
import { config } from '../config.js';
import riskManager from './riskManager.js';
import TradeModel from '../models/Trade.js';

class PaperTrader {
  constructor() {
    this.balance = config.STARTING_BALANCE;
    this.positions = [];
    this.history = [];
    this.mongoLoaded = false;
    
    this.loadStateLocal();
  }

  loadStateLocal() {
    try {
      if (fs.existsSync(config.DB_PATH)) {
        const data = JSON.parse(fs.readFileSync(config.DB_PATH, 'utf8'));
        this.balance = data.balance ?? config.STARTING_BALANCE;
        this.positions = data.positions ?? [];
        this.history = data.history ?? [];
        console.log(`PaperTrader: Local state loaded. Balance: ₹${this.balance}`);
      } else {
        this.saveStateLocal();
      }
    } catch (error) {
      console.error("PaperTrader: Error loading local state:", error);
    }
  }

  async ensureLoaded() {
    // If MongoDB is connected and we haven't synchronized yet
    if (mongoose.connection.readyState === 1 && !this.mongoLoaded) {
      try {
        console.log("PaperTrader: Synchronizing state with MongoDB...");
        const activeDocs = await TradeModel.find({ exitTime: { $exists: false } });
        const closedDocs = await TradeModel.find({ exitTime: { $exists: true } });

        this.positions = activeDocs.map(doc => {
          const obj = doc.toObject();
          obj.id = doc._id.toString(); // Map Mongo ID to standard id
          return obj;
        });

        this.history = closedDocs.map(doc => {
          const obj = doc.toObject();
          obj.id = doc._id.toString();
          return obj;
        });

        // Sync local balance from database if possible (or keep in local DB config)
        // Here we default to maintaining balance local/synced.
        this.mongoLoaded = true;
        console.log(`PaperTrader: MongoDB Sync successful. Positions: ${this.positions.length}, History: ${this.history.length}`);
      } catch (error) {
        console.error("PaperTrader: MongoDB state query failed, using local files:", error);
      }
    }
  }

  async saveStateLocal() {
    try {
      let dbData = {};
      if (fs.existsSync(config.DB_PATH)) {
        dbData = JSON.parse(fs.readFileSync(config.DB_PATH, 'utf8'));
      }
      
      dbData.balance = this.balance;
      dbData.positions = this.positions;
      dbData.history = this.history;

      fs.writeFileSync(config.DB_PATH, JSON.stringify(dbData, null, 2), 'utf8');
    } catch (error) {
      console.error("PaperTrader: Local JSON save failed:", error);
    }
  }

  async getAccountState() {
    await this.ensureLoaded();
    const totalUnrealizedPnl = this.positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
    const equity = this.balance + totalUnrealizedPnl;
    
    const totalTrades = this.history.length;
    const winningTrades = this.history.filter(t => t.pnl > 0).length;
    const winRatio = totalTrades > 0 ? parseFloat(((winningTrades / totalTrades) * 100).toFixed(2)) : 0;
    
    const riskState = await riskManager.getRiskState(totalUnrealizedPnl);

    return {
      balance: parseFloat(this.balance.toFixed(2)),
      equity: parseFloat(equity.toFixed(2)),
      unrealizedPnl: parseFloat(totalUnrealizedPnl.toFixed(2)),
      positions: this.positions,
      history: this.history,
      metrics: {
        totalTrades,
        winningTrades,
        losingTrades: totalTrades - winningTrades,
        winRatio
      },
      risk: riskState
    };
  }

  async placeOrder({ symbol, type, optionType, strike, entryPrice, quantity, slPoints, targetPoints, isAutoSignal = false, entryCriteria }) {
    await this.ensureLoaded();

    // 1. Check daily risk boundaries
    const riskCheck = await riskManager.canPlaceTrade();
    if (!riskCheck.allowed) {
      throw new Error(riskCheck.reason);
    }

    const premiumRequired = entryPrice * quantity;
    if (this.balance < premiumRequired) {
      throw new Error(`Insufficient funds. Required margin: ₹${premiumRequired.toFixed(2)}, Available: ₹${this.balance.toFixed(2)}`);
    }

    // 2. Register trade count in Risk Manager
    await riskManager.registerTradeTaken();

    const sl = slPoints || config.DEFAULT_SL_POINTS;
    const target = targetPoints || config.DEFAULT_TARGET_POINTS;

    const stopLossPrice = parseFloat((entryPrice - sl).toFixed(2));
    const targetPrice = parseFloat((entryPrice + target).toFixed(2));

    const tempId = `pos_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const newPosition = {
      symbol,
      type,
      optionType,
      strike,
      quantity,
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      ltp: parseFloat(entryPrice.toFixed(2)),
      unrealizedPnl: 0,
      stopLoss: stopLossPrice,
      target: targetPrice,
      slPoints: sl,
      targetPoints: target,
      entryTime: new Date(),
      isAutoSignal,
      entryCriteria
    };

    // Deduct margin from balance
    this.balance -= premiumRequired;

    // 3. Save to database if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const doc = await TradeModel.create(newPosition);
        newPosition.id = doc._id.toString();
      } catch (error) {
        console.error("PaperTrader: MongoDB order write failed:", error);
        newPosition.id = tempId;
      }
    } else {
      newPosition.id = tempId;
    }

    this.positions.push(newPosition);
    await this.saveStateLocal();
    
    console.log(`PaperTrader: Order placed. Symbol: ${symbol}, Qty: ${quantity}, Entry: ${entryPrice}`);
    return newPosition;
  }

  async closePosition(positionId, exitPrice, reason = "MANUAL EXIT") {
    await this.ensureLoaded();
    
    const idx = this.positions.findIndex(p => p.id === positionId);
    if (idx === -1) {
      throw new Error("Position not found.");
    }

    const pos = this.positions[idx];
    const pnl = parseFloat(((exitPrice - pos.entryPrice) * pos.quantity).toFixed(2));
    const returnedCapital = pos.entryPrice * pos.quantity + pnl;

    this.balance += returnedCapital;

    const closedTrade = {
      ...pos,
      exitPrice: parseFloat(exitPrice.toFixed(2)),
      exitTime: new Date(),
      pnl,
      reason
    };

    // Update MongoDB record
    if (mongoose.connection.readyState === 1) {
      try {
        await TradeModel.findByIdAndUpdate(
          pos.id,
          {
            exitPrice: closedTrade.exitPrice,
            exitTime: closedTrade.exitTime,
            pnl: closedTrade.pnl,
            reason: closedTrade.reason
          }
        );
      } catch (error) {
        console.error(`PaperTrader: MongoDB exit write failed for ${pos.id}:`, error);
      }
    }

    this.history.push(closedTrade);
    this.positions.splice(idx, 1);
    
    // Update daily risk limits
    await riskManager.updateOnTradeClose(pnl);
    await this.saveStateLocal();

    console.log(`PaperTrader: Position closed. Symbol: ${pos.symbol}, P&L: ₹${pnl} (${reason})`);
    return closedTrade;
  }

  async updatePositionsLtp(niftySpot, optionChain) {
    await this.ensureLoaded();
    if (this.positions.length === 0) return [];

    let hasChanges = false;
    let totalUnrealizedPnl = 0;
    const closedPositions = [];

    const priceMap = {};
    optionChain.forEach(item => {
      priceMap[item.ce.symbol] = item.ce.ltp;
      priceMap[item.pe.symbol] = item.pe.ltp;
    });

    for (let i = this.positions.length - 1; i >= 0; i--) {
      const pos = this.positions[i];
      let currentLtp = priceMap[pos.symbol];

      if (currentLtp === undefined) {
        const distance = pos.strike - niftySpot;
        const ceIntrinsic = Math.max(0, niftySpot - pos.strike);
        const peIntrinsic = Math.max(0, pos.strike - niftySpot);
        const timeValue = 120 * Math.exp(-Math.pow(distance / 120, 2));
        
        currentLtp = pos.optionType === 'CE' 
          ? parseFloat((ceIntrinsic + timeValue).toFixed(2)) 
          : parseFloat((peIntrinsic + timeValue).toFixed(2));
      }

      pos.ltp = currentLtp;
      pos.unrealizedPnl = parseFloat(((currentLtp - pos.entryPrice) * pos.quantity).toFixed(2));
      totalUnrealizedPnl += pos.unrealizedPnl;
      hasChanges = true;

      // Check SL / Target triggers
      if (currentLtp <= pos.stopLoss) {
        const closed = await this.closePosition(pos.id, pos.stopLoss, "STOP LOSS HIT");
        closedPositions.push(closed);
      } else if (currentLtp >= pos.target) {
        const closed = await this.closePosition(pos.id, pos.target, "TARGET HIT");
        closedPositions.push(closed);
      }
    }

    // Force close if daily loss limit hit
    const totalDailyLossBreached = await riskManager.isLossLimitBreached(totalUnrealizedPnl);
    if (totalDailyLossBreached && this.positions.length > 0) {
      console.warn("PaperTrader: Daily loss limit breached! Force-closing all positions.");
      const positionsToClose = [...this.positions];
      for (const pos of positionsToClose) {
        const closed = await this.closePosition(pos.id, pos.ltp, "DAILY LOSS LIMIT BREACHED (RISK HALT)");
        closedPositions.push(closed);
      }
      hasChanges = true;
    }

    if (hasChanges) {
      await this.saveStateLocal();
    }

    return closedPositions;
  }
}

export default new PaperTrader();
