// setup.js - Interactive configuration wizard for CrestX
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Default config values
const defaultConfig = {
  API_ID: '',
  API_HASH: '',
  TELEGRAM_CHANNEL_IDS: '',
  DRY_RUN: 'true',
  MAX_TRADE_PERCENT: '5',
  USE_TRAILING_STOP: 'true',
  TRAILING_STOP_PERCENT: '20',
  DEFAULT_SLIPPAGE: '3',
  EXIT_SLIPPAGE: '5',
  MIN_LIQUIDITY_USD: '5000',
  MAX_PRICE_IMPACT: '10',
  ENABLE_SAFETY_CHECKS: 'true',
  DRY_RUN_BALANCE: '1000',
  DRY_RUN_PRICE_VOLATILITY: '5',
  RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com'
};

// Load existing config if available
function loadExistingConfig() {
  try {
    if (fs.existsSync('.env')) {
      const envContent = fs.readFileSync('.env', 'utf8');
      const config = {};
      
      envContent.split('\n').forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
          const [key, value] = line.split('=');
          if (key && value) {
            config[key.trim()] = value.trim();
          }
        }
      });
      
      return config;
    }
  } catch (err) {
    console.error('Error loading existing config:', err);
  }
  
  return {};
}

// Display welcome banner
function displayWelcomeBanner() {
  console.clear();
  console.log(`
\x1b[37m██████╗██████╗ ███████╗███████╗████████╗██╗  ██╗\x1b[0m
\x1b[37m██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝╚██╗██╔╝\x1b[0m
\x1b[37m██║     ██████╔╝█████╗  ███████╗   ██║    ╚███╔╝ \x1b[0m
\x1b[37m██║     ██╔══██╗██╔══╝  ╚════██║   ██║    ██╔██╗ \x1b[0m
\x1b[37m╚██████╗██║  ██║███████╗███████║   ██║   ██╔╝ ██╗\x1b[0m
\x1b[37m ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝\x1b[0m
\x1b[1m\x1b[37m═════════ SOLANA MEMECOIN TRADER SETUP ═════════\x1b[0m
`);
}

// Main setup function
async function setup() {
  displayWelcomeBanner();
  
  // Load existing config
  const existingConfig = loadExistingConfig();
  const config = { ...defaultConfig, ...existingConfig };
  
  console.log('\n\x1b[1m\x1b[36mWelcome to CrestX Memecoin Trader Setup\x1b[0m');
  console.log('\x1b[90mThis wizard will help you configure your trading bot.\x1b[0m');
  console.log('\x1b[90mPress Enter to keep existing/default values shown in [brackets].\x1b[0m\n');
  
  // Telegram configuration
  console.log('\n\x1b[1m\x1b[37m=== Telegram Configuration ===\x1b[0m');
  
  config.API_ID = await askQuestion(`Enter Telegram API ID [${config.API_ID || 'not set'}]: `, config.API_ID);
  config.API_HASH = await askQuestion(`Enter Telegram API Hash [${config.API_HASH ? '******' : 'not set'}]: `, config.API_HASH);
  config.TELEGRAM_CHANNEL_IDS = await askQuestion(`Enter Telegram Channel IDs (comma-separated) [${config.TELEGRAM_CHANNEL_IDS || 'not set'}]: `, config.TELEGRAM_CHANNEL_IDS);
  
  // Trading parameters
  console.log('\n\x1b[1m\x1b[37m=== Trading Parameters ===\x1b[0m');
  
  config.DRY_RUN = await askYesNo('Enable paper trading mode (no real trades)', config.DRY_RUN === 'true');
  config.MAX_TRADE_PERCENT = await askQuestion(`Maximum percentage of balance per trade [${config.MAX_TRADE_PERCENT}%]: `, config.MAX_TRADE_PERCENT);
  config.USE_TRAILING_STOP = await askYesNo('Enable trailing stop loss', config.USE_TRAILING_STOP === 'true');
  
  if (config.USE_TRAILING_STOP === 'true') {
    config.TRAILING_STOP_PERCENT = await askQuestion(`Trailing stop percentage [${config.TRAILING_STOP_PERCENT}%]: `, config.TRAILING_STOP_PERCENT);
  }
  
  // Advanced settings (optional)
  const showAdvanced = await askYesNo('Configure advanced settings', false);
  
  if (showAdvanced) {
    console.log('\n\x1b[1m\x1b[37m=== Advanced Settings ===\x1b[0m');
    
    config.DEFAULT_SLIPPAGE = await askQuestion(`Default slippage percentage [${config.DEFAULT_SLIPPAGE}%]: `, config.DEFAULT_SLIPPAGE);
    config.EXIT_SLIPPAGE = await askQuestion(`Exit slippage percentage [${config.EXIT_SLIPPAGE}%]: `, config.EXIT_SLIPPAGE);
    config.MIN_LIQUIDITY_USD = await askQuestion(`Minimum liquidity in USD [${config.MIN_LIQUIDITY_USD}]: `, config.MIN_LIQUIDITY_USD);
    config.MAX_PRICE_IMPACT = await askQuestion(`Maximum price impact [${config.MAX_PRICE_IMPACT}%]: `, config.MAX_PRICE_IMPACT);
    config.ENABLE_SAFETY_CHECKS = await askYesNo('Enable safety checks', config.ENABLE_SAFETY_CHECKS === 'true');
    
    if (config.DRY_RUN === 'true') {
      config.DRY_RUN_BALANCE = await askQuestion(`Paper trading balance in USDC [${config.DRY_RUN_BALANCE}]: `, config.DRY_RUN_BALANCE);
      config.DRY_RUN_PRICE_VOLATILITY = await askQuestion(`Price volatility for simulation [${config.DRY_RUN_PRICE_VOLATILITY}%]: `, config.DRY_RUN_PRICE_VOLATILITY);
    }
    
    if (config.DRY_RUN !== 'true') {
      config.RPC_ENDPOINT = await askQuestion(`Solana RPC endpoint [${config.RPC_ENDPOINT}]: `, config.RPC_ENDPOINT);
      config.WALLET_PRIVATE_KEY = await askQuestion(`Wallet private key (hex) [${config.WALLET_PRIVATE_KEY ? '******' : 'not set'}]: `, config.WALLET_PRIVATE_KEY);
    }
  }
  
  // Generate .env file
  await saveConfig(config);
  
  console.log('\n\x1b[1m\x1b[32mConfiguration saved successfully!\x1b[0m');
  console.log('\x1b[1mYou can now start the bot with:\x1b[0m npm start\n');
  
  rl.close();
}

// Ask a question and return the answer
function askQuestion(question, defaultValue = '') {
  return new Promise(resolve => {
    rl.question(question, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Ask a yes/no question
async function askYesNo(question, defaultValue = false) {
  const defaultText = defaultValue ? 'Y/n' : 'y/N';
  const answer = await askQuestion(`${question}? [${defaultText}]: `);
  
  if (!answer) {
    return defaultValue ? 'true' : 'false';
  }
  
  return answer.toLowerCase()[0] === 'y' ? 'true' : 'false';
}

// Save config to .env file
async function saveConfig(config) {
  let envContent = '';
  
  // Add header
  envContent += '# CRESTX MEMECOIN TRADER CONFIGURATION\n';
  envContent += '# Generated on ' + new Date().toLocaleString() + '\n\n';
  
  // Add Telegram settings
  envContent += '# TELEGRAM SETTINGS\n';
  envContent += `API_ID=${config.API_ID}\n`;
  envContent += `API_HASH=${config.API_HASH}\n`;
  envContent += `TELEGRAM_CHANNEL_IDS=${config.TELEGRAM_CHANNEL_IDS}\n\n`;
  
  // Add trading settings
  envContent += '# TRADING SETTINGS\n';
  envContent += `DRY_RUN=${config.DRY_RUN}\n`;
  envContent += `MAX_TRADE_PERCENT=${config.MAX_TRADE_PERCENT}\n`;
  envContent += `USE_TRAILING_STOP=${config.USE_TRAILING_STOP}\n`;
  envContent += `TRAILING_STOP_PERCENT=${config.TRAILING_STOP_PERCENT}\n\n`;
  
  // Add safety settings
  envContent += '# SAFETY SETTINGS\n';
  envContent += `DEFAULT_SLIPPAGE=${config.DEFAULT_SLIPPAGE}\n`;
  envContent += `EXIT_SLIPPAGE=${config.EXIT_SLIPPAGE}\n`;
  envContent += `MIN_LIQUIDITY_USD=${config.MIN_LIQUIDITY_USD}\n`;
  envContent += `MAX_PRICE_IMPACT=${config.MAX_PRICE_IMPACT}\n`;
  envContent += `ENABLE_SAFETY_CHECKS=${config.ENABLE_SAFETY_CHECKS}\n\n`;
  
  // Add paper trading settings
  envContent += '# PAPER TRADING SETTINGS\n';
  envContent += `DRY_RUN_BALANCE=${config.DRY_RUN_BALANCE}\n`;
  envContent += `DRY_RUN_PRICE_VOLATILITY=${config.DRY_RUN_PRICE_VOLATILITY}\n\n`;
  
  // Add Solana settings
  envContent += '# SOLANA SETTINGS\n';
  envContent += `RPC_ENDPOINT=${config.RPC_ENDPOINT}\n`;
  
  if (config.WALLET_PRIVATE_KEY) {
    envContent += `WALLET_PRIVATE_KEY=${config.WALLET_PRIVATE_KEY}\n`;
  }
  
  // Save to file
  fs.writeFileSync('.env', envContent);
}

// Run setup
setup().catch(err => {
  console.error('Setup error:', err);
  rl.close();
});