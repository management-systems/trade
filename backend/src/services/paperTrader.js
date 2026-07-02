import fs from 'fs';
import { config } from '../config.js';
import riskManager from './riskManager.js';

class PaperTrader {
  constructor() {
    this.balance = config.STARTING_BALANCE;
    this.positions = [];
    this.history = [];
    
    this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(config.DB_PATH)) {
        const data = JSON.parse(fs.readFileSync(config.DB_PATH, 'utf8'));
        this.balance = data.balance ?? config.STARTING_BALANCE;
        this.positions = data.positions ?? [];
        this.history = data.history ?? [];
        console.log(`PaperTrader: State loaded. Balance: ₹${this.balance}, Active Positions: ${this.positions.length}, Past Trades: ${this.history.length}`);
      } else {
        this.saveState();
      }
    } catch (error) {
      console.error("PaperTrader: Error loading state, using defaults:", error);
    }
  }

  saveState() {
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
      console.error("PaperTrader: Error saving state:", error);
    }
  }

  getAccountState() {
    const totalUnrealizedPnl = this.positions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
    const equity = this.balance + totalUnrealizedPnl;
    
    // Calculate stats
    const totalTrades = this.history.length;
    const winningTrades = this.history.filter(t => t.pnl > 0).length;
    const winRatio = totalTrades > 0 ? parseFloat(((winningTrades / totalTrades) * 100).toFixed(2)) : 0;
    
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
      risk: riskManager.getRiskState(totalUnrealizedPnl)
    };
  }

  placeOrder({ symbol, type, optionType, strike, entryPrice, quantity, slPoints, targetPoints, isAutoSignal = false }) {
    // 1. Validate risk management rules first
    const riskCheck = riskManager.canPlaceTrade();
    if (!riskCheck.allowed) {
      throw new Error(riskCheck.reason);
    }

    const premiumRequired = entryPrice * quantity;
    
    // 2. Check if we have enough margin/balance
    if (this.balance < premiumRequired) {
      throw new Error(`Insufficient funds. Required margin: ₹${premiumRequired.toFixed(2)}, Available: ₹${this.balance.toFixed(2)}`);
    }

    // 3. Register the trade
    riskManager.registerTradeTaken();

    const sl = slPoints || config.DEFAULT_SL_POINTS;
    const target = targetPoints || config.DEFAULT_TARGET_POINTS;

    const stopLossPrice = parseFloat((entryPrice - sl).toFixed(2));
    const targetPrice = parseFloat((entryPrice + target).toFixed(2));

    const newPosition = {
      id: `pos_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      symbol,
      type,         // BUY
      optionType,   // CE or PE
      strike,
      quantity,
      entryPrice: parseFloat(entryPrice.toFixed(2)),
      ltp: parseFloat(entryPrice.toFixed(2)),
      unrealizedPnl: 0,
      stopLoss: stopLossPrice,
      target: targetPrice,
      slPoints: sl,
      targetPoints: target,
      entryTime: Date.now(),
      isAutoSignal
    };

    // Deduct margin from balance
    this.balance -= premiumRequired;
    this.positions.push(newPosition);
    this.saveState();
    
    console.log(`PaperTrader: Order placed. Symbol: ${symbol}, Qty: ${quantity}, Entry: ${entryPrice}, SL: ${stopLossPrice}, Tgt: ${targetPrice}`);
    return newPosition;
  }

  closePosition(positionId, exitPrice, reason = "MANUAL EXIT") {
    const idx = this.positions.findIndex(p => p.id === positionId);
    if (idx === -1) {
      throw new Error("Position not found.");
    }

    const pos = this.positions[idx];
    const pnl = parseFloat(((exitPrice - pos.entryPrice) * pos.quantity).toFixed(2));
    const returnedCapital = pos.entryPrice * pos.quantity + pnl;

    // Refund capital + Pnl back to balance
    this.balance += returnedCapital;

    const closedTrade = {
      ...pos,
      exitPrice: parseFloat(exitPrice.toFixed(2)),
      exitTime: Date.now(),
      pnl,
      reason
    };

    // Record trade history
    this.history.push(closedTrade);
    
    // Remove position
    this.positions.splice(idx, 1);
    
    // Update daily risk realized balance
    riskManager.updateOnTradeClose(pnl);

    this.saveState();
    console.log(`PaperTrader: Position closed. Symbol: ${pos.symbol}, Exit: ${exitPrice}, P&L: ₹${pnl} (${reason})`);
    return closedTrade;
  }

  updatePositionsLtp(niftySpot, optionChain) {
    if (this.positions.length === 0) return;

    let hasChanges = false;
    let totalUnrealizedPnl = 0;
    const closedPositions = [];

    // Map chain to quickly fetch premium prices
    const priceMap = {};
    optionChain.forEach(item => {
      priceMap[item.ce.symbol] = item.ce.ltp;
      priceMap[item.pe.symbol] = item.pe.ltp;
    });

    for (let i = this.positions.length - 1; i >= 0; i--) {
      const pos = this.positions[i];
      let currentLtp = priceMap[pos.symbol];

      // Fallback approximation if contract drops out of chain (very rare)
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

      // Check Stop Loss / Target hits
      if (currentLtp <= pos.stopLoss) {
        const closed = this.closePosition(pos.id, pos.stopLoss, "STOP LOSS HIT");
        closedPositions.push(closed);
      } else if (currentLtp >= pos.target) {
        const closed = this.closePosition(pos.id, pos.target, "TARGET HIT");
        closedPositions.push(closed);
      }
    }

    // Check if total daily loss (realized + active unrealized) limit has been breached
    const currentRisk = riskManager.getRiskState(totalUnrealizedPnl);
    if (currentRisk.lossLimitHit && this.positions.length > 0) {
      console.warn("PaperTrader: Daily loss limit breached! Force-closing all positions.");
      
      // We must copy positions before iterating as closePosition alters the array
      const positionsToClose = [...this.positions];
      for (const pos of positionsToClose) {
        const closed = this.closePosition(pos.id, pos.ltp, "DAILY LOSS LIMIT BREACHED (RISK HALT)");
        closedPositions.push(closed);
      }
      hasChanges = true;
    }

    if (hasChanges) {
      this.saveState();
    }

    return closedPositions;
  }
}

export default new PaperTrader();
