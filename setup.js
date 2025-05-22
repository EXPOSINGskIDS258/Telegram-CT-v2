// interactive-setup.js - Complete Interactive Setup for EXE Distribution
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { displayBanner } = require('./banner');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class InteractiveSetup {
  constructor() {
    this.config = {};
    this.isFirstRun = !fs.existsSync('.env');
  }

  async start() {
    console.clear();
    this.displayWelcome();
    
    try {
      // Step 1: Choose trading mode
      await this.chooseTradingMode();
      
      // Step 2: Telegram API Configuration  
      await this.setupTelegramAPI();
      
      // Step 3: Trading Parameters
      await this.setupTradingParameters();
      
      // Step 4: Risk Management
      await this.setupRiskManagement();
      
      // Step 5: Channel Configuration
      await this.setupChannels();
      
      // Step 6: Mode-specific settings
      if (this.config.DRY_RUN === 'false') {
        await this.setupLiveTrading();
      } else {
        await this.setupPaperTrading();
      }
      
      // Step 7: Advanced Settings (optional)
      await this.setupAdvancedSettings();
      
      // Step 8: Save configuration
      await this.saveConfiguration();
      
      // Step 9: Final summary
      this.displaySummary();
      
    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  displayWelcome() {
    console.log(displayBanner({}));
    console.log('\n🎯 \x1b[1m\x1b[36mWELCOME TO CRESTX SETUP WIZARD\x1b[0m');
    console.log('\x1b[90mThis wizard will configure your memecoin trading bot step by step.\x1b[0m');
    console.log('\x1b[90mPress Enter to use default values shown in [brackets].\x1b[0m\n');
    
    if (this.isFirstRun) {
      console.log('🔧 \x1b[33mFirst-time setup detected. Let\'s get you configured!\x1b[0m\n');
    } else {
      console.log('⚙️ \x1b[32mUpdating existing configuration...\x1b[0m\n');
    }
  }

  async chooseTradingMode() {
    console.log('\x1b[1m\x1b[37m📊 STEP 1: TRADING MODE SELECTION\x1b[0m');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║  🧪 PAPER TRADING (RECOMMENDED FOR BEGINNERS)               ║');
    console.log('║     • Practice with virtual money ($1,000 starting balance) ║');
    console.log('║     • Learn the system risk-free                            ║');
    console.log('║     • Test your strategies                                   ║');
    console.log('║     • No real money at risk                                  ║');
    console.log('║                                                              ║');
    console.log('║  💰 LIVE TRADING (ADVANCED USERS ONLY)                      ║');
    console.log('║     • Trade with real Solana/USDC                           ║');
    console.log('║     • Potential for real profits AND losses                 ║');
    console.log('║     • Requires wallet private key                           ║');
    console.log('║     • HIGH RISK - Only invest what you can afford to lose   ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    const choice = await this.askQuestion('\n🎯 Choose mode (1=Paper Trading, 2=Live Trading) [1]: ') || '1';
    
    if (choice === '2') {
      this.config.DRY_RUN = 'false';
      await this.showRiskWarning();
    } else {
      this.config.DRY_RUN = 'true';
      console.log('\n✅ \x1b[32mPaper Trading selected - Safe learning environment!\x1b[0m');
    }
  }

  async showRiskWarning() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ⚠️  RISK WARNING ⚠️                        ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  • Cryptocurrency trading involves substantial risk          ║');
    console.log('║  • Memecoin trading is EXTREMELY HIGH RISK                  ║');
    console.log('║  • You could lose your entire investment                     ║');
    console.log('║  • Only trade with money you can afford to lose             ║');
    console.log('║  • Past performance does not guarantee future results       ║');
    console.log('║  • This bot is provided as-is with no guarantees            ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    const accept = await this.askQuestion('\n💼 I understand and accept these risks (type "I ACCEPT"): ');
    
    if (accept !== 'I ACCEPT') {
      console.log('\n🔄 Switching to Paper Trading for your safety...');
      this.config.DRY_RUN = 'true';
    } else {
      console.log('\n⚡ \x1b[31mLive Trading mode confirmed - Proceed with caution!\x1b[0m');
    }
  }

  async setupTelegramAPI() {
    console.log('\n\x1b[1m\x1b[37m📱 STEP 2: TELEGRAM API CONFIGURATION\x1b[0m');
    console.log('You need Telegram API credentials to monitor trading signals.');
    console.log('\x1b[90mGet them from: https://my.telegram.org/apps\x1b[0m\n');
    
    console.log('📋 How to get your Telegram API credentials:');
    console.log('   1. Go to https://my.telegram.org/apps');
    console.log('   2. Log in with your phone number');
    console.log('   3. Click "Create Application"');
    console.log('   4. Fill in any app name (e.g., "CrestX Bot")');
    console.log('   5. Copy the API ID and API Hash\n');

    this.config.API_ID = await this.askQuestion('🔑 Enter your Telegram API ID: ');
    this.config.API_HASH = await this.askQuestion('🔐 Enter your Telegram API Hash: ');
    
    if (!this.config.API_ID || !this.config.API_HASH) {
      throw new Error('Telegram API credentials are required!');
    }
    
    console.log('✅ \x1b[32mTelegram API configured successfully!\x1b[0m');
  }

  async setupTradingParameters() {
    console.log('\n\x1b[1m\x1b[37m💰 STEP 3: TRADING PARAMETERS\x1b[0m');
    
    const maxTrade = await this.askQuestion('💰 Maximum % of balance to risk per trade [5]: ') || '5';
    this.config.MAX_TRADE_PERCENT = maxTrade;
    
    console.log(`\n💡 Trade size explanation:`);
    console.log(`   • With ${maxTrade}% per trade, you can make ~${Math.floor(100/parseFloat(maxTrade))} trades`);
    console.log(`   • Higher % = bigger profits but higher risk`);
    console.log(`   • Lower % = safer but smaller profits`);
  }

  async setupRiskManagement() {
    console.log('\n\x1b[1m\x1b[37m🛡️ STEP 4: RISK MANAGEMENT\x1b[0m');
    
    const useTrailing = await this.askYesNo('Enable trailing stop loss (recommended)', true);
    this.config.USE_TRAILING_STOP = useTrailing;
    
    if (this.config.USE_TRAILING_STOP === 'true') {
      const trailingPercent = await this.askQuestion('📉 Trailing stop percentage [20]: ') || '20';
      this.config.TRAILING_STOP_PERCENT = trailingPercent;
      
      console.log(`\n💡 Trailing stop explanation:`);
      console.log(`   • Protects profits by following price up`);
      console.log(`   • Sells if price drops ${trailingPercent}% from peak`);
      console.log(`   • Helps you "ride the pump" while protecting downside`);
    }
    
    const slippage = await this.askQuestion('⚡ Slippage tolerance % (higher = faster fills) [3]: ') || '3';
    this.config.DEFAULT_SLIPPAGE = slippage;
    this.config.EXIT_SLIPPAGE = String(parseFloat(slippage) + 2); // Higher for exits
    
    console.log(`\n💡 Slippage explanation:`);
    console.log(`   • ${slippage}% = balance between speed and price`);
    console.log(`   • Higher = trades execute faster but at worse prices`);
    console.log(`   • Lower = better prices but trades might fail`);
  }

  async setupChannels() {
    console.log('\n\x1b[1m\x1b[37m📡 STEP 5: SIGNAL CHANNELS\x1b[0m');
    console.log('CrestX monitors Telegram channels for trading signals.\n');
    
    console.log('🔥 \x1b[1m\x1b[31mPREMIUM CHANNELS (RECOMMENDED):\x1b[0m');
    console.log('   • Underdog Calls Private - High-quality memecoin signals');
    console.log('   • Degen Channel - High-risk, high-reward calls');
    console.log('   • Optimized parsing for these specific channels');
    console.log('   • Better win rates and risk management\n');
    
    const usePremium = await this.askYesNo('Use recommended premium channels', true);
    
    if (usePremium === 'true') {
      this.config.TELEGRAM_CHANNEL_IDS = '-1002209371269,-1002277274250';
      console.log('✅ \x1b[32mPremium channels configured!\x1b[0m');
      
      const addCustom = await this.askYesNo('Add additional custom channels', false);
      if (addCustom === 'true') {
        const customChannels = await this.askQuestion('📱 Enter custom channel IDs (comma-separated): ');
        if (customChannels.trim()) {
          this.config.TELEGRAM_CHANNEL_IDS += ',' + customChannels;
        }
      }
    } else {
      console.log('\n📋 How to find channel IDs:');
      console.log('   1. Add @userinfobot to your Telegram');
      console.log('   2. Forward a message from the channel to the bot');
      console.log('   3. Copy the channel ID (starts with -100)\n');
      
      this.config.TELEGRAM_CHANNEL_IDS = await this.askQuestion('📱 Enter channel IDs (comma-separated): ');
    }
    
    if (!this.config.TELEGRAM_CHANNEL_IDS) {
      throw new Error('At least one channel is required!');
    }
    
    const channelCount = this.config.TELEGRAM_CHANNEL_IDS.split(',').length;
    console.log(`✅ \x1b[32mConfigured ${channelCount} channel${channelCount > 1 ? 's' : ''} for monitoring!\x1b[0m`);
  }

  async setupLiveTrading() {
    console.log('\n\x1b[1m\x1b[37m🔗 STEP 6: LIVE TRADING SETUP\x1b[0m');
    
    console.log('💳 \x1b[1m\x1b[33mWALLET CONFIGURATION:\x1b[0m');
    console.log('You need a Solana wallet with USDC for trading.');
    console.log('\x1b[90mYour private key will be stored securely on your computer.\x1b[0m\n');
    
    const hasWallet = await this.askYesNo('Do you have a Solana wallet with USDC', false);
    
    if (hasWallet === 'false') {
      console.log('\n📋 \x1b[33mWallet Setup Guide:\x1b[0m');
      console.log('   1. Install Phantom wallet (phantom.app)');
      console.log('   2. Create a new wallet or import existing');
      console.log('   3. Buy some SOL and USDC');
      console.log('   4. Export your private key from wallet settings');
      console.log('   5. Come back and run setup again\n');
      
      throw new Error('Please set up a wallet first and run setup again.');
    }
    
    console.log('\n🔐 \x1b[31mIMPORTANT SECURITY NOTES:\x1b[0m');
    console.log('   • Your private key stays on YOUR computer only');
    console.log('   • Never share your private key with anyone');
    console.log('   • Use a dedicated trading wallet (not your main wallet)');
    console.log('   • Start with small amounts to test\n');
    
    this.config.WALLET_PRIVATE_KEY = await this.askQuestion('🔐 Enter your wallet private key (hex format): ');
    
    if (!this.config.WALLET_PRIVATE_KEY || this.config.WALLET_PRIVATE_KEY.length < 64) {
      throw new Error('Invalid private key format!');
    }
    
    console.log('✅ \x1b[32mWallet configured successfully!\x1b[0m');
    
    // RPC Configuration
    console.log('\n🌐 \x1b[1m\x1b[37mRPC ENDPOINT CONFIGURATION:\x1b[0m');
    const rpcChoice = await this.askQuestion('Choose RPC (1=Free, 2=Premium, 3=Custom) [1]: ') || '1';
    
    switch (rpcChoice) {
      case '2':
        console.log('\n💎 Premium RPC providers (faster execution):');
        console.log('   • Alchemy: https://solana-mainnet.g.alchemy.com/v2/YOUR-API-KEY');
        console.log('   • QuickNode: https://your-endpoint.solana-mainnet.quiknode.pro/');
        console.log('   • Helius: https://rpc.helius.xyz/?api-key=YOUR-API-KEY\n');
        this.config.RPC_ENDPOINT = await this.askQuestion('🔗 Enter premium RPC URL: ');
        break;
      case '3':
        this.config.RPC_ENDPOINT = await this.askQuestion('🔗 Enter custom RPC URL: ');
        break;
      default:
        this.config.RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
        console.log('📡 Using free RPC (may be slower during high traffic)');
    }
    
    // Priority Fee
    const priorityFee = await this.askQuestion('⚡ Transaction priority fee in lamports [50000]: ') || '50000';
    this.config.PRIORITY_FEE_LAMPORTS = priorityFee;
    
    console.log(`\n💡 Priority fee explanation:`);
    console.log(`   • ${priorityFee} lamports ≈ $${(parseFloat(priorityFee) * 0.000000001 * 100).toFixed(4)} per transaction`);
    console.log(`   • Higher fees = faster transaction confirmation`);
    console.log(`   • Essential for memecoin trading speed`);
  }

  async setupPaperTrading() {
    console.log('\n\x1b[1m\x1b[37m🧪 STEP 6: PAPER TRADING SETUP\x1b[0m');
    
    const balance = await this.askQuestion('💵 Starting virtual balance in USDC [1000]: ') || '1000';
    this.config.DRY_RUN_BALANCE = balance;
    
    const volatility = await this.askQuestion('📊 Price volatility simulation % [5]: ') || '5';
    this.config.DRY_RUN_PRICE_VOLATILITY = volatility;
    
    console.log(`\n✅ Paper trading configured:`);
    console.log(`   • Starting with $${balance} virtual USDC`);
    console.log(`   • ${volatility}% price volatility simulation`);
    console.log(`   • Perfect for learning and testing strategies!`);
  }

  async setupAdvancedSettings() {
    console.log('\n\x1b[1m\x1b[37m⚙️ STEP 7: ADVANCED SETTINGS\x1b[0m');
    
    const showAdvanced = await this.askYesNo('Configure advanced settings', false);
    
    if (showAdvanced === 'true') {
      console.log('\n🛡️ \x1b[1mSAFETY SETTINGS:\x1b[0m');
      
      this.config.ENABLE_SAFETY_CHECKS = await this.askYesNo('Enable token safety checks (recommended)', true);
      
      if (this.config.ENABLE_SAFETY_CHECKS === 'true') {
        const minLiquidity = await this.askQuestion('💧 Minimum liquidity in USD [5000]: ') || '5000';
        this.config.MIN_LIQUIDITY_USD = minLiquidity;
        
        const maxImpact = await this.askQuestion('📊 Maximum price impact % [10]: ') || '10';
        this.config.MAX_PRICE_IMPACT = maxImpact;
        
        const minAge = await this.askQuestion('⏰ Minimum token age in seconds [300]: ') || '300';
        this.config.MIN_TOKEN_AGE_SECONDS = minAge;
        
        console.log('\n💡 Safety checks will filter out:');
        console.log(`   • Tokens with less than $${minLiquidity} liquidity`);
        console.log(`   • Trades with more than ${maxImpact}% price impact`);
        console.log(`   • Tokens newer than ${Math.floor(minAge/60)} minutes`);
      }
      
      console.log('\n🔔 \x1b[1mNOTIFICATIONS:\x1b[0m');
      this.config.ENABLE_NOTIFICATIONS = await this.askYesNo('Enable Telegram notifications', false);
      
      if (this.config.ENABLE_NOTIFICATIONS === 'true') {
        console.log('\n📋 To enable notifications:');
        console.log('   1. Create a Telegram bot via @BotFather');
        console.log('   2. Get your chat ID from @userinfobot');
        console.log('   3. Enter the details below\n');
        
        this.config.TELEGRAM_BOT_TOKEN = await this.askQuestion('🤖 Bot token: ');
        this.config.NOTIFICATION_CHAT_ID = await this.askQuestion('💬 Chat ID: ');
      }
    } else {
      // Set safe defaults
      this.config.ENABLE_SAFETY_CHECKS = 'true';
      this.config.MIN_LIQUIDITY_USD = '5000';
      this.config.MAX_PRICE_IMPACT = '10';
      this.config.MIN_TOKEN_AGE_SECONDS = '300';
      this.config.ENABLE_NOTIFICATIONS = 'false';
    }
  }

  async saveConfiguration() {
    console.log('\n\x1b[1m\x1b[37m💾 STEP 8: SAVING CONFIGURATION\x1b[0m');
    
    const envContent = this.generateEnvContent();
    
    try {
      fs.writeFileSync('.env', envContent);
      console.log('✅ \x1b[32mConfiguration saved successfully!\x1b[0m');
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  displaySummary() {
    console.log('\n\x1b[1m\x1b[37m📋 CONFIGURATION SUMMARY\x1b[0m');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    
    const mode = this.config.DRY_RUN === 'true' ? 'Paper Trading' : 'Live Trading';
    const modeColor = this.config.DRY_RUN === 'true' ? '\x1b[33m' : '\x1b[31m';
    console.log(`║  Mode: ${modeColor}${mode.padEnd(52)}\x1b[0m║`);
    
    const channelCount = this.config.TELEGRAM_CHANNEL_IDS.split(',').length;
    console.log(`║  Channels: ${channelCount} configured${' '.repeat(39)}║`);
    console.log(`║  Max Trade Size: ${this.config.MAX_TRADE_PERCENT}%${' '.repeat(44)}║`);
    console.log(`║  Trailing Stop: ${this.config.USE_TRAILING_STOP === 'true' ? 'Enabled' : 'Disabled'}${' '.repeat(43)}║`);
    console.log(`║  Safety Checks: ${this.config.ENABLE_SAFETY_CHECKS === 'true' ? 'Enabled' : 'Disabled'}${' '.repeat(43)}║`);
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    console.log('\n🎉 \x1b[1m\x1b[32mCRESTX IS NOW CONFIGURED AND READY!\x1b[0m');
    console.log('\n📋 Next steps:');
    console.log('   1. The bot will start automatically');
    console.log('   2. Monitor the console for trading activity');
    console.log('   3. Use commands like "stats", "balance", "trades"');
    console.log('   4. Type "help" anytime for available commands');
    
    if (this.config.DRY_RUN === 'true') {
      console.log('\n🧪 \x1b[33mPaper Trading Mode - No real money at risk!\x1b[0m');
    } else {
      console.log('\n⚠️ \x1b[31mLive Trading Mode - Real money at risk!\x1b[0m');
      console.log('   • Start with small amounts');
      console.log('   • Monitor closely');
      console.log('   • Never risk more than you can afford to lose');
    }
    
    console.log('\n🚀 Starting CrestX in 3 seconds...\n');
  }

  generateEnvContent() {
    const timestamp = new Date().toISOString();
    const mode = this.config.DRY_RUN === 'true' ? 'PAPER TRADING' : 'LIVE TRADING';
    
    return `# ================================================================
# CRESTX MEMECOIN TRADING BOT CONFIGURATION
# Generated: ${timestamp}
# Mode: ${mode}
# ================================================================

# TELEGRAM SETTINGS
API_ID=${this.config.API_ID}
API_HASH=${this.config.API_HASH}
SESSION_NAME=
TELEGRAM_CHANNEL_IDS=${this.config.TELEGRAM_CHANNEL_IDS}

# TRADE SETTINGS
MAX_TRADE_PERCENT=${this.config.MAX_TRADE_PERCENT}
USE_TRAILING_STOP=${this.config.USE_TRAILING_STOP}
TRAILING_STOP_PERCENT=${this.config.TRAILING_STOP_PERCENT || '20'}
DEFAULT_SLIPPAGE=${this.config.DEFAULT_SLIPPAGE}
EXIT_SLIPPAGE=${this.config.EXIT_SLIPPAGE}

# SAFETY CHECKS
ENABLE_SAFETY_CHECKS=${this.config.ENABLE_SAFETY_CHECKS || 'true'}
MIN_LIQUIDITY_USD=${this.config.MIN_LIQUIDITY_USD || '5000'}
MAX_PRICE_IMPACT=${this.config.MAX_PRICE_IMPACT || '10'}
MIN_TOKEN_AGE_SECONDS=${this.config.MIN_TOKEN_AGE_SECONDS || '300'}
BLACKLISTED_TOKENS=

# SOLANA/JUPITER SETTINGS
RPC_ENDPOINT=${this.config.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'}
BACKUP_RPC_ENDPOINTS=https://solana-api.projectserum.com
NETWORK=mainnet-beta
${this.config.WALLET_PRIVATE_KEY ? `WALLET_PRIVATE_KEY=${this.config.WALLET_PRIVATE_KEY}` : 'WALLET_PRIVATE_KEY='}
USDC_MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
PRIORITY_FEE_LAMPORTS=${this.config.PRIORITY_FEE_LAMPORTS || '50000'}

# DRY RUN / PAPER TRADING SETTINGS
DRY_RUN=${this.config.DRY_RUN}
DRY_RUN_BALANCE=${this.config.DRY_RUN_BALANCE || '1000'}
DRY_RUN_PRICE_VOLATILITY=${this.config.DRY_RUN_PRICE_VOLATILITY || '5'}

# NOTIFICATION SETTINGS
ENABLE_NOTIFICATIONS=${this.config.ENABLE_NOTIFICATIONS || 'false'}
NOTIFICATION_CHAT_ID=${this.config.NOTIFICATION_CHAT_ID || ''}
TELEGRAM_BOT_TOKEN=${this.config.TELEGRAM_BOT_TOKEN || ''}

# ADVANCED SETTINGS
MONITOR_INTERVAL_MS=10000
ERROR_RETRY_DELAY_MS=5000
MAX_RETRIES=3
LOG_LEVEL=info

# ================================================================
# Configuration complete! Your bot is ready to trade.
# ${mode} mode selected.
# ================================================================`;
  }

  askQuestion(question) {
    return new Promise(resolve => {
      rl.question(question, resolve);
    });
  }

  async askYesNo(question, defaultValue = false) {
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    const answer = await this.askQuestion(`${question}? [${defaultText}]: `);
    
    if (!answer.trim()) {
      return defaultValue ? 'true' : 'false';
    }
    
    return answer.toLowerCase().startsWith('y') ? 'true' : 'false';
  }
}

module.exports = { InteractiveSetup };

// If run directly, start the setup
if (require.main === module) {
  const setup = new InteractiveSetup();
  setup.start().catch(console.error);
}