#!/usr/bin/env node
// performance-test.js - Buy function test with detailed performance metrics
require('dotenv').config();

const exchangeClient = require('./exchangeClient');
const config = require('./config');

// Performance tracking
class PerformanceTracker {
  constructor() {
    this.metrics = {};
    this.startTimes = {};
  }
  
  start(operation) {
    this.startTimes[operation] = {
      hrTime: process.hrtime.bigint(),
      timestamp: Date.now()
    };
  }
  
  end(operation) {
    if (!this.startTimes[operation]) return null;
    
    const endTime = process.hrtime.bigint();
    const endTimestamp = Date.now();
    const start = this.startTimes[operation];
    
    const durationNs = endTime - start.hrTime;
    const durationMs = Number(durationNs) / 1000000; // Convert to milliseconds
    const durationS = durationMs / 1000; // Convert to seconds
    
    this.metrics[operation] = {
      durationMs: Math.round(durationMs * 100) / 100,
      durationS: Math.round(durationS * 100) / 100,
      startTimestamp: start.timestamp,
      endTimestamp: endTimestamp
    };
    
    delete this.startTimes[operation];
    return this.metrics[operation];
  }
  
  getMetrics() {
    return this.metrics;
  }
  
  getTotalTime() {
    const times = Object.values(this.metrics).map(m => m.durationMs);
    return times.reduce((sum, time) => sum + time, 0);
  }
}

// Test configuration
const TEST_CONFIG = {
  TOKEN_ADDRESS: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
  TOKEN_SYMBOL: 'BONK',
  TEST_AMOUNT_USD: 1.0,
  ITERATIONS: 1 // Number of test iterations for speed testing
};

function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

function getSpeedRating(ms, thresholds) {
  if (ms <= thresholds.excellent) return { rating: 'EXCELLENT', color: '\x1b[32m', emoji: '🚀' };
  if (ms <= thresholds.good) return { rating: 'GOOD', color: '\x1b[33m', emoji: '⚡' };
  if (ms <= thresholds.acceptable) return { rating: 'ACCEPTABLE', color: '\x1b[35m', emoji: '✅' };
  return { rating: 'SLOW', color: '\x1b[31m', emoji: '🐌' };
}

async function performanceTest() {
  console.log('🚀 CrestX Buy Function Performance Test');
  console.log('═'.repeat(50));
  
  const mode = config.DRY_RUN ? 'PAPER TRADING' : 'LIVE TRADING';
  console.log(`📊 Mode: ${mode}`);
  console.log(`🎯 Testing with: ${TEST_CONFIG.TOKEN_SYMBOL}`);
  console.log(`💰 Test Amount: $${TEST_CONFIG.TEST_AMOUNT_USD}`);
  console.log(`🔄 Iterations: ${TEST_CONFIG.ITERATIONS}`);
  
  if (!config.DRY_RUN) {
    console.log('\n⚠️  WARNING: LIVE TRADING MODE!');
    console.log('This will use real money from your wallet!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('\n🏁 Starting performance tests...\n');
  
  const tracker = new PerformanceTracker();
  const results = [];
  
  try {
    // Initialize exchange client first
    console.log('🔧 Initializing exchange client...');
    tracker.start('initialization');
    await exchangeClient.initializeJupiter();
    const initTime = tracker.end('initialization');
    console.log(`   ✅ Initialized in ${formatDuration(initTime.durationMs)}`);
    
    for (let iteration = 1; iteration <= TEST_CONFIG.ITERATIONS; iteration++) {
      console.log(`\n🔄 Iteration ${iteration}/${TEST_CONFIG.ITERATIONS}`);
      console.log('─'.repeat(30));
      
      const iterationResults = {
        iteration,
        steps: {},
        totalTime: 0,
        success: false,
        error: null
      };
      
      try {
        // Step 1: Balance Check
        console.log('1️⃣ Balance check...');
        tracker.start('balance');
        const balance = await exchangeClient.getAccountBalance();
        const balanceTime = tracker.end('balance');
        iterationResults.steps.balance = balanceTime;
        
        const speed1 = getSpeedRating(balanceTime.durationMs, { excellent: 500, good: 1000, acceptable: 2000 });
        console.log(`   ${speed1.emoji} ${formatDuration(balanceTime.durationMs)} - ${speed1.color}${speed1.rating}\x1b[0m`);
        console.log(`   💰 Balance: $${balance.toFixed(2)}`);
        
        if (balance < TEST_CONFIG.TEST_AMOUNT_USD) {
          throw new Error(`Insufficient balance: $${balance.toFixed(2)} < $${TEST_CONFIG.TEST_AMOUNT_USD}`);
        }
        
        // Step 2: Token Safety Check
        console.log('\n2️⃣ Token safety check...');
        tracker.start('safety');
        const safety = await exchangeClient.checkTokenSafety(TEST_CONFIG.TOKEN_ADDRESS);
        const safetyTime = tracker.end('safety');
        iterationResults.steps.safety = safetyTime;
        
        const speed2 = getSpeedRating(safetyTime.durationMs, { excellent: 1000, good: 2000, acceptable: 5000 });
        console.log(`   ${speed2.emoji} ${formatDuration(safetyTime.durationMs)} - ${speed2.color}${speed2.rating}\x1b[0m`);
        console.log(`   🛡️  Safety: ${safety.safe ? 'PASSED' : 'FAILED'}`);
        
        if (safety.liquidity) {
          console.log(`   💧 Liquidity: $${safety.liquidity.toFixed(2)}`);
        }
        
        // Step 3: Price Retrieval
        console.log('\n3️⃣ Price retrieval...');
        tracker.start('price');
        const price = await exchangeClient.getCurrentPrice(TEST_CONFIG.TOKEN_ADDRESS);
        const priceTime = tracker.end('price');
        iterationResults.steps.price = priceTime;
        
        const speed3 = getSpeedRating(priceTime.durationMs, { excellent: 800, good: 1500, acceptable: 3000 });
        console.log(`   ${speed3.emoji} ${formatDuration(priceTime.durationMs)} - ${speed3.color}${speed3.rating}\x1b[0m`);
        console.log(`   💵 Price: $${price.toFixed(8)}`);
        
        // Step 4: Buy Execution (The Critical One!)
        console.log('\n4️⃣ 🚨 BUY EXECUTION (CRITICAL SPEED TEST)...');
        tracker.start('buy');
        const buyResult = await exchangeClient.buyMarket(
          TEST_CONFIG.TOKEN_ADDRESS, 
          TEST_CONFIG.TEST_AMOUNT_USD
        );
        const buyTime = tracker.end('buy');
        iterationResults.steps.buy = buyTime;
        
        // Buy speed is most critical - different thresholds
        const speed4 = getSpeedRating(buyTime.durationMs, { 
          excellent: 2000, // Under 2 seconds is excellent
          good: 5000,       // Under 5 seconds is good
          acceptable: 10000 // Under 10 seconds is acceptable
        });
        
        console.log(`   ${speed4.emoji} ${formatDuration(buyTime.durationMs)} - ${speed4.color}${speed4.rating}\x1b[0m`);
        
        if (buyResult.success) {
          console.log(`   ✅ Buy successful!`);
          console.log(`   📊 Trade ID: ${buyResult.id}`);
          console.log(`   💰 Fill Price: $${buyResult.filledPrice.toFixed(8)}`);
          console.log(`   🪙 Tokens: ${buyResult.amountOut.toFixed(6)}`);
          
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
        
        // Step 5: Position Verification
        console.log('\n5️⃣ Position verification...');
        tracker.start('position');
        const position = await exchangeClient.getPosition(TEST_CONFIG.TOKEN_ADDRESS);
        const positionTime = tracker.end('position');
        iterationResults.steps.position = positionTime;
        
        const speed5 = getSpeedRating(positionTime.durationMs, { excellent: 500, good: 1000, acceptable: 2000 });
        console.log(`   ${speed5.emoji} ${formatDuration(positionTime.durationMs)} - ${speed5.color}${speed5.rating}\x1b[0m`);
        console.log(`   📈 Position: ${position.size.toFixed(6)} tokens`);
        
        // Calculate total time for this iteration
        iterationResults.totalTime = Object.values(iterationResults.steps)
          .reduce((sum, step) => sum + step.durationMs, 0);
        iterationResults.success = true;
        
        console.log(`\n⏱️  Total iteration time: ${formatDuration(iterationResults.totalTime)}`);
        
      } catch (error) {
        iterationResults.error = error.message;
        console.log(`   ❌ Iteration ${iteration} failed: ${error.message}`);
      }
      
      results.push(iterationResults);
    }
    
    // Performance Summary
    console.log('\n📊 PERFORMANCE SUMMARY');
    console.log('═'.repeat(50));
    
    const successfulRuns = results.filter(r => r.success);
    
    if (successfulRuns.length > 0) {
      // Calculate averages
      const avgTimes = {};
      const stepNames = Object.keys(successfulRuns[0].steps);
      
      stepNames.forEach(step => {
        const times = successfulRuns.map(r => r.steps[step].durationMs);
        avgTimes[step] = {
          avg: times.reduce((sum, t) => sum + t, 0) / times.length,
          min: Math.min(...times),
          max: Math.max(...times)
        };
      });
      
      console.log('\n🏆 STEP-BY-STEP PERFORMANCE:');
      console.log('┌─────────────────┬─────────┬─────────┬─────────┬──────────┐');
      console.log('│ Step            │ Average │ Fastest │ Slowest │ Rating   │');
      console.log('├─────────────────┼─────────┼─────────┼─────────┼──────────┤');
      
      const stepDisplayNames = {
        balance: 'Balance Check',
        safety: 'Safety Check',
        price: 'Price Retrieval',
        buy: 'BUY EXECUTION',
        position: 'Position Check'
      };
      
      const ratingThresholds = {
        balance: { excellent: 500, good: 1000, acceptable: 2000 },
        safety: { excellent: 1000, good: 2000, acceptable: 5000 },
        price: { excellent: 800, good: 1500, acceptable: 3000 },
        buy: { excellent: 2000, good: 5000, acceptable: 10000 },
        position: { excellent: 500, good: 1000, acceptable: 2000 }
      };
      
      stepNames.forEach(step => {
        const times = avgTimes[step];
        const rating = getSpeedRating(times.avg, ratingThresholds[step]);
        const stepName = stepDisplayNames[step] || step;
        
        console.log(`│ ${stepName.padEnd(15)} │ ${formatDuration(times.avg).padEnd(7)} │ ${formatDuration(times.min).padEnd(7)} │ ${formatDuration(times.max).padEnd(7)} │ ${rating.emoji} ${rating.rating.padEnd(6)} │`);
      });
      
      console.log('└─────────────────┴─────────┴─────────┴─────────┴──────────┘');
      
      // Total execution time
      const totalTimes = successfulRuns.map(r => r.totalTime);
      const avgTotal = totalTimes.reduce((sum, t) => sum + t, 0) / totalTimes.length;
      const minTotal = Math.min(...totalTimes);
      const maxTotal = Math.max(...totalTimes);
      
      console.log('\n🚀 OVERALL EXECUTION SPEED:');
      console.log(`   Average Total Time: ${formatDuration(avgTotal)}`);
      console.log(`   Fastest Run: ${formatDuration(minTotal)}`);
      console.log(`   Slowest Run: ${formatDuration(maxTotal)}`);
      
      // Landing speed analysis
      const buyTimes = successfulRuns.map(r => r.steps.buy.durationMs);
      const avgBuyTime = buyTimes.reduce((sum, t) => sum + t, 0) / buyTimes.length;
      const buyRating = getSpeedRating(avgBuyTime, { excellent: 2000, good: 5000, acceptable: 10000 });
      
      console.log('\n🎯 TRADE EXECUTION ("LANDING") SPEED:');
      console.log(`   ${buyRating.emoji} Average: ${formatDuration(avgBuyTime)} - ${buyRating.color}${buyRating.rating}\x1b[0m`);
      console.log(`   Fastest Trade: ${formatDuration(Math.min(...buyTimes))}`);
      console.log(`   Slowest Trade: ${formatDuration(Math.max(...buyTimes))}`);
      
      // Network conditions
      console.log('\n🌐 NETWORK CONDITIONS:');
      console.log(`   RPC Endpoint: ${config.RPC_ENDPOINT}`);
      console.log(`   Priority Fee: ${config.PRIORITY_FEE_LAMPORTS || 'Default'} lamports`);
      console.log(`   Slippage: ${config.DEFAULT_SLIPPAGE}%`);
      
      // Performance recommendations
      console.log('\n💡 PERFORMANCE RECOMMENDATIONS:');
      
      if (avgBuyTime > 5000) {
        console.log('   ⚠️  Trade execution is slow (>5s). Consider:');
        console.log('      - Using a premium RPC endpoint (Alchemy, QuickNode)');
        console.log('      - Increasing priority fee');
        console.log('      - Checking network conditions');
      } else if (avgBuyTime > 2000) {
        console.log('   📈 Trade execution is good but could be faster. Consider:');
        console.log('      - Premium RPC for better performance');
        console.log('      - Monitoring during high network traffic');
      } else {
        console.log('   🚀 Excellent trade execution speed!');
        console.log('      - Your setup is optimized for fast trading');
      }
      
      // Success rate
      const successRate = (successfulRuns.length / results.length) * 100;
      console.log(`\n📈 SUCCESS RATE: ${successRate.toFixed(1)}% (${successfulRuns.length}/${results.length})`);
      
    } else {
      console.log('\n❌ No successful runs to analyze');
    }
    
    // Failed runs analysis
    const failedRuns = results.filter(r => !r.success);
    if (failedRuns.length > 0) {
      console.log('\n⚠️  FAILED RUNS:');
      failedRuns.forEach((run, index) => {
        console.log(`   ${index + 1}. ${run.error}`);
      });
    }
    
  } catch (error) {
    console.log(`\n💥 Test suite error: ${error.message}`);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check your .env configuration');
    console.log('   2. Verify wallet has sufficient USDC');
    console.log('   3. Test network connectivity');
    console.log('   4. Try a different RPC endpoint');
  }
  
  console.log('\n📋 Raw performance data:');
  console.log(JSON.stringify(results, null, 2));
}

// Run the performance test
if (require.main === module) {
  performanceTest().then(() => {
    console.log('\n👋 Performance test completed');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { performanceTest, PerformanceTracker };