import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  PORT: process.env.PORT || 5072,
  DB_PATH: path.join(__dirname, '../db.json'),
  
  // Paper Trading Configuration
  STARTING_BALANCE: 100000, // ₹1,00,000 virtual balance
  NIFTY_LOT_SIZE: 65,       // Updated Nifty lot size
  DEFAULT_SL_POINTS: 15,     // default Stop Loss in option premium points
  DEFAULT_TARGET_POINTS: 30, // default Target in option premium points
  
  // Technical Analysis Configuration
  INDICATORS: {
    EMA_FAST: 20,
    EMA_SLOW: 50,
    VOLUME_MA_PERIOD: 10,
    SUPPORT_RESISTANCE_PERIOD: 30, // candles to evaluate high/low
  },
  
  // Risk Management Default Limits
  RISK: {
    MAX_TRADES_PER_DAY: 3,
    MAX_LOSS_PER_DAY: 1000, // ₹1000 daily loss limit
  },
  
  // Angel One SmartAPI Details
  ANGEL_ONE: {
    CLIENT_CODE: process.env.ANGEL_ONE_CLIENT_CODE || '',
    PASSWORD: process.env.ANGEL_ONE_PASSWORD || '',
    API_KEY: process.env.ANGEL_ONE_API_KEY || '',
    TOTP_SECRET: process.env.ANGEL_ONE_TOTP_SECRET || '',
    FEED_TYPE: 'mktdatalong'
  },
  // Option Chain Settings
  OPTION_CHAIN: {
    SCRIP_MASTER_URL: "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
    DEFAULT_EXPIRY_DAYS_AHEAD: 3
  }
};
