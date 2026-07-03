import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '../../auto_trade_config.json');

let state = {
  liveEnabled: false,
  params: {
    lots: 1,
    stopLossPct: 2,
    profitPct: 3
  },
  criteria: {
    ce: {
      betterModel: false,
      bullishStructure: false,
      priceAboveVWAP: false,
      resistanceBreakout: false,
      volumeAbove150: false,
      futuresLongBuild: false
    },
    pe: {
      marketStructure: false,
      priceBelowVWAP: false,
      ema20BelowEma50: false,
      supportBreakdown: false,
      sellingVolumeAbove150: false,
      futuresShortBuild: false
    }
  }
};

// Load initial config from file if it exists
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const fileData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      
      if (fileData.liveEnabled !== undefined) state.liveEnabled = !!fileData.liveEnabled;
      if (fileData.params) {
        state.params = { ...state.params, ...fileData.params };
      }
      if (fileData.criteria) {
        state.criteria = {
          ce: { ...state.criteria.ce, ...fileData.criteria.ce },
          pe: { ...state.criteria.pe, ...fileData.criteria.pe }
        };
      }
      console.log("AutoTradeState: Config loaded from file successfully.");
    } else {
      saveConfig();
    }
  } catch (error) {
    console.error("AutoTradeState: Error loading config file:", error);
  }
}

// Save config to file
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error("AutoTradeState: Error saving config file:", error);
  }
}

// Initial load
loadConfig();

export function isAutoTradeEnabled() {
  return state.liveEnabled;
}

export function setAutoTradeEnabled(value) {
  state.liveEnabled = !!value;
  saveConfig();
}

export function getAutoTradeParams() {
  return { ...state.params };
}

export function setAutoTradeParams(params) {
  if (typeof params.lots === 'number') state.params.lots = params.lots;
  if (typeof params.stopLossPct === 'number') state.params.stopLossPct = params.stopLossPct;
  if (typeof params.profitPct === 'number') state.params.profitPct = params.profitPct;
  saveConfig();
}

export function getAutoTradeCriteria() {
  return {
    ce: { ...state.criteria.ce },
    pe: { ...state.criteria.pe }
  };
}

export function setAutoTradeCriteria(criteria) {
  if (criteria) {
    if (criteria.ce) state.criteria.ce = { ...state.criteria.ce, ...criteria.ce };
    if (criteria.pe) state.criteria.pe = { ...state.criteria.pe, ...criteria.pe };
    saveConfig();
  }
}
