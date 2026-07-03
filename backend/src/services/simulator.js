import EventEmitter from 'events';

class MarketSimulator extends EventEmitter {
  constructor() {
    super();
    this.niftySpot = 0.0;
    this.bankNiftySpot = 0.0;
    this.candles = []; 
    this.currentCandleTicks = [];
    this.intervalId = null;
    this.tickCount = 0;
    this.indiaVix = 0.0;
    this.futuresOi = 0;
    this.futuresPrice = 0.0;
    this.futuresContractOi = 0;
    this.futuresOiChange = 0;
    this.optionChain = [];
    this.isLiveMode = false;
  }

  start() {
    if (this.intervalId) return;

    // Pre-populate 60 synthetic candles so indicators are active immediately
    const basePrice = 24350;
    this.niftySpot = basePrice;
    this.bankNiftySpot = 52200;
    this.indiaVix = 12.5;
    this.futuresOi = 1250000;
    this.futuresPrice = basePrice + 12;

    for (let i = 60; i >= 0; i--) {
      const drift = (Math.random() - 0.48) * 30;
      const price = basePrice - i * 2 + drift;
      const open = price + (Math.random() - 0.5) * 10;
      const close = price + (Math.random() - 0.5) * 10;
      const high = Math.max(open, close) + Math.random() * 8;
      const low = Math.min(open, close) - Math.random() * 8;
      const volume = Math.floor(500000 + Math.random() * 1000000);
      this.candles.push({ time: Date.now() - i * 60000, open, high, low, close, volume, vwap: (open + high + low + close) / 4 });
    }

    // Pre-populate option chain
    this._generateOptionChain();

    this.intervalId = setInterval(() => {
      this.tickCount++;
      const timestamp = Date.now();

      // Simulate spot price movement when not in live mode
      if (!this.isLiveMode) {
        const lastClose = this.candles.length > 0 ? this.candles[this.candles.length - 1].close : basePrice;
        this.niftySpot = parseFloat((lastClose + (Math.random() - 0.49) * 5).toFixed(2));
        this.bankNiftySpot = parseFloat((this.niftySpot * 2.15).toFixed(2));
        this.indiaVix = parseFloat((11 + Math.random() * 3).toFixed(2));
      }

      // Always aggregate candles
      if (this.niftySpot > 0) {
        this.currentCandleTicks.push({ price: this.niftySpot, time: timestamp });

        if (this.currentCandleTicks.length >= 60) {
          const prices = this.currentCandleTicks.map(t => t.price);
          const open = prices[0];
          const close = prices[prices.length - 1];
          const high = Math.max(...prices);
          const low = Math.min(...prices);
          const volume = Math.floor(500000 + Math.random() * 1500000);
          const vwap = prices.reduce((a, b) => a + b, 0) / prices.length;

          this.candles.push({ time: timestamp, open, high, low, close, volume, vwap: parseFloat(vwap.toFixed(2)) });
          if (this.candles.length > 100) this.candles.shift();
          this.currentCandleTicks = [];

          // Refresh simulated option chain on each new candle
          if (!this.isLiveMode) this._generateOptionChain();
        }
      }

      this.emit('tick', {
        timestamp,
        niftySpot: this.niftySpot,
        bankNiftySpot: this.bankNiftySpot,
        indiaVix: this.indiaVix,
        futuresOi: this.futuresOi,
        futuresPrice: this.futuresPrice,
        futuresContractOi: this.futuresContractOi,
        futuresOiChange: this.futuresOiChange,
        optionChain: this.optionChain,
        candles: this.candles
      });
    }, 1000);
  }

  _generateOptionChain() {
    const spot = this.niftySpot || 24350;
    const atm = Math.round(spot / 50) * 50;
    this.optionChain = [];
    for (let i = -5; i <= 5; i++) {
      const strike = atm + i * 50;
      const dist = Math.abs(strike - spot);
      const ceLtp = parseFloat(Math.max(1, (strike > spot ? dist * 0.4 : (atm - strike + 80)) + Math.random() * 5).toFixed(2));
      const peLtp = parseFloat(Math.max(1, (strike < spot ? dist * 0.4 : (strike - atm + 80)) + Math.random() * 5).toFixed(2));
      const ceOi = Math.floor(500000 + Math.random() * 2000000);
      const peOi = Math.floor(500000 + Math.random() * 2000000);
      const ceOiChange = Math.floor((Math.random() - 0.5) * 50000);
      const peOiChange = Math.floor((Math.random() - 0.5) * 50000);
      this.optionChain.push({
        strike,
        ce: { symbol: `NIFTY${strike}CE`, ltp: ceLtp, oi: ceOi, oiChange: ceOiChange, oiChangePercent: parseFloat(((ceOiChange / ceOi) * 100).toFixed(2)), volume: Math.floor(Math.random() * 5000000) },
        pe: { symbol: `NIFTY${strike}PE`, ltp: peLtp, oi: peOi, oiChange: peOiChange, oiChangePercent: parseFloat(((peOiChange / peOi) * 100).toFixed(2)), volume: Math.floor(Math.random() * 5000000) }
      });
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getLatestData() {
    return {
      niftySpot: this.niftySpot,
      bankNiftySpot: this.bankNiftySpot,
      indiaVix: this.indiaVix,
      futuresOi: this.futuresOi,
      futuresPrice: this.futuresPrice,
      futuresContractOi: this.futuresContractOi,
      futuresOiChange: this.futuresOiChange,
      optionChain: this.optionChain,
      candles: this.candles
    };
  }
}

export default new MarketSimulator();
