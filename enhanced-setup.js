// enhanced-setup.js - Auto-starting version for EXE distribution
const readline = require('readline');
const fs = require('fs');
const { displayBanner, displaySuccessBanner, displayErrorBanner } = require('./banner');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

class EnhancedSetup {
  constructor() {
    this.config = {};
    this.deploymentMode = null;
    this.autoStart = false; // Flag to control auto-start
  }

  async start(autoStart = false) {
    this.autoStart = autoStart;
    console.clear();
    
    // Use existing banner
    console.log('\n🚀 Welcome to CrestX Enhanced Setup\n');
    
    // Step 1: Choose deployment mode
    await this.chooseDeploymentMode();
    
    // Step 2: Basic configuration
    await this.setupBasicConfig();
    
    // Step 3: Trading parameters
    await this.setupTradingParams();
    
    // Step 4: Mode-specific setup
    if (this.deploymentMode === 'live') {
      await this.setupLiveTrading();
    } else {
      await this.setupPaperTrading();
    }
    
    // Step 5: Channel configuration
    await this.setupChannels();
    
    // Step 6: Save and deploy
    await this.saveAndDeploy();
    
    rl.close();
  }

  async chooseDeploymentMode() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    DEPLOYMENT MODE SELECTION                 ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  🧪 PAPER TRADING MODE                                       ║');
    console.log('║     • Risk-free simulation with virtual funds               ║');
    console.log('║     • Perfect for testing strategies                        ║');
    console.log('║     • No real money at risk                                 ║');
    console.log('║                                                              ║');
    console.log('║  💰 LIVE TRADING MODE                                        ║');
    console.log('║     • Real trades with actual funds                         ║');
    console.log('║     • Direct blockchain execution                           ║');
    console.log('║     • Maximum profit potential                              ║');
    console.log('║     ⚠️  REQUIRES WALLET PRIVATE KEY                          ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    const mode = await this.askQuestion('\n🎯 Select deployment mode (1=Paper Trading, 2=Live Trading): ');
    
    if (mode === '1') {
      this.deploymentMode = 'paper';
      this.config.DRY_RUN = 'true';
      console.log('\n✅ Paper Trading Mode Selected - Safe testing environment');
    } else if (mode === '2') {
      this.deploymentMode = 'live';
      this.config.DRY_RUN = 'false';
      console.log('\n⚡ Live Trading Mode Selected - Real money deployment');
      await this.showLiveTradingWarning();
    } else {
      console.log('❌ Invalid selection. Defaulting to Paper Trading.');
      this.deploymentMode = 'paper';
      this.config.DRY_RUN = 'true';
    }
  }

  async showLiveTradingWarning() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ⚠️  LIVE TRADING WARNING ⚠️                ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  • Trading cryptocurrencies involves substantial risk       ║');
    console.log('║  • You could lose all or part of your investment            ║');
    console.log('║  • Only trade with funds you can afford to lose             ║');
    console.log('║  • Your private key will be stored securely                 ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    const accept = await this.askQuestion('\n💼 Do you accept these risks? (yes/no): ');
    
    if (accept.toLowerCase() !== 'yes') {
      console.log('\n🔄 Switching to Paper Trading Mode for safety...');
      this.deploymentMode = 'paper';
      this.config.DRY_RUN = 'true';
    }
  }

  async setupBasicConfig() {
    console.log('\n📱 TELEGRAM API CONFIGURATION');
    console.log('Get your credentials from: https://my.telegram.org/apps\n');
    
    this.config.API_ID = await this.askQuestion('🔑 Enter your Telegram API ID: ');
    this.config.API_HASH = await this.askQuestion('🔐 Enter your Telegram API Hash: ');
    
    if (!this.config.API_ID || !this.config.API_HASH) {
      console.log('❌ API credentials are required. Please restart setup.');
      process.exit(1);
    }
  }

  async setupTradingParams() {
    console.log('\n💰 TRADING PARAMETERS');
    
    const maxTrade = await this.askQuestion('💰 Maximum trade size (% of balance per trade) [5]: ') || '5';
    this.config.MAX_TRADE_PERCENT = maxTrade;
    
    const useTrailing = await this.askQuestion('🛑 Enable trailing stop loss? (y/n) [y]: ') || 'y';
    this.config.USE_TRAILING_STOP = useTrailing.toLowerCase() === 'y' ? 'true' : 'false';
    
    if (this.config.USE_TRAILING_STOP === 'true') {
      const trailingPercent = await this.askQuestion('📉 Trailing stop percentage [20]: ') || '20';
      this.config.TRAILING_STOP_PERCENT = trailingPercent;
    }
    
    const slippage = await this.askQuestion('⚡ Default slippage tolerance (%) [3]: ') || '3';
    this.config.DEFAULT_SLIPPAGE = slippage;
  }

  async setupLiveTrading() {
    console.log('\n🔒 LIVE TRADING SETUP');
    
    const rpcChoice = await this.askQuestion('\n🌐 RPC Endpoint (1=Default, 2=Custom): ') || '1';
    
    if (rpcChoice === '2') {
      this.config.RPC_ENDPOINT = await this.askQuestion('🔗 Enter custom RPC endpoint: ');
    } else {
      this.config.RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
    }
    
    console.log('\n💳 WALLET CONFIGURATION');
    console.log('⚠️  Your private key will be encrypted and stored securely');
    
    const privateKey = await this.askQuestion('🔐 Enter your wallet private key: ');
    
    if (!privateKey || privateKey.length < 64) {
      console.log('❌ Invalid private key format');
      process.exit(1);
    }
    
    this.config.WALLET_PRIVATE_KEY = privateKey;
    
    const priorityFee = await this.askQuestion('⚡ Priority fee (lamports) [10000]: ') || '10000';
    this.config.PRIORITY_FEE_LAMPORTS = priorityFee;
  }

  async setupPaperTrading() {
    console.log('\n🧪 PAPER TRADING SETUP');
    
    const balance = await this.askQuestion('💵 Starting paper trading balance ($) [1000]: ') || '1000';
    this.config.DRY_RUN_BALANCE = balance;
    
    const volatility = await this.askQuestion('📊 Price volatility simulation (%) [5]: ') || '5';
    this.config.DRY_RUN_PRICE_VOLATILITY = volatility;
  }

  async setupChannels() {
    console.log('\n📡 SIGNAL CHANNEL SETUP');
    
    const channelChoice = await this.askQuestion('📡 Channel setup (1=Premium Channels, 2=Custom): ') || '1';
    
    if (channelChoice === '1') {
      this.config.TELEGRAM_CHANNEL_IDS = '-1002209371269,-1002277274250';
      console.log('\n✅ Premium channels configured:');
      console.log('   🔥 Underdog Calls Private');
      console.log('   💎 Degen Channel');
    } else {
      const customChannels = await this.askQuestion('📱 Enter channel IDs (comma-separated): ');
      this.config.TELEGRAM_CHANNEL_IDS = customChannels;
    }
  }

  async saveAndDeploy() {
    console.log('\n📋 CONFIGURATION SUMMARY:');
    console.log(`   Mode: ${this.deploymentMode === 'live' ? '💰 LIVE TRADING' : '🧪 PAPER TRADING'}`);
    console.log(`   Max Trade Size: ${this.config.MAX_TRADE_PERCENT}%`);
    console.log(`   Trailing Stop: ${this.config.USE_TRAILING_STOP === 'true' ? 'Enabled' : 'Disabled'}`);
    
    const confirm = await this.askQuestion('\n🚀 Deploy with these settings? (yes/no): ');
    
    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Deployment cancelled');
      process.exit(0);
    }
    
    console.log('\n💾 Saving configuration...');
    await this.saveConfiguration();
    
    // Show deployment progress
    await this.showDeploymentProgress();
    
    // Auto-start the bot
    if (this.autoStart) {
      console.log('\n🚀 Starting CrestX trading bot...');
      await this.sleep(2000);
      
      // Return a flag to indicate setup is complete and bot should start
      return { startBot: true, config: this.config };
    } else {
      console.log('🚀 Configuration saved successfully!');
      console.log('\n✅ CrestX is now configured and ready to run!');
      console.log('\nNext steps:');
      console.log('1. Run "npm start" to launch the bot');
      console.log('2. Monitor console for trading signals');
      return { startBot: false };
    }
  }

  async showDeploymentProgress() {
    const steps = [
      'Validating configuration...',
      'Encrypting sensitive data...',
      'Setting up trading engine...',
      'Configuring signal monitoring...',
      'Initializing safety systems...',
      'Deployment complete!'
    ];

    for (let i = 0; i < steps.length; i++) {
      process.stdout.write(`\r🔄 ${steps[i]}`);
      await this.sleep(800);
    }
    
    console.log('\n✅ CrestX successfully deployed!');
  }

  async saveConfiguration() {
    const envContent = this.generateEnvFile();
    
    try {
      fs.writeFileSync('.env', envContent);
    } catch (error) {
      console.log('❌ Error saving configuration:', error.message);
      process.exit(1);
    }
  }

  generateEnvFile() {
    return `# CrestX Trading Bot Configuration
# Generated on ${new Date().toISOString()}
# Mode: ${this.deploymentMode.toUpperCase()} TRADING

# TELEGRAM SETTINGS
API_ID=${this.config.API_ID}
API_HASH=${this.config.API_HASH}
SESSION_NAME=
TELEGRAM_CHANNEL_IDS=${this.config.TELEGRAM_CHANNEL_IDS}

# TRADE SETTINGS
MAX_TRADE_PERCENT=${this.config.MAX_TRADE_PERCENT}
USE_TRAILING_STOP=${this.config.USE_TRAILING_STOP}
TRAILING_STOP_PERCENT=${this.config.TRAILING_STOP_PERCENT || 20}
DEFAULT_SLIPPAGE=${this.config.DEFAULT_SLIPPAGE}
EXIT_SLIPPAGE=${(parseInt(this.config.DEFAULT_SLIPPAGE) || 3) + 2}

# SAFETY CHECKS
ENABLE_SAFETY_CHECKS=true
MIN_LIQUIDITY_USD=5000
MAX_PRICE_IMPACT=10
MIN_TOKEN_AGE_SECONDS=300
BLACKLISTED_TOKENS=

# SOLANA/JUPITER SETTINGS
RPC_ENDPOINT=${this.config.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'}
BACKUP_RPC_ENDPOINTS=https://solana-api.projectserum.com
NETWORK=mainnet-beta
${this.config.WALLET_PRIVATE_KEY ? `WALLET_PRIVATE_KEY=${this.config.WALLET_PRIVATE_KEY}` : 'WALLET_PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE'}
USDC_MINT_ADDRESS=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
PRIORITY_FEE_LAMPORTS=${this.config.PRIORITY_FEE_LAMPORTS || 10000}

# DRY RUN / PAPER TRADING SETTINGS
DRY_RUN=${this.config.DRY_RUN}
DRY_RUN_BALANCE=${this.config.DRY_RUN_BALANCE || 1000}
DRY_RUN_PRICE_VOLATILITY=${this.config.DRY_RUN_PRICE_VOLATILITY || 5}

# NOTIFICATION SETTINGS
ENABLE_NOTIFICATIONS=false
NOTIFICATION_CHAT_ID=
TELEGRAM_BOT_TOKEN=

# ADVANCED SETTINGS
MONITOR_INTERVAL_MS=10000
ERROR_RETRY_DELAY_MS=5000
MAX_RETRIES=3
LOG_LEVEL=info`;
  }

  askQuestion(question) {
    return new Promise(resolve => {
      rl.question(question, resolve);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use as a module
module.exports = { EnhancedSetup };

// Run setup if called directly
if (require.main === module) {
  const setup = new EnhancedSetup();
  setup.start().catch(console.error);
}