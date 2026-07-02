import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, '../../scrips_cache.json');

class ScripMasterService {
  constructor() {
    this.tokenMap = new Map(); // Symbol -> Scrip details
    this.isLoaded = false;
  }

  async initialize() {
    console.log("ScripMaster: Initializing master scrip tokens...");
    
    // Check if we have a locally cached filtered file to keep boot times instant
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        this.tokenMap = new Map(Object.entries(cached));
        this.isLoaded = true;
        console.log(`ScripMaster: Loaded ${this.tokenMap.size} symbols from local cache.`);
        // Update master scrip file in background to capture contract rolls
        this.downloadAndProcessInBackground();
        return;
      } catch (e) {
        console.error("ScripMaster: Error reading cached scrips, downloading fresh...", e);
      }
    }

    await this.downloadAndProcess();
  }

  async downloadAndProcess() {
    try {
      console.log("ScripMaster: Downloading master list from Angel One calculator portal...");
      const res = await fetch("https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json");
      if (!res.ok) throw new Error("Failed to download scrip master JSON.");
      
      const list = await res.json();
      console.log(`ScripMaster: Download complete. Parsing ${list.length} scripts...`);
      
      const filtered = {};
      
      list.forEach(item => {
        // Filter only NIFTY & BANKNIFTY options on futures/options segment
        if (
          (item.name === 'NIFTY' || item.name === 'BANKNIFTY') &&
          item.exch_seg === 'NFO' &&
          item.instrumenttype === 'OPTIDX'
        ) {
          const strike = parseFloat(item.strike) / 100;
          const optionType = item.symbol.endsWith('CE') ? 'CE' : 'PE';

          const cleanItem = {
            token: item.token,
            symbol: item.symbol,
            expiry: item.expiry,
            strike: strike,
            optionType: optionType
          };
          
          filtered[item.symbol] = cleanItem;
          this.tokenMap.set(item.symbol, cleanItem);
        }
      });

      // Write cache to filesystem
      fs.writeFileSync(CACHE_FILE, JSON.stringify(filtered, null, 2), 'utf8');
      this.isLoaded = true;
      console.log(`ScripMaster: Successfully parsed and cached ${this.tokenMap.size} option symbols.`);
    } catch (error) {
      console.error("ScripMaster: Download/Parse failed:", error);
    }
  }

  async downloadAndProcessInBackground() {
    setTimeout(() => {
      this.downloadAndProcess().catch(e => console.error("ScripMaster background sync error:", e));
    }, 5000);
  }

  getScripBySymbol(symbol) {
    return this.tokenMap.get(symbol);
  }

  // Find corresponding CE and PE tokens for the active strikes
  getStrikeContracts(indexName, strikes) {
    const contracts = [];
    
    // Sort keys to scan nearest expiries first
    const sortedKeys = Array.from(this.tokenMap.keys());

    strikes.forEach(strike => {
      const ceSymbol = this.findNearestSymbol(indexName, strike, 'CE', sortedKeys);
      const peSymbol = this.findNearestSymbol(indexName, strike, 'PE', sortedKeys);

      contracts.push({
        strike,
        ce: ceSymbol ? this.tokenMap.get(ceSymbol) : null,
        pe: peSymbol ? this.tokenMap.get(peSymbol) : null
      });
    });

    return contracts;
  }

  findNearestSymbol(indexName, strike, optionType, sortedKeys) {
    // Scan cached symbols to find the option matching index, strike, type, and nearest expiry
    let match = null;
    let nearestExpiryDate = Infinity;

    for (const symbol of sortedKeys) {
      const item = this.tokenMap.get(symbol);
      if (
        item.strike === strike &&
        item.optionType === optionType &&
        symbol.startsWith(indexName)
      ) {
        // Parse expiry to get nearest contract
        // Expiry format usually DDMMMYYYY e.g. 26JUL2026
        const expiryTime = new Date(item.expiry).getTime();
        if (!isNaN(expiryTime) && expiryTime < nearestExpiryDate && expiryTime >= Date.now() - 86400000) {
          nearestExpiryDate = expiryTime;
          match = symbol;
        }
      }
    }

    return match;
  }
}

export default new ScripMasterService();
