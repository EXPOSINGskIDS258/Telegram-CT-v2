#!/usr/bin/env node
// index.js - Main entry point with enhanced menu system integration
const fs = require('fs');
const path = require('path');

// Check if configuration exists, if not run interactive setup
async function checkConfigurationAndStart() {
  const configExists = fs.existsSync('.env');
  
  if (!configExists) {
    console.log('🔧 No configuration found. Starting interactive setup...\n');
    
    // Import and run interactive setup
    const { InteractiveSetup } = require('./setup');
    const setup = new InteractiveSetup();
    
    try {
      await setup.start();
      
      // Wait a moment for user to read the summary
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Now start the main bot
      console.log('🚀 Starting CrestX...\n');
      startMainBot();
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  } else {
    // Configuration exists, start normally
    startMainBot();
  }
}

// Main bot functionality with enhanced menu system
function startMainBot() {
  // Now require all the modules after setup is complete
  const readline = require("readline");
  const { startListener, getMessageStats } = require("./listener");
  const { parseMemeCoinMessage, validateParsedSignal } = require("./parser");
  const { executeTrade, cancelTrade, getActiveTrades, getDryRunBalance } = require("./trader");
  const tokenSafety = require("./tokenSafety");
  const tradeStore = require("./tradeStore");
  const notifier = require("./notifier");
  const config = require("./config");
  const { displayBanner, displaySmallBanner } = require("./banner");
  const { EnhancedMenu } = require("./enhanced-menu");

  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize enhanced menu system
  const enhancedMenu = new EnhancedMenu();

  // Create readline interface with enhanced menu integration
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "crestx> "
  });

  // Initialize the enhanced menu
  enhancedMenu.initialize(rl);

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
    
    const channelCount = config.TELEGRAM_CHANNEL_IDS ? config.TELEGRAM_CHANNEL_IDS.length : 0;
    console.log(`\n📡 Monitoring ${channelCount} channels for trading signals...`);
    console.log('\n💡 Type "menu" or "help" for available commands');
    console.log('💡 Use "dashboard" for real-time monitoring\n');
  }

  // Start the bot
  async function startBot() {
    console.log(displayBanner(config));
    
    // Validate configuration
    validateConfig();
    
    // Display status
    displayDeploymentStatus();
    
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
      
      // Don't show prompt here, let the enhanced menu handle it
    });
    
    // Show initial menu after successful start
    setTimeout(() => {
      enhancedMenu.showMainMenu();
      rl.prompt();
    }, 1000);
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
        signal.tradePercent = config.MAX_TRADE_PERCENT;
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
        
        console.log(`✅ [${channelDisplay}] Token passed safety checks. Liquidity: ${safetyResult.liquidity?.toFixed(2) || 'Unknown'}`);
        
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
      console.log('\n🔧 Run the interactive setup to fix this:');
      console.log('   Delete the .env file and restart the application\n');
      process.exit(1);
    }
    
    console.log(`✅ Configuration validated successfully!`);
    console.log(`📡 Mode: ${config.DRY_RUN ? "Paper Trading" : "Live Trading"}`);
    console.log(`📊 Max trade: ${config.MAX_TRADE_PERCENT}%`);
    console.log(`🛑 Stop loss: Trailing ${config.USE_TRAILING_STOP ? "enabled" : "disabled"} (${config.TRAILING_STOP_PERCENT}%)`);
    console.log(`🔒 Safety checks: ${config.ENABLE_SAFETY_CHECKS ? "enabled" : "disabled"}`);
  }

  // Enhanced CLI with menu system integration
  function setupCliCommands() {
    rl.prompt();
    
    rl.on('line', async (line) => {
      const command = line.trim();
      
      // Let the enhanced menu handle all commands
      const continueRunning = await enhancedMenu.handleCommand(command);
      
      if (!continueRunning) {
        console.log("👋 Shutting down...");
        enhancedMenu.shutdown();
        process.exit(0);
      }
      
      rl.prompt();
    }).on('close', () => {
      console.log("👋 Shutting down...");
      enhancedMenu.shutdown();
      process.exit(0);
    });
  }

  // Start the main bot
  startBot()
    .then(() => {
      setupCliCommands();
    })
    .catch(err => {
      console.error("❌ Failed to start bot:", err);
      process.exit(1);
    });
}

// Entry point - check config and start
checkConfigurationAndStart().catch(err => {
  console.error('❌ Failed to start CrestX:', err.message);
  process.exit(1);
});