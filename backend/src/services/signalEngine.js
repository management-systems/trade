import { config } from '../config.js';

export function calculateEMA(candles, period) {
  if (!candles || candles.length < period) return null;
  const k = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((sum, c) => sum + c.close, 0) / period;
  
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close - ema) * k + ema;
  }
  return parseFloat(ema.toFixed(2));
}

export function calculateSupportResistance(candles, period) {
  if (!candles || candles.length < period) return { support: null, resistance: null };
  const slice = candles.slice(-period);
  const lows = slice.map(c => c.low);
  const highs = slice.map(c => c.high);
  
  return {
    support: parseFloat(Math.min(...lows).toFixed(2)),
    resistance: parseFloat(Math.max(...highs).toFixed(2))
  };
}

export function analyzeSignal(marketData) {
  const { niftySpot, optionChain, candles } = marketData;
  
  if (!candles || candles.length < Math.max(config.INDICATORS.EMA_SLOW, config.INDICATORS.SUPPORT_RESISTANCE_PERIOD)) {
    return {
      signalType: 'NO TRADE',
      confidence: 0,
      reason: 'Insufficient historical candle data to calculate indicators.',
      indicators: {}
    };
  }

  // 1. Calculate Technical Indicators
  const latestCandle = candles[candles.length - 1];
  const ema20 = calculateEMA(candles, config.INDICATORS.EMA_FAST);
  const ema50 = calculateEMA(candles, config.INDICATORS.EMA_SLOW);
  
  // Calculate Support & Resistance from candles prior to the current close
  // to detect genuine breakout
  const completedCandles = candles.slice(0, -1);
  const { support, resistance } = calculateSupportResistance(
    completedCandles, 
    config.INDICATORS.SUPPORT_RESISTANCE_PERIOD
  );

  // Volume Moving Average
  const volumeSlice = candles.slice(-config.INDICATORS.VOLUME_MA_PERIOD);
  const avgVolume = volumeSlice.reduce((sum, c) => sum + c.volume, 0) / volumeSlice.length;
  const latestVolume = latestCandle.volume;
  const isVolumeExpansion = latestVolume > avgVolume * 1.3;

  // 2. Options Open Interest (OI) Analysis
  // Find At-The-Money (ATM) strike
  const atmStrike = Math.round(niftySpot / 50) * 50;
  
  // Find options chain contracts near ATM
  let ceOiChangeAtmNear = 0;
  let peOiChangeAtmNear = 0;
  let callOIPayload = [];
  let putOIPayload = [];

  optionChain.forEach(item => {
    const dist = item.strike - atmStrike;
    // We check strikes within +/- 150 points of ATM
    if (Math.abs(dist) <= 150) {
      ceOiChangeAtmNear += item.ce.oiChange;
      peOiChangeAtmNear += item.pe.oiChange;
      callOIPayload.push({ strike: item.strike, oiChange: item.ce.oiChange, volume: item.ce.volume });
      putOIPayload.push({ strike: item.strike, oiChange: item.pe.oiChange, volume: item.pe.volume });
    }
  });

  // Check specific rules:
  // - Call OI decreasing (short covering - bullish)
  const isCallOiDecreasing = ceOiChangeAtmNear < -100;
  // - Put OI increasing (support writing - bullish)
  const isPutOiIncreasing = peOiChangeAtmNear > 100;
  
  // - Put OI decreasing (bearish liquidation)
  const isPutOiDecreasing = peOiChangeAtmNear < -100;
  // - Call OI increasing (resistance writing - bearish)
  const isCallOiIncreasing = ceOiChangeAtmNear > 100;

  const currentVwap = latestCandle.vwap;

  // Indicators object to pass to UI
  const indicatorStats = {
    ema20,
    ema50,
    vwap: currentVwap,
    support,
    resistance,
    avgVolume: Math.round(avgVolume),
    latestVolume,
    isVolumeExpansion
  };

  // 3. Evaluate Signal Conditions
  let buyCeScore = 0;
  const ceReasons = [];
  
  // Rule 1: Price > VWAP (Bullish)
  if (niftySpot > currentVwap) {
    buyCeScore += 25;
    ceReasons.push("Spot price is above VWAP (Bullish)");
  }
  
  // Rule 2: EMA20 > EMA50 (Golden cross/Bullish alignment)
  if (ema20 && ema50 && ema20 > ema50) {
    buyCeScore += 25;
    ceReasons.push("EMA 20 is above EMA 50 (Bullish Crossover)");
  }
  
  // Rule 3: Breakout above resistance
  if (resistance && niftySpot > resistance) {
    buyCeScore += 20;
    ceReasons.push("Spot price broke out above resistance level ₹" + resistance);
  }
  
  // Rule 4: Volume expansion
  if (isVolumeExpansion) {
    buyCeScore += 15;
    ceReasons.push("Volume is expanding (>1.3x average volume)");
  }
  
  // Rule 5: Call OI decreasing (Short Covering) or Put OI increasing at lower strikes (Support writing)
  if (isCallOiDecreasing || isPutOiIncreasing) {
    buyCeScore += 15;
    if (isCallOiDecreasing && isPutOiIncreasing) {
      ceReasons.push("Bullish OI: Short covering in CE & Support writing in PE");
    } else if (isCallOiDecreasing) {
      ceReasons.push("Bullish OI: Calls are unwinding (Short Covering)");
    } else {
      ceReasons.push("Bullish OI: Puts are being written heavily (Support Building)");
    }
  }

  // Evaluate BEARISH (Buy PE) conditions
  let buyPeScore = 0;
  const peReasons = [];

  // Rule 1: Price < VWAP (Bearish)
  if (niftySpot < currentVwap) {
    buyPeScore += 25;
    peReasons.push("Spot price is below VWAP (Bearish)");
  }

  // Rule 2: EMA20 < EMA50 (Death cross/Bearish alignment)
  if (ema20 && ema50 && ema20 < ema50) {
    buyPeScore += 25;
    peReasons.push("EMA 20 is below EMA 50 (Bearish Crossover)");
  }

  // Rule 3: Breakdown below support
  if (support && niftySpot < support) {
    buyPeScore += 20;
    peReasons.push("Spot price broke down below support level ₹" + support);
  }

  // Rule 4: Volume expansion
  if (isVolumeExpansion) {
    buyPeScore += 15;
    peReasons.push("Volume is expanding on down move (>1.3x average)");
  }

  // Rule 5: Put OI decreasing or Call OI building (Resistance writing)
  if (isPutOiDecreasing || isCallOiIncreasing) {
    buyPeScore += 15;
    if (isPutOiDecreasing && isCallOiIncreasing) {
      peReasons.push("Bearish OI: Long unwinding in PE & Resistance writing in CE");
    } else if (isCallOiIncreasing) {
      peReasons.push("Bearish OI: Calls are being written heavily (Resistance Building)");
    } else {
      peReasons.push("Bearish OI: Puts are unwinding (Support Weakening)");
    }
  }

  // Determine final trade recommendation
  let finalSignal = 'NO TRADE';
  let confidence = 0;
  let reasonsList = [];

  // Threshold to trigger a trade signal is 60%
  const TRIGGER_THRESHOLD = 60;

  if (buyCeScore >= TRIGGER_THRESHOLD && buyCeScore >= buyPeScore) {
    finalSignal = 'BUY CE';
    confidence = buyCeScore;
    reasonsList = ceReasons;
  } else if (buyPeScore >= TRIGGER_THRESHOLD && buyPeScore > buyCeScore) {
    finalSignal = 'BUY PE';
    confidence = buyPeScore;
    reasonsList = peReasons;
  } else {
    reasonsList = ["No strong momentum indicators. Waiting for trend confirmation."];
  }

  return {
    signalType: finalSignal,
    confidence,
    reason: reasonsList.join(" | "),
    indicators: indicatorStats,
    atmStrike
  };
}
