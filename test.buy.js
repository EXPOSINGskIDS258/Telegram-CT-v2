#!/usr/bin/env node
// test-buy.js - Test script for buy function
require('dotenv').config();

const { displayBanner } = require('./banner');
const exchangeClient = require('./exchangeClient');
const config = require('./config');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

// Test token addresses (well-known Solana tokens for testing)
const TEST_TOKENS = {
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',  // BONK token
  'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',   // Dogwifhat
  'PEPE': 'BzPjYNJgkJMa6uB8CxSaWqG8KjDfvYRFNmHRPBNs7YKM',  // PEPE (example)
  'CUSTOM': null // User can input custom address
};

async function displayTestMenu() {
  console.clear();
  log(displayBanner(config));
  
  log('\n🧪 CrestX Buy Function Test Suite', colors.bright);
  log('═'.repeat(50), colors.cyan);
  
  const mode = config.DRY_RUN ? 'PAPER TRADING' : 'LIVE TRADING';
  const modeColor = config.DRY_RUN ? colors.yellow : colors.red;
  log(`\n📊 Current Mode: ${modeColor}${mode}${colors.reset}`, colors.bright);
  
  if (!config.DRY_RUN) {
    log('\n⚠️  WARNING: LIVE TRADING MODE ACTIVE!', colors.red);
    log('This will use REAL money from your wallet!', colors.red);
    log('Only proceed if you understand the risks.', colors.red);
  } else {
    log('\n✅ Safe Mode: Using paper trading simulation', colors.green);
    log(`Virtual Balance: $${config.DRY_RUN_BALANCE}`, colors.green);
  }
}

async function selectTestToken() {
  log('\n🎯 Select Test Token:', colors.cyan);
  log('1. BONK (Popular memecoin)');
  log('2. WIF (Dogwifhat)'); 
  log('3. PEPE (Example token)');
  log('4. Custom token address');
  log('5. Back to main menu');
  
  const choice = await askQuestion('\nEnter your choice (1-5): ');
  
  switch(choice) {
    case '1':
      return { symbol: 'BONK', address: TEST_TOKENS.BONK };
    case '2':
      return { symbol: 'WIF', address: TEST_TOKENS.WIF };
    case '3':
      return { symbol: 'PEPE', address: TEST_TOKENS.PEPE };
    case '4':
      const customAddress = await askQuestion('Enter token mint address: ');
      if (!customAddress || customAddress.length < 32) {
        log('❌ Invalid token address', colors.red);
        return null;
      }
      return { symbol: 'CUSTOM', address: customAddress };
    case '5':
      return null;
    default:
      log('❌ Invalid choice', colors.red);
      return null;
  }
}

async function testGetBalance() {
  log('\n💰 Testing Balance Check...', colors.cyan);
  
  try {
    const balance = await exchangeClient.getAccountBalance();
    log(`✅ Balance: $${balance.toFixed(2)} USDC`, colors.green);
    return balance;
  } catch (error) {
    log(`❌ Balance check failed: ${error.message}`, colors.red);
    return null;
  }
}

async function testTokenSafety(tokenAddress, tokenSymbol) {
  log(`\n🛡️  Testing Token Safety for ${tokenSymbol}...`, colors.cyan);
  
  try {
    const safety = await exchangeClient.checkTokenSafety(tokenAddress);
    
    if (safety.safe) {
      log(`✅ Token safety check passed`, colors.green);
      if (safety.liquidity) {
        log(`   💧 Liquidity: $${safety.liquidity.toFixed(2)}`, colors.blue);
      }
      if (safety.priceImpact !== null) {
        log(`   📊 Price Impact: ${(safety.priceImpact * 100).toFixed(2)}%`, colors.blue);
      }
    } else {
      log(`⚠️  Token safety concerns:`, colors.yellow);
      log(`   Reason: ${safety.reason}`, colors.yellow);
    }
    
    return safety;
  } catch (error) {
    log(`❌ Safety check failed: ${error.message}`, colors.red);
    return { safe: false, reason: error.message };
  }
}

async function testGetPrice(tokenAddress, tokenSymbol) {
  log(`\n💵 Testing Price Retrieval for ${tokenSymbol}...`, colors.cyan);
  
  try {
    const price = await exchangeClient.getCurrentPrice(tokenAddress);
    log(`✅ Current Price: $${price.toFixed(8)}`, colors.green);
    return price;
  } catch (error) {
    log(`❌ Price retrieval failed: ${error.message}`, colors.red);
    return null;
  }
}

async function testBuyFunction(tokenAddress, tokenSymbol, amount) {
  log(`\n🔄 Testing Buy Function for ${tokenSymbol}...`, colors.cyan);
  log(`Amount: $${amount} USDC`, colors.blue);
  
  if (!config.DRY_RUN) {
    log('\n⚠️  FINAL WARNING: This will execute a REAL trade!', colors.red);
    const confirm = await askQuestion('Type "CONFIRM" to proceed with live trading: ');
    if (confirm !== 'CONFIRM') {
      log('❌ Trade cancelled by user', colors.yellow);
      return null;
    }
  }
  
  try {
    log('📡 Executing buy order...', colors.yellow);
    const result = await exchangeClient.buyMarket(tokenAddress, amount);
    
    if (result.success) {
      log('✅ Buy order successful!', colors.green);
      log(`   📊 Trade ID: ${result.id}`, colors.blue);
      log(`   💰 Filled Price: $${result.filledPrice.toFixed(8)}`, colors.blue);
      log(`   🪙 Amount Out: ${result.amountOut.toFixed(6)} tokens`, colors.blue);
      
      if (config.DRY_RUN) {
        log('   🧪 [SIMULATION] No real funds were used', colors.yellow);
      }
      
      return result;
    } else {
      log(`❌ Buy order failed: ${result.error || 'Unknown error'}`, colors.red);
      return null;
    }
  } catch (error) {
    log(`❌ Buy function error: ${error.message}`, colors.red);
    return null;
  }
}

async function testFullBuyFlow() {
  const token = await selectTestToken();
  if (!token) return;
  
  log(`\n🎯 Testing Full Buy Flow for ${token.symbol}`, colors.bright);
  log('═'.repeat(40), colors.cyan);
  
  // Step 1: Check balance
  const balance = await testGetBalance();
  if (balance === null) {
    log('❌ Cannot proceed without balance information', colors.red);
    return;
  }
  
  if (balance < 1) {
    log('❌ Insufficient balance for testing (minimum $1 required)', colors.red);
    return;
  }
  
  // Step 2: Test token safety
  await testTokenSafety(token.address, token.symbol);
  
  // Step 3: Test price retrieval
  const price = await testGetPrice(token.address, token.symbol);
  
  // Step 4: Get trade amount
  const maxAmount = Math.min(balance * 0.01, 10); // Max 1% of balance or $10
  const defaultAmount = Math.min(1, maxAmount); // Default to $1
  
  log(`\n💰 Trade Amount Selection:`, colors.cyan);
  log(`Available Balance: $${balance.toFixed(2)}`);
  log(`Recommended Amount: $${defaultAmount.toFixed(2)}`);
  log(`Maximum for test: $${maxAmount.toFixed(2)}`);
  
  const amountInput = await askQuestion(`\nEnter trade amount in USD [${defaultAmount}]: `);
  const amount = parseFloat(amountInput) || defaultAmount;
  
  if (amount > maxAmount) {
    log(`❌ Amount too large. Maximum: $${maxAmount.toFixed(2)}`, colors.red);
    return;
  }
  
  if (amount < 0.1) {
    log('❌ Amount too small. Minimum: $0.10', colors.red);
    return;
  }
  
  // Step 5: Execute buy test
  const result = await testBuyFunction(token.address, token.symbol, amount);
  
  if (result) {
    log('\n🎉 Buy Function Test Completed Successfully!', colors.green);
    
    // Show position if available
    try {
      const position = await exchangeClient.getPosition(token.address);
      if (position.size > 0) {
        log(`\n📈 Current Position:`, colors.blue);
        log(`   🪙 Token Amount: ${position.size.toFixed(6)}`, colors.blue);
        if (price) {
          const value = position.size * price;
          log(`   💰 Estimated Value: $${value.toFixed(2)}`, colors.blue);
        }
      }
    } catch (error) {
      log(`⚠️  Could not retrieve position: ${error.message}`, colors.yellow);
    }
  }
}

async function testIndividualFunctions() {
  log('\n🔧 Individual Function Tests', colors.cyan);
  log('1. Test Balance Check');
  log('2. Test Token Safety Check');
  log('3. Test Price Retrieval');
  log('4. Test Buy Function Only');
  log('5. Back to main menu');
  
  const choice = await askQuestion('\nEnter your choice (1-5): ');
  
  switch(choice) {
    case '1':
      await testGetBalance();
      break;
    case '2':
      const token1 = await selectTestToken();
      if (token1) {
        await testTokenSafety(token1.address, token1.symbol);
      }
      break;
    case '3':
      const token2 = await selectTestToken();
      if (token2) {
        await testGetPrice(token2.address, token2.symbol);
      }
      break;
    case '4':
      const token3 = await selectTestToken();
      if (token3) {
        const amount = parseFloat(await askQuestion('Enter amount in USD: '));
        if (amount && amount > 0) {
          await testBuyFunction(token3.address, token3.symbol, amount);
        }
      }
      break;
    case '5':
      return;
    default:
      log('❌ Invalid choice', colors.red);
  }
}

async function checkConfiguration() {
  log('\n⚙️  Configuration Check', colors.cyan);
  
  const requiredFields = config.DRY_RUN 
    ? ['API_ID', 'API_HASH']
    : ['API_ID', 'API_HASH', 'RPC_ENDPOINT', 'WALLET_PRIVATE_KEY'];
  
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    log(`❌ Missing configuration: ${missingFields.join(', ')}`, colors.red);
    log('Please run setup first: node setup.js', colors.yellow);
    return false;
  }
  
  log('✅ Configuration looks good', colors.green);
  log(`Mode: ${config.DRY_RUN ? 'Paper Trading' : 'Live Trading'}`);
  log(`RPC: ${config.RPC_ENDPOINT}`);
  log(`Max Trade: ${config.MAX_TRADE_PERCENT}%`);
  
  return true;
}

async function mainMenu() {
  while (true) {
    await displayTestMenu();
    
    log('\n📋 Test Options:', colors.cyan);
    log('1. Check Configuration');
    log('2. Test Full Buy Flow (Recommended)');
    log('3. Test Individual Functions');
    log('4. Initialize Exchange Client');
    log('5. Exit');
    
    const choice = await askQuestion('\nEnter your choice (1-5): ');
    
    try {
      switch(choice) {
        case '1':
          await checkConfiguration();
          break;
        case '2':
          await testFullBuyFlow();
          break;
        case '3':
          await testIndividualFunctions();
          break;
        case '4':
          log('\n🔄 Initializing Exchange Client...', colors.yellow);
          try {
            await exchangeClient.initializeJupiter();
            log('✅ Exchange client initialized successfully', colors.green);
          } catch (error) {
            log(`❌ Initialization failed: ${error.message}`, colors.red);
          }
          break;
        case '5':
          log('\n👋 Exiting test suite...', colors.yellow);
          rl.close();
          process.exit(0);
        default:
          log('❌ Invalid choice', colors.red);
      }
    } catch (error) {
      log(`❌ Test error: ${error.message}`, colors.red);
      log('Stack trace:', colors.red);
      console.error(error);
    }
    
    if (choice !== '5') {
      await askQuestion('\nPress Enter to continue...');
    }
  }
}

// Handle exit gracefully
process.on('SIGINT', () => {
  log('\n👋 Test suite interrupted', colors.yellow);
  rl.close();
  process.exit(0);
});

// Start the test suite
if (require.main === module) {
  log('🧪 Starting CrestX Buy Function Test Suite...', colors.bright);
  
  mainMenu().catch(error => {
    log(`❌ Test suite error: ${error.message}`, colors.red);
    rl.close();
    process.exit(1);
  });
}

module.exports = {
  testGetBalance,
  testTokenSafety,
  testGetPrice,
  testBuyFunction,
  testFullBuyFlow
};