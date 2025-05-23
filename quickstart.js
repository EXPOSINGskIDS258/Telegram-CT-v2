#!/usr/bin/env node
// quickstart.js - Automated setup and launch for CrestX

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Banner
function displayWelcome() {
  console.clear();
  console.log(`
${colors.bright}${colors.cyan}
   ██████╗██████╗ ███████╗███████╗████████╗██╗  ██╗
  ██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝╚██╗██╔╝
  ██║     ██████╔╝█████╗  ███████╗   ██║    ╚███╔╝ 
  ██║     ██╔══██╗██╔══╝  ╚════██║   ██║    ██╔██╗ 
  ╚██████╗██║  ██║███████╗███████║   ██║   ██╔╝ ██╗
   ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝
${colors.reset}
  ${colors.bright}Welcome to CrestX - Solana Memecoin Trading Bot${colors.reset}
  ${colors.yellow}Quick Start Setup Wizard${colors.reset}
`);
}

// Check prerequisites
async function checkPrerequisites() {
  console.log(`\n${colors.cyan}Checking prerequisites...${colors.reset}`);
  
  const checks = {
    node: false,
    npm: false,
    env: false,
    data: false
  };
  
  // Check Node.js version
  try {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.split('.')[0].substring(1));
    if (major >= 18) {
      checks.node = true;
      console.log(`${colors.green}✓${colors.reset} Node.js ${nodeVersion} installed`);
    } else {
      console.log(`${colors.red}✗${colors.reset} Node.js version 18+ required (found ${nodeVersion})`);
    }
  } catch (err) {
    console.log(`${colors.red}✗${colors.reset} Node.js not found`);
  }
  
  // Check npm
  try {
    const npm = await runCommand('npm', ['--version']);
    checks.npm = true;
    console.log(`${colors.green}✓${colors.reset} npm installed`);
  } catch (err) {
    console.log(`${colors.red}✗${colors.reset} npm not found`);
  }
  
  // Check for existing .env
  if (fs.existsSync('.env')) {
    checks.env = true;
    console.log(`${colors.green}✓${colors.reset} Configuration file exists`);
  } else {
    console.log(`${colors.yellow}!${colors.reset} No configuration file found (will create)`);
  }
  
  // Check data directory
  if (fs.existsSync('data')) {
    checks.data = true;
    console.log(`${colors.green}✓${colors.reset} Data directory exists`);
  } else {
    fs.mkdirSync('data', { recursive: true });
    checks.data = true;
    console.log(`${colors.green}✓${colors.reset} Created data directory`);
  }
  
  return checks;
}

// Install dependencies
async function installDependencies() {
  console.log(`\n${colors.cyan}Installing dependencies...${colors.reset}`);
  
  try {
    await runCommand('npm', ['install'], true);
    console.log(`${colors.green}✓${colors.reset} Dependencies installed successfully`);
    return true;
  } catch (err) {
    console.log(`${colors.red}✗${colors.reset} Failed to install dependencies`);
    return false;
  }
}

// Quick configuration with validation
async function quickConfig() {
  console.log(`\n${colors.cyan}Quick Configuration${colors.reset}`);
  console.log(`${colors.yellow}We'll set up the essentials to get you started${colors.reset}\n`);
  
  const config = {
    // Telegram
    API_ID: await ask('Telegram API ID: '),
    API_HASH: await ask('Telegram API Hash: '),
    
    // Trading mode
    DRY_RUN: await askYesNo('Start in Paper Trading mode?', true) ? 'true' : 'false',
    
    // NEW: Fixed dollar amount with validation
    TRADE_AMOUNT_USD: await askTradeAmount(),
    
    // Channels
    USE_PREMIUM: await askYesNo('Use premium trading channels (recommended)?', true),
    
    // Basic settings (keep percentage as fallback)
    MAX_TRADE_PERCENT: '5',
    USE_TRAILING_STOP: 'true',
    TRAILING_STOP_PERCENT: '20',
    ENABLE_SAFETY_CHECKS: 'true',
    MIN_LIQUIDITY_USD: '5000',
    
    // Defaults
    DEFAULT_SLIPPAGE: '3',
    EXIT_SLIPPAGE: '5',
    MAX_PRICE_IMPACT: '10',
    MIN_TOKEN_AGE_SECONDS: '300',
    DRY_RUN_BALANCE: '1000',
    DRY_RUN_PRICE_VOLATILITY: '5',
    RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com'
  };
  
  // Show trade amount explanation
  console.log(`\n${colors.green}💰 Trade Amount Set: ${config.TRADE_AMOUNT_USD} per trade${colors.reset}`);
  console.log(`   • Fixed dollar amount for consistent risk`);
  console.log(`   • Easy to understand and control`);
  console.log(`   • No percentage calculations needed`);
  
  // Set channels
  if (config.USE_PREMIUM) {
    config.TELEGRAM_CHANNEL_IDS = '-1002209371269,-1002277274250';
    console.log(`\n${colors.green}Premium channels configured:${colors.reset}`);
    console.log('  🔥 Underdog Calls Private');
    console.log('  💎 Degen Channel');
  } else {
    const customChannels = await ask('\nEnter channel IDs (comma-separated): ');
    config.TELEGRAM_CHANNEL_IDS = customChannels;
  }
  
  // Live trading setup
  if (config.DRY_RUN === 'false') {
    console.log(`\n${colors.yellow}⚠️  Live Trading Configuration${colors.reset}`);
    console.log(`${colors.red}Only proceed if you understand the risks!${colors.reset}\n`);
    
    config.WALLET_PRIVATE_KEY = await ask('Wallet private key (hex): ');
    
    const customRpc = await askYesNo('Use custom RPC endpoint?', false);
    if (customRpc) {
      config.RPC_ENDPOINT = await ask('RPC Endpoint URL: ');
    }
  }
  
  return config;
}

// New function to ask for trade amount with validation
async function askTradeAmount() {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const input = await ask('How much money per trade in USD [20]: ');
    
    // If they press enter without typing anything, use default
    if (!input.trim()) {
      console.log(`${colors.green}✅ Using default amount: $20${colors.reset}`);
      return '20';
    }
    
    // Validate the input
    const amount = parseFloat(input.trim());
    
    if (isNaN(amount)) {
      console.log(`${colors.red}❌ Invalid input! Please enter a valid number.${colors.reset}`);
      console.log(`${colors.yellow}💡 Example: 20, 50, 100${colors.reset}`);
      continue;
    }
    
    if (amount <= 0) {
      console.log(`${colors.red}❌ Amount must be greater than $0!${colors.reset}`);
      console.log(`${colors.yellow}💡 Enter a positive dollar amount like 20 or 50${colors.reset}`);
      continue;
    }
    
    if (amount < 1) {
      console.log(`${colors.red}❌ Minimum trade amount is $1!${colors.reset}`);
      console.log(`${colors.yellow}💡 Use at least $1 per trade for realistic trading${colors.reset}`);
      continue;
    }
    
    if (amount > 10000) {
      console.log(`${colors.red}❌ Maximum trade amount is $10,000!${colors.reset}`);
      console.log(`${colors.yellow}💡 For safety, please use a smaller amount${colors.reset}`);
      continue;
    }
    
    // Valid amount
    console.log(`${colors.green}✅ Trade amount set: ${amount}${colors.reset}`);
    return amount.toString();
  }
  
  // If all attempts failed, use default
  console.log(`\n${colors.red}❌ Failed to set trade amount after 3 attempts.${colors.reset}`);
  console.log(`${colors.yellow}🔄 Using default amount: $20${colors.reset}`);
  return '20';
}

// Save configuration
function saveConfig(config) {
  let envContent = `# CrestX Configuration
# Generated by Quick Start on ${new Date().toLocaleString()}

# TELEGRAM SETTINGS
API_ID=${config.API_ID}
API_HASH=${config.API_HASH}
TELEGRAM_CHANNEL_IDS=${config.TELEGRAM_CHANNEL_IDS}

# TRADING SETTINGS
DRY_RUN=${config.DRY_RUN}
TRADE_AMOUNT_USD=${config.TRADE_AMOUNT_USD}
MAX_TRADE_PERCENT=${config.MAX_TRADE_PERCENT}
USE_TRAILING_STOP=${config.USE_TRAILING_STOP}
TRAILING_STOP_PERCENT=${config.TRAILING_STOP_PERCENT}

# SAFETY SETTINGS
DEFAULT_SLIPPAGE=${config.DEFAULT_SLIPPAGE}
EXIT_SLIPPAGE=${config.EXIT_SLIPPAGE}
MIN_LIQUIDITY_USD=${config.MIN_LIQUIDITY_USD}
MAX_PRICE_IMPACT=${config.MAX_PRICE_IMPACT}
ENABLE_SAFETY_CHECKS=${config.ENABLE_SAFETY_CHECKS}
MIN_TOKEN_AGE_SECONDS=${config.MIN_TOKEN_AGE_SECONDS}

# PAPER TRADING SETTINGS
DRY_RUN_BALANCE=${config.DRY_RUN_BALANCE}
DRY_RUN_PRICE_VOLATILITY=${config.DRY_RUN_PRICE_VOLATILITY}

# SOLANA SETTINGS
RPC_ENDPOINT=${config.RPC_ENDPOINT}
${config.WALLET_PRIVATE_KEY ? `WALLET_PRIVATE_KEY=${config.WALLET_PRIVATE_KEY}` : '# WALLET_PRIVATE_KEY=your_key_here'}

# NOTIFICATION SETTINGS
ENABLE_NOTIFICATIONS=false
# NOTIFICATION_CHAT_ID=
# TELEGRAM_BOT_TOKEN=

# ADVANCED SETTINGS
MONITOR_INTERVAL_MS=10000
ERROR_RETRY_DELAY_MS=5000
MAX_RETRIES=3
LOG_LEVEL=info
`;
  
  fs.writeFileSync('.env', envContent);
  console.log(`\n${colors.green}✓${colors.reset} Configuration saved to .env`);
}

// Launch bot
async function launchBot() {
  console.log(`\n${colors.cyan}Launching CrestX...${colors.reset}\n`);
  
  return new Promise((resolve) => {
    const bot = spawn('node', ['index.js'], {
      stdio: 'inherit',
      shell: true
    });
    
    bot.on('exit', (code) => {
      resolve(code);
    });
  });
}

// Helper functions
function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function askYesNo(question, defaultYes = true) {
  const answer = await ask(`${question} [${defaultYes ? 'Y/n' : 'y/N'}]: `);
  if (!answer) return defaultYes;
  return answer.toLowerCase()[0] === 'y';
}

function runCommand(command, args, showOutput = false) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: showOutput ? 'inherit' : 'pipe',
      shell: true
    });
    
    let output = '';
    
    if (!showOutput) {
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        output += data.toString();
      });
    }
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
}

// Main execution
async function main() {
  displayWelcome();
  
  try {
    // Check prerequisites
    const checks = await checkPrerequisites();
    
    if (!checks.node || !checks.npm) {
      console.log(`\n${colors.red}Missing prerequisites. Please install Node.js 18+ and npm.${colors.reset}`);
      process.exit(1);
    }
    
    // Install dependencies if needed
    if (!fs.existsSync('node_modules')) {
      const install = await askYesNo('\nInstall dependencies?', true);
      if (install) {
        const success = await installDependencies();
        if (!success) {
          console.log(`\n${colors.red}Failed to install dependencies. Please run 'npm install' manually.${colors.reset}`);
          process.exit(1);
        }
      }
    }
    
    // Configuration
    if (!checks.env) {
      console.log(`\n${colors.yellow}No configuration found. Let's set up CrestX!${colors.reset}`);
      const config = await quickConfig();
      saveConfig(config);
    } else {
      const reconfigure = await askYesNo('\nConfiguration exists. Reconfigure?', false);
      if (reconfigure) {
        const config = await quickConfig();
        saveConfig(config);
      }
    }
    
    // Launch
    console.log(`\n${colors.bright}${colors.green}Setup complete!${colors.reset}`);
    const launch = await askYesNo('\nLaunch CrestX now?', true);
    
    if (launch) {
      rl.close();
      await launchBot();
    } else {
      console.log(`\n${colors.cyan}To start CrestX later, run:${colors.reset} npm start`);
      rl.close();
    }
    
  } catch (err) {
    console.error(`\n${colors.red}Error: ${err.message}${colors.reset}`);
    rl.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { quickConfig, saveConfig };