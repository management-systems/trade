import { calculateEMA, calculateSupportResistance, analyzeSignal } from './services/signalEngine.js';

console.log("=== Running Technical Indicator and Signal Engine Tests ===");

// 1. Verify EMA calculation
const mockCandles = [];
for (let i = 1; i <= 60; i++) {
  mockCandles.push({
    close: 100 + i, // rising trend
    high: 100 + i + 2,
    low: 100 + i - 2,
    volume: 1000 + (i % 5) * 200,
    vwap: 100 + i - 0.5
  });
}

console.log("\nTesting EMA-20 Calculation:");
const ema20 = calculateEMA(mockCandles, 20);
console.log(`- Last Candle Close: ${mockCandles[mockCandles.length - 1].close}`);
console.log(`- Calculated EMA-20: ${ema20}`);
if (ema20 > 100 && ema20 < 160) {
  console.log("✔ EMA-20 calculation matches expected boundaries!");
} else {
  console.error("✘ EMA-20 calculation error!");
}

// 2. Verify Support and Resistance
console.log("\nTesting Support/Resistance Calculation:");
const { support, resistance } = calculateSupportResistance(mockCandles, 30);
console.log(`- Period Range: last 30 candles`);
console.log(`- Calculated Support (Min Low): ${support}`);
console.log(`- Calculated Resistance (Max High): ${resistance}`);
if (support === 129 && resistance === 162) {
  console.log("✔ Support/Resistance calculation matches expected peaks/troughs!");
} else {
  console.error(`✘ Support/Resistance error! Expected S: 129, R: 162. Got S: ${support}, R: ${resistance}`);
}

// 3. Verify Signal evaluation
console.log("\nTesting Signal Engine (analyzeSignal):");
const mockOptionChain = [
  {
    strike: 160,
    ce: { symbol: "TEST160CE", ltp: 5.5, oi: 50000, oiChange: -2000, volume: 10000 },
    pe: { symbol: "TEST160PE", ltp: 1.2, oi: 20000, oiChange: 15000, volume: 5000 }
  },
  {
    strike: 150,
    ce: { symbol: "TEST150CE", ltp: 12.0, oi: 30000, oiChange: -5000, volume: 15000 },
    pe: { symbol: "TEST150PE", ltp: 0.8, oi: 40000, oiChange: 18000, volume: 8000 }
  }
];

const testMarketData = {
  niftySpot: 165.5, // above resistance
  optionChain: mockOptionChain,
  candles: mockCandles
};

const result = analyzeSignal(testMarketData);
console.log(`- Evaluated Signal: ${result.signalType}`);
console.log(`- Confidence Score: ${result.confidence}%`);
console.log(`- Breakdown Reasons: ${result.reason}`);
console.log(`- Computed Indicators:`, JSON.stringify(result.indicators, null, 2));

if (result.signalType === 'BUY CE') {
  console.log("✔ Signal engine successfully triggered BUY CE on bullish breakout and support writing!");
} else {
  console.error("✘ Signal engine failed to evaluate bullish breakout correctly!");
}

console.log("\n=== Technical Tests Complete ===");
