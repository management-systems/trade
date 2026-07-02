import fs from 'fs';
import { config } from '../config.js';

class RiskManager {
  constructor() {
    this.maxTradesPerDay = config.RISK.MAX_TRADES_PER_DAY;
    this.maxLossPerDay = config.RISK.MAX_LOSS_PER_DAY;
    this.tradesTakenToday = 0;
    this.realizedPnlToday = 0;
    this.currentDate = this.getTodayDateString();
    
    this.loadRiskState();
  }

  getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  }

  loadRiskState() {
    try {
      if (fs.existsSync(config.DB_PATH)) {
        const data = JSON.parse(fs.readFileSync(config.DB_PATH, 'utf8'));
        if (data.riskConfig) {
          this.maxTradesPerDay = data.riskConfig.maxTradesPerDay ?? config.RISK.MAX_TRADES_PER_DAY;
          this.maxLossPerDay = data.riskConfig.maxLossPerDay ?? config.RISK.MAX_LOSS_PER_DAY;
        }
        
        // Reset or load daily statistics
        const today = this.getTodayDateString();
        if (data.riskState && data.riskState.date === today) {
          this.tradesTakenToday = data.riskState.tradesTakenToday ?? 0;
          this.realizedPnlToday = data.riskState.dailyPnl ?? 0;
          this.currentDate = today;
        } else {
          this.resetDailyStats();
        }
      }
    } catch (error) {
      console.error("RiskManager: Error loading risk state, using defaults:", error);
    }
  }

  saveRiskState() {
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
      console.error("RiskManager: Error saving risk state:", error);
    }
  }

  resetDailyStats() {
    this.tradesTakenToday = 0;
    this.realizedPnlToday = 0;
    this.currentDate = this.getTodayDateString();
    this.saveRiskState();
  }

  updateConfig(maxTrades, maxLoss) {
    this.maxTradesPerDay = parseInt(maxTrades) || config.RISK.MAX_TRADES_PER_DAY;
    this.maxLossPerDay = parseFloat(maxLoss) || config.RISK.MAX_LOSS_PER_DAY;
    this.saveRiskState();
    console.log(`RiskManager: Config updated. Max Trades: ${this.maxTradesPerDay}, Max Loss: ₹${this.maxLossPerDay}`);
  }

  checkResetDate() {
    const today = this.getTodayDateString();
    if (this.currentDate !== today) {
      console.log(`RiskManager: New trading day detected (${today}). Resetting daily stats.`);
      this.resetDailyStats();
    }
  }

  canPlaceTrade() {
    this.checkResetDate();

    // Check if daily trade limit exceeded
    if (this.tradesTakenToday >= this.maxTradesPerDay) {
      return { 
        allowed: false, 
        reason: `Max trades per day limit (${this.maxTradesPerDay}) has been reached.` 
      };
    }

    // Check if daily loss limit already breached (realized)
    if (this.realizedPnlToday <= -this.maxLossPerDay) {
      return { 
        allowed: false, 
        reason: `Daily loss limit of ₹${this.maxLossPerDay} has been breached. Trading locked.` 
      };
    }

    return { allowed: true };
  }

  registerTradeTaken() {
    this.checkResetDate();
    this.tradesTakenToday++;
    this.saveRiskState();
  }

  updateOnTradeClose(pnl) {
    this.checkResetDate();
    this.realizedPnlToday += pnl;
    this.saveRiskState();
  }

  // Returns true if the aggregate daily P&L (realized + active unrealized) breaches the max loss limit
  isLossLimitBreached(unrealizedPnl) {
    this.checkResetDate();
    const totalPnl = this.realizedPnlToday + unrealizedPnl;
    return totalPnl <= -this.maxLossPerDay;
  }

  getRiskState(unrealizedPnl = 0) {
    this.checkResetDate();
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
