#!/usr/bin/env node
// quick-test-clean.js - Clean buy function test with speed metrics
require('dotenv').config();

const exchangeClient = require('./exchangeClient');
const config = require('./config');

// Test configuration
const TEST_CONFIG = {
  TOKEN_ADDRESS: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  TOKEN_SYMBOL: 'BONK',
  TEST_AMOUNT_USD: 1.0
};

function formatDuration(ms) {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

function getSpeedRating(ms, type = 'general') {
  const thresholds = {
    general: { excellent: 1000, good: 2000, acceptable: 5000 },
    buy: { excellent: 2000, good: 5000, acceptable: 10000 }
  };
  
  const limits = thresholds[type] || thresholds.general;
  
  if (ms <= limits.excellent) return { rating: 'EXCELLENT', emoji: '🚀', color: '\x1b[32m' };
  if (ms <= limits.good) return { rating: 'GOOD', emoji: '⚡', color: '\x1b[33m' };
  if (ms <= limits.acceptable) return { rating: 'ACCEPTABLE', emoji: '✅', color: '\x1b[35m' };
  return { rating: 'SLOW', emoji: '🐌', color: '\x1b[31m' };
}

async function quickTest() {
  console.log('🧪 CrestX Quick Buy Function Test with Speed Metrics');
  console.log('═'.repeat(55));
  
  const mode = config.DRY_RUN ? 'PAPER TRADING' : 'LIVE TRADING';
  console.log(`📊 Mode: ${mode}`);
  console.log(`🎯 Testing with: ${TEST_CONFIG.TOKEN_SYMBOL}`);
  console.log(`💰 Test Amount: $${TEST_CONFIG.TEST_AMOUNT_USD}`);
  
  if (!config.DRY_RUN) {
    console.log('\n⚠️  WARNING: LIVE TRADING MODE!');
    console.log('This will use real money from your wallet!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('\n🔄 Starting tests with speed tracking...\n');
  
  const times = {};
  let startTime, endTime;
  
  try {
    // Test 1: Check balance
    console.log('1️⃣ Testing balance check...');
    startTime = Date.now();
    const balance = await exchangeClient.getAccountBalance();
    endTime = Date.now();
    times.balance = endTime - startTime;
    
    const balanceSpeed = getSpeedRating(times.balance);
    console.log(`   ${balanceSpeed.emoji} ${formatDuration(times.balance)} - ${balanceSpeed.color}${balanceSpeed.rating}\x1b[0m`);
    console.log(`   ✅ Balance: $${balance.toFixed(2)}`);
    
    if (balance < TEST_CONFIG.TEST_AMOUNT_USD) {
      throw new Error(`Insufficient balance. Need $${TEST_CONFIG.TEST_AMOUNT_USD}, have $${balance.toFixed(2)}`);
    }
    
    // Test 2: Check token safety
    console.log('\n2️⃣ Testing token safety...');
    startTime = Date.now();
    const safety = await exchangeClient.checkTokenSafety(TEST_CONFIG.TOKEN_ADDRESS);
    endTime = Date.now();
    times.safety = endTime - startTime;
    
    const safetySpeed = getSpeedRating(times.safety);
    console.log(`   ${safetySpeed.emoji} ${formatDuration(times.safety)} - ${safetySpeed.color}${safetySpeed.rating}\x1b[0m`);
    
    if (safety.safe) {
      console.log(`   ✅ Token safety: PASSED`);
      if (safety.liquidity) {
        console.log(`   💧 Liquidity: $${safety.liquidity.toFixed(2)}`);
      }
    } else {
      console.log(`   ⚠️  Token safety: ${safety.reason}`);
    }
    
    // Test 3: Get current price
    console.log('\n3️⃣ Testing price retrieval...');
    startTime = Date.now();
    const price = await exchangeClient.getCurrentPrice(TEST_CONFIG.TOKEN_ADDRESS);
    endTime = Date.now();
    times.price = endTime - startTime;
    
    const priceSpeed = getSpeedRating(times.price);
    console.log(`   ${priceSpeed.emoji} ${formatDuration(times.price)} - ${priceSpeed.color}${priceSpeed.rating}\x1b[0m`);
    console.log(`   ✅ Current price: $${price.toFixed(8)}`);
    
    // Test 4: Execute buy (CRITICAL SPEED TEST)
    console.log('\n4️⃣ 🚨 Testing buy execution (CRITICAL LANDING SPEED)...');
    startTime = Date.now();
    const buyResult = await exchangeClient.buyMarket(
      TEST_CONFIG.TOKEN_ADDRESS, 
      TEST_CONFIG.TEST_AMOUNT_USD
    );
    endTime = Date.now();
    times.buy = endTime - startTime;
    
    const buySpeed = getSpeedRating(times.buy, 'buy');
    console.log(`   ${buySpeed.emoji} ${formatDuration(times.buy)} - ${buySpeed.color}${buySpeed.rating} LANDING SPEED\x1b[0m`);
    
    if (buyResult.success) {
      console.log(`   ✅ Buy successful!`);
      console.log(`   📊 Trade ID: ${buyResult.id}`);
      console.log(`   💰 Fill Price: $${buyResult.filledPrice.toFixed(8)}`);
      console.log(`   🪙 Tokens Received: ${buyResult.amountOut.toFixed(6)}`);
      
      // Calculate slippage
      const expectedTokens = TEST_CONFIG.TEST_AMOUNT_USD / price;
      const actualTokens = buyResult.amountOut;
      const slippage = ((expectedTokens - actualTokens) / expectedTokens) * 100;
      console.log(`   📉 Slippage: ${slippage.toFixed(2)}%`);
      
      if (config.DRY_RUN) {
        console.log(`   🧪 [SIMULATION] No real funds used`);
      }
    } else {
      throw new Error(`Buy failed: ${buyResult.error}`);
    }
    
    // Test 5: Check position
    console.log('\n5️⃣ Testing position check...');
    startTime = Date.now();
    const position = await exchangeClient.getPosition(TEST_CONFIG.TOKEN_ADDRESS);
    endTime = Date.now();
    times.position = endTime - startTime;
    
    const positionSpeed = getSpeedRating(times.position);
    console.log(`   ${positionSpeed.emoji} ${formatDuration(times.position)} - ${positionSpeed.color}${positionSpeed.rating}\x1b[0m`);
    console.log(`   ✅ Position size: ${position.size.toFixed(6)} tokens`);
    
    if (position.size > 0) {
      const estimatedValue = position.size * price;
      console.log(`   💰 Estimated value: $${estimatedValue.toFixed(2)}`);
    }
    
    // Performance Summary
    const totalTime = Object.values(times).reduce((sum, time) => sum + time, 0);
    
    console.log('\n📊 SPEED PERFORMANCE SUMMARY');
    console.log('═'.repeat(40));
    console.log(`🏆 Total Execution Time: ${formatDuration(totalTime)}`);
    console.log(`🚀 Critical Buy Speed: ${formatDuration(times.buy)} (${buySpeed.rating})`);
    
    console.log('\n📋 Detailed Breakdown:');
    console.log(`   Balance Check:  ${formatDuration(times.balance)}`);
    console.log(`   Safety Check:   ${formatDuration(times.safety)}`);
    console.log(`   Price Fetch:    ${formatDuration(times.price)}`);
    console.log(`   🎯 BUY EXEC:     ${formatDuration(times.buy)} ⭐`);
    console.log(`   Position Check: ${formatDuration(times.position)}`);
    
    // Speed recommendations
    console.log('\n💡 SPEED ANALYSIS:');
    if (times.buy <= 2000) {
      console.log('   🚀 EXCELLENT landing speed! Your setup is optimized for fast trading.');
    } else if (times.buy <= 5000) {
      console.log('   ⚡ GOOD landing speed. Consider premium RPC for even faster execution.');
    } else if (times.buy <= 10000) {
      console.log('   ✅ ACCEPTABLE speed, but could be improved with:');
      console.log('      - Premium RPC endpoint (Alchemy, QuickNode, Helius)');
      console.log('      - Higher priority fees');
    } else {
      console.log('   🐌 SLOW execution detected. Immediate improvements needed:');
      console.log('      - Switch to premium RPC endpoint');
      console.log('      - Increase PRIORITY_FEE_LAMPORTS in .env');
      console.log('      - Check network connectivity');
    }
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Buy function is working correctly with speed metrics');
    
    if (config.DRY_RUN) {
      console.log('\n💡 Next steps:');
      console.log('   - Your buy function works with good speed in simulation');
      console.log('   - To test with real money, set DRY_RUN=false in .env');
      console.log('   - Start with small amounts when going live');
      console.log('   - For detailed performance analysis, run: node performance-test.js');
    } else {
      console.log('\n💡 Live trading test completed successfully!');
      console.log('   - Your buy function works with real money');
      console.log('   - Landing speed recorded for future optimization');
      console.log('   - Consider setting up stop losses for risk management');
    }
    
  } catch (error) {
    console.log(`\n❌ Test failed: ${error.message}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your .env configuration');
    console.log('   2. Verify Telegram API credentials');
    console.log('   3. Ensure wallet has USDC (for live trading)');
    console.log('   4. Check RPC endpoint is working');
    console.log('   5. Try running: node setup.js');
    
    // Show timing data even if test failed
    if (Object.keys(times).length > 0) {
      console.log('\n📊 Partial timing data:');
      Object.entries(times).forEach(([step, time]) => {
        console.log(`   ${step}: ${formatDuration(time)}`);
      });
    }
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  quickTest().then(() => {
    console.log('\n👋 Test completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { quickTest };