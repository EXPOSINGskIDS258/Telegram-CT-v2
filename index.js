#!/usr/bin/env node
// index.js - Enhanced with live trading deployment option
const readline = require("readline");
const { startListener, getMessageStats } = require("./listener");
const { parseMemeCoinMessage, validateParsedSignal } = require("./parser");
const { executeTrade, cancelTrade, getActiveTrades, getDryRunBalance } = require("./trader");
const tokenSafety = require("./tokenSafety");
const tradeStore = require("./tradeStore");
const notifier = require("./notifier");
const config = require("./config");
const { displayBanner, displaySmallBanner } = require("./banner");
const { EnhancedSetup } = require("./enhanced-setup");

// Default Telegram channels for memecoin signals
const DEFAULT_CHANNELS = ['-1002209371269', '-1002277274250']; // Underdog Calls Private, Degen

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

// Enhanced stats tracking with channel breakdown
const stats = {
  messagesReceived: 0,
  signalsDetected: 0,
  tradesExecuted: 0,
  tradesFailed: 0,
  safetyRejections: 0,
  messagesByChannel: {},
  signalsByChannel: {},
  tradesByChannel: {},
  deploymentMode: null,
  botStartTime: Date.now()
};

// Setup detection and enhanced deployment functions
async function checkAndRunSetup() {
  // Check if this is first run or needs setup
  if (!fs.existsSync('.env')) {
    console.log('\n🔧 No configuration found. Starting enhanced setup...\n');
    await runEnhancedSetup();
    return true;
  }
  
  // Check for essential settings
  const requiredFields = ['API_ID', 'API_HASH', 'TELEGRAM_CHANNEL_IDS'];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    console.log(`\n⚠️  Configuration incomplete. Missing: ${missingFields.join(', ')}`);
    console.log('🔧 Starting enhanced setup to fix configuration...\n');
    await runEnhancedSetup();
    return true;
  }
  
  // Ask if user wants to reconfigure
  return new Promise(resolve => {
    rl.question('\n🚀 CrestX is configured. Run setup again? (y/N): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        runEnhancedSetup().then(() => resolve(true));
      } else {
        resolve(false);
      }
    });
  });
}

async function runEnhancedSetup() {
  rl.close(); // Close current interface
  
  const setup = new EnhancedSetup();
  await setup.start();
  
  console.log('\n🔄 Setup complete! Restart CrestX to begin trading.');
  process.exit(0);
}

function displayDeploymentStatus() {
  const mode = config.DRY_RUN ? 'paper' : 'live';
  stats.deploymentMode = mode;
  const modeDisplay = mode === 'live' ? '💰 LIVE TRADING' : '🧪 PAPER TRADING';
  const modeColor = mode === 'live' ? '\x1b[32m' : '\x1b[33m';
  
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    DEPLOYMENT STATUS                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n📊 Current Mode: ${modeColor}${modeDisplay}\x1b[0m`);
  
  if (mode === 'live') {
    console.log('🔗 Network: Solana Mainnet');
    console.log('⚡ DEX: Jupiter Aggregator');
    console.log('💳 Wallet: Connected');
    console.log('🛡️  Safety: Multi-layer protection');
    console.log('\n⚠️  LIVE TRADING ACTIVE - Real funds at risk!');
  } else {
    console.log('💵 Virtual Balance: $' + (config.DRY_RUN_BALANCE || 1000));
    console.log('📊 Price Simulation: Enabled');
    console.log('🔒 Risk Level: Zero (No real funds)');
    console.log('\n✅ Safe testing environment - No real money at risk');
  }
  
  console.log('\n📡 Monitoring channels for trading signals...\n');
}

// Start the bot
async function startBot() {
  console.log(displayBanner(config));
  
  // Validate configuration
  validateConfig();
  
  // Start Telegram listener with enhanced callback
  const client = await startListener(async (message, chatId, metadata = {}) => {
    stats.messagesReceived++;
    
    // Update channel-specific stats
    if (!stats.messagesByChannel[chatId]) {
      stats.messagesByChannel[chatId] = 0;
    }
    stats.messagesByChannel[chatId]++;
    
    // Enhanced logging with channel context
    const channelInfo = metadata.channelInfo;
    const channelDisplay = channelInfo 
      ? `${channelInfo.icon} ${channelInfo.name}` 
      : `📱 Channel ${chatId}`;
    
    console.log(`\n📝 [${new Date().toLocaleTimeString()}] Message from ${channelDisplay}:`);
    console.log(`${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`);
    
    // Show signal keyword detection result
    if (metadata.hasSignalKeywords) {
      console.log(`🎯 Signal keywords detected - processing with priority`);
    }
    
    // Set the client for notifications
    notifier.setClient(client);
    
    // Process the message with enhanced parameters
    await processMessage(message, chatId, metadata);
    
    rl.prompt();
  });
}

// Enhanced message processing with channel-specific logic
async function processMessage(message, chatId, metadata = {}) {
  try {
    const channelInfo = metadata.channelInfo;
    const channelDisplay = channelInfo 
      ? `${channelInfo.name}` 
      : `Channel ${chatId}`;
    
    // Use channel-specific parsing
    const signal = parseMemeCoinMessage(message, true, chatId);
    
    // Update channel-specific signal stats
    if (signal.contractAddress) {
      stats.signalsDetected++;
      
      if (!stats.signalsByChannel[chatId]) {
        stats.signalsByChannel[chatId] = 0;
      }
      stats.signalsByChannel[chatId]++;
      
      console.log(`🔍 [${channelDisplay}] Detected ${signal.channelType || 'generic'} signal for ${signal.contractAddress}`);
    }
    
    // Enhanced validation with channel-specific rules
    const validation = validateParsedSignal(signal, chatId);
    
    // Log validation warnings/suggestions
    if (validation.warnings.length > 0) {
      console.log(`⚠️ Validation warnings:`);
      validation.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    if (validation.suggestions.length > 0) {
      console.log(`💡 Suggestions:`);
      validation.suggestions.forEach(suggestion => console.log(`   - ${suggestion}`));
    }
    
    // Validate essential fields (with channel-specific defaults)
    if (!signal.contractAddress) {
      console.log(`⚠️ [${channelDisplay}] No contract address found, skipping`);
      return;
    }
    
    // Apply channel-specific confidence thresholds
    let requiredConfidence = 2; // Default
    if (channelInfo) {
      // Premium channels can have lower confidence requirements
      requiredConfidence = channelInfo.name.includes('Underdog') ? 2 : 2;
    }
    
    if (signal.confidence < requiredConfidence) {
      console.log(`⚠️ [${channelDisplay}] Low-confidence signal (${signal.confidence}/${requiredConfidence}), skipping`);
      return;
    }
    
    // Apply defaults for missing fields based on channel
    if (!signal.stopLossPercent) {
      if (channelInfo?.name.includes('Underdog')) {
        signal.stopLossPercent = 15; // Underdog default
        console.log(`🔧 [${channelDisplay}] Applied Underdog default stop loss: 15%`);
      } else if (channelInfo?.name.includes('Degen')) {
        signal.stopLossPercent = 20; // Degen default
        console.log(`🔧 [${channelDisplay}] Applied Degen default stop loss: 20%`);
      } else {
        signal.stopLossPercent = 20; // Generic default
        console.log(`🔧 [${channelDisplay}] Applied default stop loss: 20%`);
      }
    }
    
    if (!signal.tradePercent) {
      console.log(`🔧 [${channelDisplay}] Using default trade percentage: ${signal.tradePercent}%`);
    }
    
    // Safety check if enabled
    if (config.ENABLE_SAFETY_CHECKS) {
      console.log(`🔒 [${channelDisplay}] Performing safety check on ${signal.contractAddress}...`);
      const safetyResult = await tokenSafety.checkToken(signal.contractAddress);
      
      if (!safetyResult.isSafe) {
        stats.safetyRejections++;
        console.log(`❌ [${channelDisplay}] Token safety check failed: ${safetyResult.warnings.join(', ')}`);
        notifier.notifySafetyWarning(safetyResult, safetyResult.warnings);
        return;
      }
      
      console.log(`✅ [${channelDisplay}] Token passed safety checks. Liquidity: $${safetyResult.liquidity?.toFixed(2) || 'Unknown'}`);
      
      // Enrich signal with token info if available
      if (safetyResult.name) {
        signal.symbol = safetyResult.name;
      }
    }
    
    // Execute the trade
    try {
      const modeLabel = config.DRY_RUN ? '[DRY RUN] ' : '';
      console.log(`🔄 [${channelDisplay}] ${modeLabel}Executing trade for ${signal.contractAddress}...`);
      const result = await executeTrade(signal, { channelId: chatId, channelInfo });
      
      if (result.success) {
        stats.tradesExecuted++;
        
        // Update channel-specific trade stats
        if (!stats.tradesByChannel[chatId]) {
          stats.tradesByChannel[chatId] = 0;
        }
        stats.tradesByChannel[chatId]++;
        
        console.log(`✅ [${channelDisplay}] ${modeLabel}Trade executed successfully at ${result.entryPrice}`);
        
        // Store trade with enhanced metadata
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
          isDryRun: config.DRY_RUN,
          // Enhanced metadata
          sourceChannel: chatId,
          channelName: channelInfo?.name || 'Unknown',
          channelType: signal.channelType || 'generic',
          signalConfidence: signal.confidence
        };
        
        tradeStore.addTrade(tradeRecord);
        notifier.notifyTradeExecution(tradeRecord);
      } else {
        stats.tradesFailed++;
        console.error(`❌ [${channelDisplay}] ${modeLabel}Trade failed: ${result.error}`);
      }
    } catch (err) {
      stats.tradesFailed++;
      console.error(`❌ [${channelDisplay}] ${config.DRY_RUN ? '[DRY RUN] ' : ''}Unexpected error executing trade: ${err.message}`);
    }
  } catch (err) {
    console.error(`❌ Error processing message from ${chatId}: ${err.message}`);
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
  
  // Enhanced channel display with names
  const configChannelNames = config.getChannelNames ? config.getChannelNames() : {};
  if (config.TELEGRAM_CHANNEL_IDS.length > 0) {
    console.log(`🔄 Monitoring channels:`);
    config.TELEGRAM_CHANNEL_IDS.forEach(id => {
      const name = configChannelNames[id] || 'Custom channel';
      console.log(`   - ${id} (${name})`);
    });
  } else {
    console.warn(`⚠️ No Telegram channels configured. Use 'premium' command to add recommended channels.`);
  }
  
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
  stats         - Show bot statistics
  trades        - List active trades
  history       - Show trade history
  channels      - List configured Telegram channels
  premium       - Set up premium trading channels
  addchannel    - Add a channel (usage: addchannel <id>)
  removechannel - Remove a channel (usage: removechannel <id>)
  cancel        - Cancel a specific trade (usage: cancel <address>)
  safety        - Check token safety (usage: safety <address>)
  balance       - Check wallet balance
  listener      - Show listener statistics
  setup         - Run enhanced setup wizard
  mode          - Show current deployment mode
  ${config.DRY_RUN ? '[DRY RUN MODE ACTIVE - No real trades will be executed]' : '[LIVE TRADING MODE - Real funds at risk]'}
  exit          - Exit the bot
  help          - Show this help message
        `);
        break;
        
      case 'mode':
        console.log(displaySmallBanner(config));
        displayDeploymentStatus();
        break;
        
      case 'setup':
        console.log('\n🔧 Starting enhanced setup wizard...');
        await runEnhancedSetup();
        break;
        
      case 'stats':
        console.log(displaySmallBanner(config));
        const tradeStats = tradeStore.getTradeStats();
        const uptime = ((Date.now() - stats.botStartTime) / (1000 * 60 * 60)).toFixed(1);
        console.log(`
📊 Bot Statistics (${uptime}h uptime):
  Mode:               ${stats.deploymentMode === 'live' ? '💰 LIVE TRADING' : '🧪 PAPER TRADING'}
  Messages processed: ${stats.messagesReceived}
  Signals detected:   ${stats.signalsDetected}
  Trades executed:    ${stats.tradesExecuted}
  Failed trades:      ${stats.tradesFailed}
  Safety rejections:  ${stats.safetyRejections}
  
📈 Trade Performance:
  Total trades:       ${tradeStats.totalTrades}
  Active trades:      ${tradeStats.activeTrades}
  Closed trades:      ${tradeStats.closedTrades}
  Win rate:           ${tradeStats.winRate.toFixed(1)}%
  Total profit:       $${tradeStats.totalProfit.toFixed(2)}
  
📋 Channel Breakdown:`);
        
        // Show per-channel stats
        const channelNamesMap = config.getChannelNames ? config.getChannelNames() : {};
        Object.keys(stats.messagesByChannel).forEach(channelId => {
          const channelName = channelNamesMap[channelId] || `Channel ${channelId}`;
          const messages = stats.messagesByChannel[channelId] || 0;
          const signals = stats.signalsByChannel[channelId] || 0;
          const trades = stats.tradesByChannel[channelId] || 0;
          console.log(`  ${channelName}: ${messages} msgs, ${signals} signals, ${trades} trades`);
        });
        break;
        
      case 'listener':
        console.log(displaySmallBanner(config));
        const listenerStats = getMessageStats();
        const uptimeHours = (listenerStats.uptimeMs / (1000 * 60 * 60)).toFixed(1);
        console.log(`
📡 Listener Statistics:
  Uptime: ${uptimeHours} hours
  Total messages: ${listenerStats.totalMessages}
  Messages/hour: ${(listenerStats.totalMessages / parseFloat(uptimeHours)).toFixed(1)}
  Last message: ${listenerStats.lastMessageTime ? new Date(listenerStats.lastMessageTime).toLocaleTimeString() : 'Never'}
  
📋 Per-Channel Activity:`);
        
        const listenerChannelNames = config.getChannelNames ? config.getChannelNames() : {};
        Object.entries(listenerStats.messagesByChannel).forEach(([channelId, count]) => {
          const channelName = listenerChannelNames[channelId] || `Channel ${channelId}`;
          console.log(`  ${channelName}: ${count} messages`);
        });
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
            const channelLabel = trade.channelName ? ` (${trade.channelName})` : '';
            console.log(`  - ${trade.symbol || trade.contractAddress}${channelLabel}${dryRunLabel}: ${status}`);
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
        
      case 'channels':
        console.log(displaySmallBanner(config));
        if (config.TELEGRAM_CHANNEL_IDS.length === 0) {
          console.log("📭 No channels configured");
        } else {
          console.log("📋 Monitored channels:");
          const monitoredChannelNames = config.getChannelNames ? config.getChannelNames() : {};
          config.TELEGRAM_CHANNEL_IDS.forEach(id => {
            const name = monitoredChannelNames[id] || 'Custom channel';
            const messageCount = stats.messagesByChannel[id] || 0;
            const signalCount = stats.signalsByChannel[id] || 0;
            console.log(`  - ${id} (${name}) - ${messageCount} msgs, ${signalCount} signals`);
          });
        }
        break;

      case 'premium':
        console.log(displaySmallBanner(config));
        console.log("🔄 Setting up premium channels...");
        if (config.usePremiumChannels()) {
          console.log("✅ Premium channels configured successfully:");
          console.log("  - Underdog Calls Private (-1002209371269)");
          console.log("  - Degen (-1002277274250)");
        } else {
          console.log("❌ Failed to configure premium channels");
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
        else if (command.startsWith('addchannel ')) {
          const channelId = command.split(' ')[1];
          if (channelId) {
            if (config.isValidChannelId && config.isValidChannelId(channelId)) {
              console.log(`🔄 Adding channel ${channelId}...`);
              if (config.addChannel && config.addChannel(channelId)) {
                console.log("✅ Channel added successfully");
              } else {
                console.log("❌ Failed to add channel");
              }
            } else {
              console.log("⚠️ Invalid channel ID format");
            }
          } else {
            console.log("⚠️ Please specify a channel ID to add");
          }
        }
        else if (command.startsWith('removechannel ')) {
          const channelId = command.split(' ')[1];
          if (channelId) {
            console.log(`🔄 Removing channel ${channelId}...`);
            if (config.removeChannel && config.removeChannel(channelId)) {
              console.log("✅ Channel removed successfully");
            } else {
              console.log("❌ Failed to remove channel");
            }
          } else {
            console.log("⚠️ Please specify a channel ID to remove");
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

// Main entry point with enhanced setup integration
async function main() {
  try {
    // Check if setup is needed
    const setupRan = await checkAndRunSetup();
    if (setupRan) return; // Exit if setup was run
    
    // Display deployment status
    displayDeploymentStatus();
    
    // Start the bot
    await startBot();
    
  } catch (error) {
    console.error('❌ Failed to start CrestX:', error.message);
    process.exit(1);
  }
}

// Start the bot with enhanced setup integration
main()
  .then(() => {
    setupCliCommands();
  })
  .catch(err => {
    console.error("❌ Failed to start bot:", err);
    process.exit(1);
  });