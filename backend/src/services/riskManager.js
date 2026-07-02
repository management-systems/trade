import fs from 'fs';
import mongoose from 'mongoose';
import { config } from '../config.js';
import RiskModel from '../models/Risk.js';

class RiskManager {
  constructor() {
    this.maxTradesPerDay = config.RISK.MAX_TRADES_PER_DAY;
    this.maxLossPerDay = config.RISK.MAX_LOSS_PER_DAY;
    this.tradesTakenToday = 0;
    this.realizedPnlToday = 0;
    this.currentDate = this.getTodayDateString();
    
    this.loadRiskStateLocal();
  }

  getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  }

  loadRiskStateLocal() {
    try {
      if (fs.existsSync(config.DB_PATH)) {
        const data = JSON.parse(fs.readFileSync(config.DB_PATH, 'utf8'));
        if (data.riskConfig) {
          this.maxTradesPerDay = data.riskConfig.maxTradesPerDay ?? config.RISK.MAX_TRADES_PER_DAY;
          this.maxLossPerDay = data.riskConfig.maxLossPerDay ?? config.RISK.MAX_LOSS_PER_DAY;
        }
        
        const today = this.getTodayDateString();
        if (data.riskState && data.riskState.date === today) {
          this.tradesTakenToday = data.riskState.tradesTakenToday ?? 0;
          this.realizedPnlToday = data.riskState.dailyPnl ?? 0;
          this.currentDate = today;
        } else {
          this.resetDailyStatsLocal();
        }
      }
    } catch (error) {
      console.error("RiskManager: Error loading local state:", error);
    }
  }

  async ensureRiskLoaded() {
    this.checkResetDate();

    // If MongoDB is connected, load state from Mongo
    if (mongoose.connection.readyState === 1) {
      try {
        let state = await RiskModel.findOne({ date: this.currentDate });
        if (!state) {
          state = await RiskModel.create({
            date: this.currentDate,
            maxTradesPerDay: this.maxTradesPerDay,
            maxLossPerDay: this.maxLossPerDay,
            tradesTakenToday: 0,
            realizedPnlToday: 0
          });
        }
        this.maxTradesPerDay = state.maxTradesPerDay;
        this.maxLossPerDay = state.maxLossPerDay;
        this.tradesTakenToday = state.tradesTakenToday;
        this.realizedPnlToday = state.realizedPnlToday;
      } catch (e) {
        console.error("RiskManager: MongoDB load failed, using local memory state:", e);
      }
    }
  }

  async saveRiskState() {
    // 1. Save to local JSON
    try {
      let dbData = {};
      if (fs.existsSync(config.DB_PATH)) {
        dbData = JSON.parse(fs.readFileSync(config.DB_PATH, 'utf8'));
      }
      dbData.riskConfig = {
        maxTradesPerDay: this.maxTradesPerDay,
        maxLossPerDay: this.maxLossPerDay
      };
      dbData.riskState = {
        date: this.currentDate,
        tradesTakenToday: this.tradesTakenToday,
        dailyPnl: this.realizedPnlToday
      };
      fs.writeFileSync(config.DB_PATH, JSON.stringify(dbData, null, 2), 'utf8');
    } catch (error) {
      console.error("RiskManager: Local JSON save failed:", error);
    }

    // 2. Save to MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await RiskModel.findOneAndUpdate(
          { date: this.currentDate },
          {
            maxTradesPerDay: this.maxTradesPerDay,
            maxLossPerDay: this.maxLossPerDay,
            tradesTakenToday: this.tradesTakenToday,
            realizedPnlToday: this.realizedPnlToday
          },
          { upsert: true, new: true }
        );
      } catch (e) {
        console.error("RiskManager: MongoDB save failed:", e);
      }
    }
  }

  resetDailyStatsLocal() {
    this.tradesTakenToday = 0;
    this.realizedPnlToday = 0;
    this.currentDate = this.getTodayDateString();
  }

  async resetDailyStats() {
    this.tradesTakenToday = 0;
    this.realizedPnlToday = 0;
    this.currentDate = this.getTodayDateString();
    await this.saveRiskState();
  }

  async updateConfig(maxTrades, maxLoss) {
    this.maxTradesPerDay = parseInt(maxTrades) || config.RISK.MAX_TRADES_PER_DAY;
    this.maxLossPerDay = parseFloat(maxLoss) || config.RISK.MAX_LOSS_PER_DAY;
    await this.saveRiskState();
  }

  checkResetDate() {
    const today = this.getTodayDateString();
    if (this.currentDate !== today) {
      this.resetDailyStatsLocal();
      this.currentDate = today;
    }
  }

  async canPlaceTrade() {
    await this.ensureRiskLoaded();

    if (this.tradesTakenToday >= this.maxTradesPerDay) {
      return { 
        allowed: false, 
        reason: `Max trades per day limit (${this.maxTradesPerDay}) has been reached.` 
      };
    }

    if (this.realizedPnlToday <= -this.maxLossPerDay) {
      return { 
        allowed: false, 
        reason: `Daily loss limit of ₹${this.maxLossPerDay} has been breached. Trading locked.` 
      };
    }

    return { allowed: true };
  }

  async registerTradeTaken() {
    await this.ensureRiskLoaded();
    this.tradesTakenToday++;
    await this.saveRiskState();
  }

  async updateOnTradeClose(pnl) {
    await this.ensureRiskLoaded();
    this.realizedPnlToday += pnl;
    await this.saveRiskState();
  }

  async isLossLimitBreached(unrealizedPnl) {
    await this.ensureRiskLoaded();
    const totalPnl = this.realizedPnlToday + unrealizedPnl;
    return totalPnl <= -this.maxLossPerDay;
  }

  async getRiskState(unrealizedPnl = 0) {
    await this.ensureRiskLoaded();
    const totalPnl = this.realizedPnlToday + unrealizedPnl;
    return {
      maxTradesPerDay: this.maxTradesPerDay,
      maxLossPerDay: this.maxLossPerDay,
      tradesTakenToday: this.tradesTakenToday,
      realizedPnlToday: this.realizedPnlToday,
      totalDailyPnl: totalPnl,
      limitHit: totalPnl <= -this.maxLossPerDay || this.tradesTakenToday >= this.maxTradesPerDay,
      lossLimitHit: totalPnl <= -this.maxLossPerDay,
      tradeLimitHit: this.tradesTakenToday >= this.maxTradesPerDay
    };
  }
}

export default new RiskManager();
