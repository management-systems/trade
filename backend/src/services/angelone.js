import pkg from 'smartapi-javascript';
import { authenticator } from 'otplib';
import EventEmitter from 'events';
import { config } from '../config.js';

const { SmartAPI, WebSocketV2 } = pkg;

class AngelOneService extends EventEmitter {
  constructor() {
    super();
    this.smartapi = null;
    this.session = null;
    this.ws = null;
    this.isConnected = false;
    this.lastLtp = {
      nifty: null,
      banknifty: null
    };
  }

  // Generates dynamic TOTP and logs in to create API session
  async login({ clientCode, password, apiKey, totpSecret }) {
    const code = clientCode || config.ANGEL_ONE.CLIENT_CODE;
    const pin = password || config.ANGEL_ONE.PASSWORD;
    const key = apiKey || config.ANGEL_ONE.API_KEY;
    const secret = totpSecret || config.ANGEL_ONE.TOTP_SECRET;

    if (!code || !pin || !key || !secret) {
      throw new Error("Missing required credentials for Angel One login.");
    }

    try {
      console.log("AngelOne: Initializing SmartAPI session...");
      this.smartapi = new SmartAPI({ api_key: key });

      // Generate the current 6-digit 2FA token
      const totpToken = authenticator.generate(secret);
      console.log(`AngelOne: Generated TOTP token: ${totpToken}`);

      const sessionData = await this.smartapi.generateSession(code, pin, totpToken);
      
      if (!sessionData || !sessionData.status) {
        throw new Error(sessionData?.message || "Invalid credentials or TOTP error.");
      }

      this.session = sessionData.data;
      console.log("AngelOne: Login successful! Session tokens acquired.");
      this.isConnected = true;

      // Start live market data feed using indices tokens
      await this.startWebSocketFeed(key, code);

      return {
        status: true,
        message: "Successfully connected to Angel One API",
        clientName: this.session.clientname || 'Active User',
        clientCode: code
      };
    } catch (error) {
      this.isConnected = false;
      this.session = null;
      console.error("AngelOne Login Error:", error.message || error);
      throw error;
    }
  }

  async startWebSocketFeed(apiKey, clientCode) {
    if (!this.session) return;

    try {
      console.log("AngelOne WS: Connecting to Live WebSocket feed...");
      this.ws = new WebSocketV2({
        jwttoken: this.session.jwtToken,
        apikey: apiKey,
        clientcode: clientCode,
        feedtype: this.session.feedToken
      });

      await this.ws.connect();
      console.log("AngelOne WS: WebSocket V2 Connected.");

      // Subscribe to Nifty 50 spot (99926000) and Bank Nifty spot (99926009)
      const subscriptionRequest = {
        correlationID: "trading_dashboard_spot",
        action: 1, // 1 for Subscribe
        mode: 1,   // 1 for LTP feed
        exchangeType: 1, // 1 for NSE
        tokens: ["99926000", "99926009"]
      };

      this.ws.fetchData(subscriptionRequest);

      this.ws.on('tick', (data) => {
        if (!data || !data.token) return;

        // Parse prices (Angel One LTP prices are usually in paise, so divide by 100)
        let rawPrice = parseFloat(data.last_traded_price);
        // Sometimes price is returned directly or in paise
        const price = rawPrice > 100000 ? rawPrice / 100 : rawPrice;

        if (data.token === "99926000") {
          this.lastLtp.nifty = price;
          this.emit('spotTick', { index: 'NIFTY', price, timestamp: Date.now() });
        } else if (data.token === "99926009") {
          this.lastLtp.banknifty = price;
          this.emit('spotTick', { index: 'BANKNIFTY', price, timestamp: Date.now() });
        }
      });

      this.ws.on('error', (err) => {
        console.error("AngelOne WS: WebSocket error:", err);
      });

      this.ws.on('close', () => {
        console.log("AngelOne WS: Connection closed.");
        this.isConnected = false;
      });

    } catch (error) {
      console.error("AngelOne WS: Connection initialization failed:", error);
      this.isConnected = false;
    }
  }

  logout() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.session = null;
    this.isConnected = false;
    console.log("AngelOne: Logged out and feed stopped.");
  }

  // Executes standard orders in live mode (requires safety confirmations)
  async placeOrder({ symbol, strike, quantity, transactionType, optionType }) {
    if (!this.isConnected || !this.smartapi) {
      throw new Error("Angel One session not active. Please authenticate first.");
    }

    try {
      console.log(`AngelOne: Placing real order -> ${transactionType} ${quantity} shares of NIFTY ${strike} ${optionType}`);
      
      const orderParams = {
        variety: "NORMAL",
        tradingsymbol: symbol,
        symboltoken: "", // Standard empty if tradingsymbol is unique or populated from instrument master
        transactiontype: transactionType, // BUY or SELL
        exchange: "NFO", // Nifty Options reside on National Futures & Options
        ordertype: "MARKET",
        producttype: "CARRYFORWARD", // or INTRADAY
        duration: "DAY",
        price: "0", // Market order requires price 0
        quantity: quantity.toString()
      };

      const result = await this.smartapi.placeOrder(orderParams);
      console.log("AngelOne: Real order execution result:", result);
      return result;
    } catch (error) {
      console.error("AngelOne: Live order placement failed:", error);
      throw error;
    }
  }

  async getMarketQuotes(tokens) {
    if (!this.isConnected || !this.smartapi) return null;
    try {
      const response = await this.smartapi.getMarketData("FULL", { "NFO": tokens });
      if (response && response.status && response.data) {
        return response.data.fetched || [];
      }
    } catch (e) {
      console.error("AngelOne: Fetching market quotes failed:", e.message || e);
    }
    return null;
  }
}

export default new AngelOneService();
