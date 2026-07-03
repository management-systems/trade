import EventEmitter from 'events';
import angelOneService from './angelone.js';
import scripMaster from './scripMaster.js';
import { config } from '../config.js';

class OptionChainService extends EventEmitter {
  constructor() {
    super();
    this.optionData = new Map(); // token -> latest tick info
    this.subscribedTokens = new Set();
  }

  async initialize() {
    // Ensure scrip master is loaded (will download if needed)
    await scripMaster.initialize();
    // Listen to generic tick events from AngelOneService
    angelOneService.on('tick', (data) => this._handleTick(data));
  }

  // Subscribe to a specific expiry and strike range (number of strikes either side of ATM)
  async subscribeOptionChain({ expiryDate = null, strikeDelta = 5 } = {}) {
    // Determine ATM based on latest Nifty spot
    const latestSpot = angelOneService.lastLtp?.nifty;
    if (!latestSpot) {
      console.warn('OptionChainService: Nifty spot not available yet.');
      return;
    }
    const atmStrike = Math.round(latestSpot / 50) * 50;
    const strikes = [];
    for (let i = -strikeDelta; i <= strikeDelta; i++) {
      strikes.push(atmStrike + i * 50);
    }

    // Get contracts for the requested expiry (if provided) otherwise nearest expiry
    const contracts = scripMaster.getStrikeContracts('NIFTY', strikes);
    const tokens = [];
    contracts.forEach(c => {
      if (c.ce) tokens.push(c.ce.token);
      if (c.pe) tokens.push(c.pe.token);
    });
    // Also include futures token for completeness
    const fut = scripMaster.getNiftyFutures();
    if (fut) tokens.push(fut.token);

    // Filter tokens not already subscribed
    const newTokens = tokens.filter(t => !this.subscribedTokens.has(t));
    if (newTokens.length === 0) return;

    const subscription = {
      correlationID: 'option_chain_sub',
      action: 1,
      mode: 1,
      exchangeType: 1,
      tokens: newTokens
    };
    this.wsFetch(subscription);
    newTokens.forEach(t => this.subscribedTokens.add(t));
  }

  wsFetch(subscription) {
    if (angelOneService.ws && angelOneService.ws.fetchData) {
      angelOneService.ws.fetchData(subscription);
    } else {
      console.error('OptionChainService: WebSocket not ready for subscription');
    }
  }

  _handleTick(data) {
    const { token } = data;
    if (!this.subscribedTokens.has(token)) return; // ignore unrelated tokens
    const price = parseFloat(data.last_traded_price) > 100000 ? parseFloat(data.last_traded_price) / 100 : parseFloat(data.last_traded_price);
    const oi = data.open_interest ? parseInt(data.open_interest) : null;
    const volume = data.volume ? parseInt(data.volume) : null;
    const iv = data.implied_volatility ? parseFloat(data.implied_volatility) : null;
    const instrument = scripMaster.getScripBySymbol(data.symbol);
    const payload = {
      token,
      instrument,
      price,
      oi,
      volume,
      iv,
      timestamp: Date.now()
    };
    this.optionData.set(token, payload);
    this.emit('optionTick', payload);
  }

  getSnapshot() {
    // Return array of current option data
    return Array.from(this.optionData.values());
  }
}

export default new OptionChainService();
