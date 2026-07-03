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

    // Reset values to wait for live connection
    this.niftySpot = 0.0;
    this.bankNiftySpot = 0.0;
    this.indiaVix = 14.5;
    this.futuresOi = 0;
    this.futuresPrice = 0.0;
    this.futuresContractOi = 0;
    this.futuresOiChange = 0;
    this.optionChain = [];
    this.candles = [];

    this.intervalId = setInterval(() => {
      this.tickCount++;
      const timestamp = Date.now();

      // Aggregate candle from live spot price
      if (this.niftySpot > 0) {
        this.currentCandleTicks.push({ price: this.niftySpot, time: timestamp });

        if (this.currentCandleTicks.length >= 60) {
          const prices = this.currentCandleTicks.map(t => t.price);
          const open = prices[0];
          const close = prices[prices.length - 1];
          const high = Math.max(...prices);
          const low = Math.min(...prices);
          const volume = 0; // Live volume from ticks if needed
          const vwap = prices.reduce((a, b) => a + b, 0) / prices.length;

          this.candles.push({ time: timestamp, open, high, low, close, volume, vwap: parseFloat(vwap.toFixed(2)) });
          if (this.candles.length > 100) this.candles.shift();
          this.currentCandleTicks = [];
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
    // No-op: we only use real option chain data from Angel One
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
