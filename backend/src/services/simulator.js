import EventEmitter from 'events';

class MarketSimulator extends EventEmitter {
  constructor() {
    super();
    this.niftySpot = 24150.0;
    this.bankNiftySpot = 52200.0;
    this.candles = []; // 1-minute candles for Nifty 50
    this.currentCandleTicks = [];
    this.intervalId = null;
    this.tickCount = 0;
    this.oiData = {}; // Store persistent OI values to simulate gradual changes
    this.indiaVix = 14.5;
    this.futuresOi = 1250000;
    this.futuresPrice = 24162.0;
    this.futuresContractOi = 1250000;
    this.futuresOiChange = 0;
    
    this.initializeHistory();
  }

  // Pre-populate 50 candles so EMAs/VWAP work immediately on startup
  initializeHistory() {
    console.log("Simulator: Pre-populating historical candles...");
    const now = Date.now();
    let tempSpot = 24100.0;
    let accumulatedVolume = 0;
    let accumulatedPriceVolumeProduct = 0;

    for (let i = 50; i > 0; i--) {
      const candleTime = now - i * 60 * 1000;
      const open = tempSpot;
      const change = (Math.random() - 0.48) * 15; // slight upward drift
      const close = tempSpot + change;
      const high = Math.max(open, close) + Math.random() * 8;
      const low = Math.min(open, close) - Math.random() * 8;
      const volume = Math.floor(Math.random() * 5000) + 1000;
      
      const typicalPrice = (high + low + close) / 3;
      accumulatedVolume += volume;
      accumulatedPriceVolumeProduct += typicalPrice * volume;
      const vwap = accumulatedPriceVolumeProduct / accumulatedVolume;

      this.candles.push({
        time: candleTime,
        open,
        high,
        low,
        close,
        volume,
        vwap
      });
      tempSpot = close;
    }
    this.niftySpot = tempSpot;
  }

  start() {
    if (this.intervalId) return;

    this.isLiveMode = false; // Flag updated by index.js on Angel One connection

    this.intervalId = setInterval(() => {
      this.tickCount++;
      
      // 1. Simulate Nifty and Bank Nifty spot fluctuations ONLY when not in live mode
      if (!this.isLiveMode) {
        const niftyChange = (Math.random() - 0.49) * 4; // micro-moves
        this.niftySpot = parseFloat((this.niftySpot + niftyChange).toFixed(2));

        const bankNiftyChange = (Math.random() - 0.49) * 10;
        this.bankNiftySpot = parseFloat((this.bankNiftySpot + bankNiftyChange).toFixed(2));

        const vixChange = (Math.random() - 0.5) * 0.12;
        this.indiaVix = parseFloat(Math.max(8, Math.min(30, this.indiaVix + vixChange)).toFixed(2));

        const futChange = Math.floor((Math.random() - 0.48) * 1100);
        this.futuresOi = Math.max(500000, this.futuresOi + futChange);

        // Drift Futures Price slightly above Spot
        this.futuresPrice = parseFloat((this.niftySpot + 12 + Math.sin(Date.now() / 15000) * 3).toFixed(2));
        this.futuresContractOi = this.futuresOi;
        this.futuresOiChange += futChange;
      }

      // 2. Aggregate ticks for the current minute candle
      const timestamp = Date.now();
      this.currentCandleTicks.push({ price: this.niftySpot, time: timestamp });

      // Aggregate candle every 60 seconds (60 ticks if 1s interval)
      if (this.currentCandleTicks.length >= 60) {
        const prices = this.currentCandleTicks.map(t => t.price);
        const open = prices[0];
        const close = prices[prices.length - 1];
        const high = Math.max(...prices);
        const low = Math.min(...prices);
        const volume = Math.floor(Math.random() * 6000) + 2000;
        
        // Calculate VWAP across all history or reset daily (for sim, we do running session VWAP)
        const lastCandle = this.candles[this.candles.length - 1];
        let totalVolume = volume;
        let totalPV = ((high + low + close) / 3) * volume;
        
        if (lastCandle) {
          // Keep a rolling window of cumulative values
          const previousPV = this.candles.reduce((sum, c) => sum + ((c.high + c.low + c.close)/3) * c.volume, 0);
          const previousVolume = this.candles.reduce((sum, c) => sum + c.volume, 0);
          totalVolume += previousVolume;
          totalPV += previousPV;
        }
        const vwap = parseFloat((totalPV / totalVolume).toFixed(2));

        this.candles.push({
          time: timestamp,
          open,
          high,
          low,
          close,
          volume,
          vwap
        });

        // Limit candle history to last 100
        if (this.candles.length > 100) {
          this.candles.shift();
        }

        this.currentCandleTicks = [];
      }

      // 3. Generate Option Chain
      const optionChain = this.generateOptionChain();

      // 4. Emit the tick
      this.emit('tick', {
        timestamp,
        niftySpot: this.niftySpot,
        bankNiftySpot: this.bankNiftySpot,
        indiaVix: this.indiaVix,
        futuresOi: this.futuresOi,
        futuresPrice: this.futuresPrice,
        futuresContractOi: this.futuresContractOi,
        futuresOiChange: this.futuresOiChange,
        optionChain,
        candles: this.candles
      });
    }, 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  generateOptionChain() {
    const spot = this.niftySpot;
    // Nifty strike price multiple is 50
    const atmStrike = Math.round(spot / 50) * 50;
    const strikes = [];
    
    // Generate 5 strikes below and 5 strikes above ATM (11 strikes total)
    for (let i = -5; i <= 5; i++) {
      strikes.push(atmStrike + i * 50);
    }

    return strikes.map(strike => {
      const distance = strike - spot;
      
      // Use Black-Scholes approximation for LTP
      // CE LTP higher when strike < spot (In the money)
      const ceIntrinsic = Math.max(0, spot - strike);
      const peIntrinsic = Math.max(0, strike - spot);
      
      // Extrinsic value peaks at ATM and decays exponentially out-of-the-money
      const timeValue = 120 * Math.exp(-Math.pow(distance / 120, 2));
      
      const ceLtp = parseFloat((ceIntrinsic + timeValue + Math.sin(Date.now() / 10000) * 2).toFixed(2));
      const peLtp = parseFloat((peIntrinsic + timeValue + Math.cos(Date.now() / 10000) * 2).toFixed(2));

      // Simulate Open Interest (OI)
      // Call/Put OI peaks at near-OTM levels where writers build walls
      if (!this.oiData[strike]) {
        this.oiData[strike] = {
          ceOi: Math.floor((15000 - Math.abs(distance) * 20) * (Math.random() * 0.4 + 0.8)),
          peOi: Math.floor((15000 - Math.abs(distance) * 20) * (Math.random() * 0.4 + 0.8)),
          ceOiChg: 0,
          peOiChg: 0
        };
      }

      // Add small random changes to OI over time
      const ceChange = Math.floor((Math.random() - 0.48) * 100);
      const peChange = Math.floor((Math.random() - 0.48) * 100);

      this.oiData[strike].ceOi += ceChange;
      this.oiData[strike].peOi += peChange;
      
      // Accumulate change in OI from "start of day"
      this.oiData[strike].ceOiChg += ceChange;
      this.oiData[strike].peOiChg += peChange;

      // Simulate Volume
      const ceVolume = Math.floor((20000 - Math.abs(distance) * 50) * (Math.random() * 0.2 + 0.9)) + this.tickCount * 5;
      const peVolume = Math.floor((20000 - Math.abs(distance) * 50) * (Math.random() * 0.2 + 0.9)) + this.tickCount * 5;

      return {
        strike,
        ce: {
          symbol: `NIFTY26JUL${strike}CE`,
          ltp: ceLtp,
          oi: Math.max(100, this.oiData[strike].ceOi),
          oiChange: this.oiData[strike].ceOiChg,
          oiChangePercent: parseFloat(((this.oiData[strike].ceOiChg / (this.oiData[strike].ceOi || 1)) * 100).toFixed(2)),
          volume: Math.max(100, ceVolume)
        },
        pe: {
          symbol: `NIFTY26JUL${strike}PE`,
          ltp: peLtp,
          oi: Math.max(100, this.oiData[strike].peOi),
          oiChange: this.oiData[strike].peOiChg,
          oiChangePercent: parseFloat(((this.oiData[strike].peOiChg / (this.oiData[strike].peOi || 1)) * 100).toFixed(2)),
          volume: Math.max(100, peVolume)
        }
      };
    });
  }

  getLatestData() {
    return {
      niftySpot: this.niftySpot,
      bankNiftySpot: this.bankNiftySpot,
      optionChain: this.generateOptionChain(),
      candles: this.candles
    };
  }
}

export default new MarketSimulator();
