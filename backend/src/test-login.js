import scripMaster from './services/scripMaster.js';
import angelOneService from './services/angelone.js';
import dotenv from 'dotenv';

dotenv.config();

console.log("=== Testing Angel One SmartAPI Login ===");
console.log(`Client Code: ${process.env.ANGEL_ONE_CLIENT_CODE}`);
console.log(`API Key: ${process.env.ANGEL_ONE_API_KEY}`);
console.log(`TOTP Secret Length: ${process.env.ANGEL_ONE_TOTP_SECRET ? process.env.ANGEL_ONE_TOTP_SECRET.length : 0} chars`);

async function testConnection() {
  try {
    const result = await angelOneService.login({
      clientCode: process.env.ANGEL_ONE_CLIENT_CODE,
      password: process.env.ANGEL_ONE_PASSWORD,
      apiKey: process.env.ANGEL_ONE_API_KEY,
      totpSecret: process.env.ANGEL_ONE_TOTP_SECRET
    });

    console.log("\n✔ CONNECTION SUCCESSFUL!");
    console.log(`Client Name: ${result.clientName}`);
    console.log(`Status Message: ${result.message}`);
    
    // Load scrips and query an active options contract token
    console.log("Initializing Scrip Master cache...");
    await scripMaster.initialize();
    
    // Get a valid Nifty Strike option (e.g. 24000 CE)
    const contracts = scripMaster.getStrikeContracts('NIFTY', [24000]);
    if (contracts && contracts.length > 0 && contracts[0].ce) {
      const targetToken = contracts[0].ce.token;
      const targetSymbol = contracts[0].ce.symbol;
      console.log(`\nFetching sample market quote for NIFTY Option contract (Token ${targetToken}, Symbol ${targetSymbol})...`);
      const quotes = await angelOneService.getMarketQuotes([targetToken]);
      console.log("Quote response:", JSON.stringify(quotes));
    } else {
      console.log("\nNo active NIFTY 24000 CE contract found in cache.");
    }

    // Disconnect so the script exits
    angelOneService.logout();
    process.exit(0);
  } catch (error) {
    console.error("\n✘ CONNECTION FAILED!");
    console.error("Error Message:", error.message || error);
    console.error("\nTroubleshooting tips:");
    console.error("1. Ensure your system clock is synchronized automatically with internet time.");
    console.error("2. Double-check that your API Key and Client Code are exactly correct.");
    console.error("3. Verify that your TOTP Secret key is correct (did you scan the QR / copy it correctly?).");
    process.exit(1);
  }
}

testConnection();
