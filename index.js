#!/usr/bin/env node
// index.js
const readline = require("readline");
const { startListener } = require("./listener");
const { parseMemeCoinMessage } = require("./parser");
const { executeTrade, cancelTrade, getActiveTrades, getDryRunBalance } = require("./trader");
const tokenSafety = require("./tokenSafety");
const tradeStore = require("./tradeStore");
const notifier = require("./notifier");
const config = require("./config");
const { displayBanner, displaySmallBanner } = require("./banner");

// Create data directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Simple CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "crestx> "
});

// Global uncaught exception handler
process.on('uncaughtException', (err) => {
  console.error('\n❌ FATAL ERROR:', err);
  // Keep running despite errors
});

// Stats tracking
const stats = {
  messagesReceived: 0,
  signalsDetected: 0,
  tradesExecuted: 0,
  tradesFailed: 0,
  safetyRejections: 0
};

// Start the bot
async function startBot() {
  console.log(displayBanner(config));
  
  // Validate configuration
  validateConfig();
  
  // Start Telegram listener
  const client = await startListener(async (message, chatId) => {
    stats.messagesReceived++;
    console.log(`\n📝 [${new Date().toLocaleTimeString()}] Message from channel ${chatId}:`);
    console.log(`${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`);
    
    // Set the client for notifications
    notifier.setClient(client);
    
    // Process the message
    await processMessage(message, chatId);
    
    rl.prompt();
  });
}

// Process incoming message
async function processMessage(message, chatId) {
  try {
    // Parse the incoming callout
    const signal = parseMemeCoinMessage(message, true);
    
    // Log the parsing result
    if (signal.contractAddress) {
      stats.signalsDetected++;
      console.log(`🔍 Detected signal for ${signal.contractAddress}`);
    }
    
    // Validate essential fields
    if (!signal.contractAddress || !signal.tradePercent || !signal.stopLossPercent) {
      console.log("⚠️ Skipping incomplete signal, missing required fields");
      return;
    }
    
    // Optionally enforce full confidence
    if (signal.confidence < 3) {
      console.log(`⚠️ Low-confidence signal (${signal.confidence}/3), skipping`);
      return;
    }
    
    // Safety check if enabled
    if (config.ENABLE_SAFETY_CHECKS) {
      console.log(`🔒 Performing safety check on ${signal.contractAddress}...`);
      const safetyResult = await tokenSafety.checkToken(signal.contractAddress);
      
      if (!safetyResult.isSafe) {
        stats.safetyRejections++;
        console.log(`❌ Token safety check failed: ${safetyResult.warnings.join(', ')}`);
        notifier.notifySafetyWarning(safetyResult, safetyResult.warnings);
        return;
      }
      
      console.log(`✅ Token passed safety checks. Liquidity: $${safetyResult.liquidity?.toFixed(2) || 'Unknown'}`);
      
      // Enrich signal with token info if available
      if (safetyResult.name) {
        signal.symbol = safetyResult.name;
      }
    }
    
    // Execute the trade
    try {
      console.log(`🔄 ${config.DRY_RUN ? '[DRY RUN] ' : ''}Executing trade for ${signal.contractAddress}...`);
      const result = await executeTrade(signal);
      
      if (result.success) {
        stats.tradesExecuted++;
        console.log(`✅ ${config.DRY_RUN ? '[DRY RUN] ' : ''}Trade executed successfully at ${result.entryPrice}`);
        
        // Store trade
        const tradeRecord = {
          id: result.id || Date.now().toString(),
          contractAddress: signal.contractAddress,
          symbol: signal.symbol,
          entryPrice: result.entryPrice,
          amount: result.amount,
          stopLossPercent: signal.stopLossPercent,
          takeProfitTargets: signal.takeProfitTargets,
          timestamp: Date.now(),
          closed: false,
          isDryRun: config.DRY_RUN
        };
        
        tradeStore.addTrade(tradeRecord);
        notifier.notifyTradeExecution(tradeRecord);
      } else {
        stats.tradesFailed++;
        console.error(`❌ ${config.DRY_RUN ? '[DRY RUN] ' : ''}Trade failed: ${result.error}`);
      }
    } catch (err) {
      stats.tradesFailed++;
      console.error(`❌ ${config.DRY_RUN ? '[DRY RUN] ' : ''}Unexpected error executing trade: ${err.message}`);
    }
  } catch (err) {
    console.error(`❌ Error processing message: ${err.message}`);
  }
}

// Validate configuration
function validateConfig() {
  const requiredFields = config.DRY_RUN 
    ? ["API_ID", "API_HASH", "TELEGRAM_CHANNEL_IDS"] 
    : ["API_ID", "API_HASH", "TELEGRAM_CHANNEL_IDS", "RPC_ENDPOINT", "WALLET_PRIVATE_KEY"];
    
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    console.error(`❌ Missing required configuration: ${missingFields.join(", ")}`);
    process.exit(1);
  }
  
  console.log(`ℹ️ Configuration loaded successfully:`);
  console.log(`🔄 Channels: ${config.TELEGRAM_CHANNEL_IDS.join(", ")}`);
  console.log(`💰 Max trade: ${config.MAX_TRADE_PERCENT}%`);
  console.log(`🛑 Stop loss: Trailing ${config.USE_TRAILING_STOP ? "enabled" : "disabled"} (${config.TRAILING_STOP_PERCENT}%)`);
  console.log(`🔒 Safety checks: ${config.ENABLE_SAFETY_CHECKS ? "enabled" : "disabled"}`);
  console.log(`📡 Network: ${config.NETWORK || "mainnet-beta"}`);
  console.log(`🧪 Mode: ${config.DRY_RUN ? "DRY RUN (paper trading)" : "LIVE TRADING"}`);
  
  if (config.DRY_RUN) {
    console.log(`💵 Paper trading balance: $${config.DRY_RUN_BALANCE}`);
    console.log(`📊 Price volatility simulation: ${config.DRY_RUN_PRICE_VOLATILITY}%`);
  }
}

// Setup CLI commands
function setupCliCommands() {
  rl.prompt();
  
  rl.on('line', async (line) => {
    const command = line.trim();
    
    switch(command) {
      case 'help':
        console.log(displaySmallBanner(config));
        console.log(`
Available commands:
  stats     - Show bot statistics
  trades    - List active trades
  history   - Show trade history
  cancel    - Cancel a specific trade (usage: cancel <address>)
  safety    - Check token safety (usage: safety <address>)
  balance   - Check wallet balance
  ${config.DRY_RUN ? '[DRY RUN MODE ACTIVE - No real trades will be executed]' : ''}
  exit      - Exit the bot
  help      - Show this help message
        `);
        break;
        
      case 'stats':
        console.log(displaySmallBanner(config));
        const tradeStats = tradeStore.getTradeStats();
        console.log(`
📊 Bot Statistics:
  Messages processed: ${stats.messagesReceived}
  Signals detected:   ${stats.signalsDetected}
  Trades executed:    ${stats.tradesExecuted}
  Failed trades:      ${stats.tradesFailed}
  Safety rejections:  ${stats.safetyRejections}
  ${config.DRY_RUN ? '  [Running in DRY RUN mode - no real trades]' : ''}
  
📈 Trade Performance:
  Total trades:       ${tradeStats.totalTrades}
  Active trades:      ${tradeStats.activeTrades}
  Closed trades:      ${tradeStats.closedTrades}
  Win rate:           ${tradeStats.winRate.toFixed(1)}%
  Total profit:       $${tradeStats.totalProfit.toFixed(2)}
        `);
        break;
        
      case 'trades':
        console.log(displaySmallBanner(config));
        const activeTrades = await getActiveTrades();
        if (activeTrades.length === 0) {
          console.log("📭 No active trades");
        } else {
          console.log("📋 Active trades:");
          for (const trade of activeTrades) {
            if (config.DRY_RUN && trade.currentPrice) {
              console.log(`  - ${trade.contractAddress} (Entry: $${trade.entryPrice.toFixed(8)}, Current: $${trade.currentPrice.toFixed(8)}, P/L: ${trade.profitPercent})`);
            } else {
              console.log(`  - ${trade.symbol || trade.contractAddress} (Entry: $${trade.entryPrice.toFixed(8)})`);
            }
          }
        }
        break;
        
      case 'history':
        console.log(displaySmallBanner(config));
        const recentTrades = tradeStore.getRecentTrades(5);
        if (recentTrades.length === 0) {
          console.log("📭 No trade history");
        } else {
          console.log("📋 Recent trades:");
          recentTrades.forEach(trade => {
            const status = trade.closed ? 
              (trade.profit > 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`) : 
              'Active';
            const dryRunLabel = trade.isDryRun ? ' [DRY RUN]' : '';
            console.log(`  - ${trade.symbol || trade.contractAddress}${dryRunLabel}: ${status}`);
          });
        }
        break;
        
      case 'balance':
        console.log(displaySmallBanner(config));
        if (config.DRY_RUN) {
          const balance = getDryRunBalance();
          console.log(`💰 [DRY RUN] Paper trading balance: $${balance.toFixed(2)} USDC`);
        } else {
          const { getAccountBalance } = require('./exchangeClient');
          const balance = await getAccountBalance();
          console.log(`💰 Wallet balance: $${balance.toFixed(2)} USDC`);
        }
        break;
        
      case 'exit':
        console.log("👋 Shutting down...");
        process.exit(0);
        break;
        
      default:
        if (command.startsWith('cancel ')) {
          const address = command.split(' ')[1];
          if (address) {
            console.log(`🔄 ${config.DRY_RUN ? '[DRY RUN] ' : ''}Cancelling trade for ${address}...`);
            const result = await cancelTrade(address);
            console.log(result ? "✅ Trade cancelled" : "❌ Failed to cancel trade");
          } else {
            console.log("⚠️ Please specify a contract address to cancel");
          }
        } 
        else if (command.startsWith('safety ')) {
          const address = command.split(' ')[1];
          if (address) {
            console.log(`🔒 Checking safety for ${address}...`);
            const safety = await tokenSafety.checkToken(address);
            if (safety.isSafe) {
              console.log(`✅ Token appears safe. ${safety.liquidity ? `Liquidity: $${safety.liquidity.toFixed(2)}` : ''}`);
            } else {
              console.log(`❌ Safety concerns detected:`);
              safety.warnings.forEach(w => console.log(`  - ${w}`));
            }
          } else {
            console.log("⚠️ Please specify a contract address to check");
          }
        }
        else if (command) {
          console.log("❓ Unknown command. Type 'help' for available commands");
        }
    }
    
    rl.prompt();
  }).on('close', () => {
    console.log("👋 Shutting down...");
    process.exit(0);
  });
}

// Start the bot
startBot()
  .then(() => {
    setupCliCommands();
  })
  .catch(err => {
    console.error("❌ Failed to start bot:", err);
    process.exit(1);
  });