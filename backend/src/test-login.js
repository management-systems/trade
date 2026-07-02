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
