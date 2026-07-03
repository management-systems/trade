import * as autoTradeState from './autoTradeState.js';

/**
 * Determine the nearest 50‑point strike for a given NIFTY spot price.
 * Rounds to the nearest multiple of 50.
 */
export function determineNearestStrike(spot) {
  const strike = Math.round(spot / 50) * 50;
  return { strike };
}

/**
 * Evaluate the auto‑trade rules dynamically based on configured criteria checklists.
 * Returns an object `{ cePass, pePass, details }`.
 */
export function getMandatoryPasses(marketData, indicators, signalType = 'NO TRADE') {
  const { niftySpot, futuresOiChange, futuresPrice } = marketData;
  const {
    ema20,
    ema50,
    vwap,
    support,
    resistance,
    avgVolume,
    latestVolume,
    structure
  } = indicators || {};

  // Retrieve dynamically persisted criteria preferences
  const criteria = autoTradeState.getAutoTradeCriteria();

  const volumeOk = latestVolume > avgVolume * 1.5;
  const prevPrice = marketData.prevFuturesPrice || (niftySpot + 12);
  const futuresLong = futuresPrice > prevPrice && futuresOiChange > 0;
  const futuresShort = futuresPrice < prevPrice && futuresOiChange > 0;

  // CE checklist dynamic scoring
  const ceList = [
    { key: 'betterModel', status: signalType === 'BUY CE', weight: 20 },
    { key: 'bullishStructure', status: structure?.trend === 'BULLISH', weight: 20 },
    { key: 'priceAboveVWAP', status: niftySpot > vwap, weight: 10 },
    { key: 'resistanceBreakout', status: resistance && niftySpot > resistance, weight: 15 },
    { key: 'volumeAbove150', status: volumeOk, weight: 10 },
    { key: 'futuresLongBuild', status: futuresLong, weight: 15 }
  ];

  let ceScore = 0;
  let ceTotalWeight = 0;
  ceList.forEach(item => {
    if (criteria.ce[item.key] !== false) {
      ceTotalWeight += item.weight;
      if (item.status) {
        ceScore += item.weight;
      }
    }
  });
  const ceProb = ceTotalWeight > 0 ? Math.round((ceScore / ceTotalWeight) * 100) : 0;

  // PE checklist dynamic scoring
  const peList = [
    { key: 'marketStructure', status: structure?.trend === 'BEARISH', weight: 20 },
    { key: 'priceBelowVWAP', status: niftySpot < vwap, weight: 10 },
    { key: 'ema20BelowEma50', status: ema20 && ema50 && ema20 < ema50, weight: 10 },
    { key: 'supportBreakdown', status: support && niftySpot < support, weight: 15 },
    { key: 'sellingVolumeAbove150', status: volumeOk, weight: 10 },
    { key: 'futuresShortBuild', status: futuresShort, weight: 15 }
  ];

  let peScore = 0;
  let peTotalWeight = 0;
  peList.forEach(item => {
    if (criteria.pe[item.key] !== false) {
      peTotalWeight += item.weight;
      if (item.status) {
        peScore += item.weight;
      }
    }
  });
  const peProb = peTotalWeight > 0 ? Math.round((peScore / peTotalWeight) * 100) : 0;

  // Trade triggers if dynamic probability is 50% or above
  const cePass = ceProb >= 50;
  const pePass = peProb >= 50;

  return {
    cePass,
    pePass,
    ceProb,
    peProb,
    details: { volumeOk, futuresLong, futuresShort }
  };
}
