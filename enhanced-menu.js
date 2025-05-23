// enhanced-menu.js - Advanced CLI menu system for CrestX
const readline = require('readline');
const { displayBanner, displaySmallBanner, displayCompactBanner } = require('./banner');
const config = require('./config');
const { getActiveTrades, getDryRunBalance, getChannelStats } = require('./trader');
const tradeStore = require('./tradeStore');
const tokenSafety = require('./tokenSafety');
const { getMessageStats } = require('./listener');

class EnhancedMenu {
  constructor() {
    this.rl = null;
    this.isActive = false;
    this.menuStack = ['main'];
    this.currentStats = {};
    this.refreshInterval = null;
  }

  initialize(readlineInterface) {
    this.rl = readlineInterface;
    this.isActive = true;
    this.startStatsRefresh();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    if (!this.rl) return;
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      this.shutdown();
      process.exit(0);
    });
  }

  startStatsRefresh() {
    this.refreshInterval = setInterval(() => {
      this.updateStats();
    }, 10000); // Update every 10 seconds
  }

  async updateStats() {
    try {
      const activeTrades = await getActiveTrades();
      const tradeStats = tradeStore.getTradeStats();
      const channelStats = getChannelStats();
      const messageStats = getMessageStats();
      const safetyStats = tokenSafety.getSafetyStats();

      this.currentStats = {
        activeTrades,
        tradeStats,
        channelStats,
        messageStats,
        safetyStats,
        balance: config.DRY_RUN ? getDryRunBalance() : null,
        lastUpdate: new Date().toLocaleTimeString()
      };
    } catch (error) {
      console.error('Error updating stats:', error.message);
    }
  }

  async handleCommand(command) {
    if (!this.isActive) return false;

    const cmd = command.trim().toLowerCase();
    const args = command.trim().split(' ').slice(1);

    switch (cmd.split(' ')[0]) {
      case 'menu':
      case 'm':
        await this.showMainMenu();
        break;
      
      case 'dashboard':
      case 'dash':
      case 'd':
        await this.showDashboard();
        break;
      
      case 'trades':
      case 't':
        await this.showTradesMenu(args[0]);
        break;
      
      case 'channels':
      case 'ch':
        await this.showChannelsMenu();
        break;
      
      case 'safety':
      case 'safe':
        await this.showSafetyMenu(args[0]);
        break;
      
      case 'config':
      case 'cfg':
        await this.showConfigMenu();
        break;
      
      case 'stats':
      case 'statistics':
        await this.showDetailedStats();
        break;
      
      case 'history':
      case 'hist':
        await this.showTradeHistory(args[0] ? parseInt(args[0]) : 10);
        break;
      
      case 'performance':
      case 'perf':
        await this.showPerformanceAnalysis();
        break;
      
      case 'alerts':
      case 'alert':
        await this.showAlertsMenu();
        break;
      
      case 'help':
      case 'h':
      case '?':
        this.showHelpMenu();
        break;
      
      case 'clear':
      case 'cls':
        console.clear();
        await this.showMainMenu();
        break;
      
      case 'refresh':
      case 'r':
        await this.updateStats();
        console.log('📊 Stats refreshed at ' + new Date().toLocaleTimeString());
        break;
      
      case 'back':
      case 'b':
        this.menuStack.pop();
        if (this.menuStack.length === 0) this.menuStack.push('main');
        await this.showCurrentMenu();
        break;
      
      case 'exit':
      case 'quit':
      case 'q':
        return false; // Signal to exit
      
      default:
        // Check if it's a legacy command
        const handled = await this.handleLegacyCommand(command);
        if (!handled) {
          console.log(`❓ Unknown command: "${cmd}". Type "help" for available commands.`);
        }
    }
    
    return true;
  }

  async handleLegacyCommand(command) {
    const cmd = command.trim().toLowerCase();
    
    // Handle legacy commands for backward compatibility
    if (cmd === 'balance') {
      await this.showBalance();
      return true;
    }
    
    if (cmd.startsWith('cancel ')) {
      const address = cmd.split(' ')[1];
      return await this.cancelTrade(address);
    }
    
    if (cmd.startsWith('safety ')) {
      const address = cmd.split(' ')[1];
      return await this.checkTokenSafety(address);
    }
    
    return false;
  }

  async showMainMenu() {
    console.clear();
    console.log(displayBanner(config));
    
    const mode = config.DRY_RUN ? '🧪 PAPER TRADING' : '💰 LIVE TRADING';
    const modeColor = config.DRY_RUN ? '\x1b[33m' : '\x1b[32m';
    
    console.log(`\n${modeColor}Current Mode: ${mode}\x1b[0m`);
    console.log(`📊 Last Update: ${this.currentStats.lastUpdate || 'Never'}\n`);
    
    // Quick stats overview
    if (this.currentStats.tradeStats) {
      const stats = this.currentStats.tradeStats;
      console.log('📈 Quick Overview:');
      console.log(`   Active Trades: ${stats.activeTrades}`);
      console.log(`   Total P/L: $${stats.totalProfit.toFixed(2)}`);
      console.log(`   Win Rate: ${stats.winRate.toFixed(1)}%`);
      
      if (config.DRY_RUN && this.currentStats.balance !== null) {
        console.log(`   Paper Balance: $${this.currentStats.balance.toFixed(2)}`);
      }
    }
    
    console.log('\n🎛️  MAIN MENU:');
    console.log('   d, dashboard    - Real-time trading dashboard');
    console.log('   t, trades       - View and manage active trades');
    console.log('   ch, channels    - Channel monitoring and stats');
    console.log('   safe, safety    - Token safety and risk analysis');
    console.log('   stats           - Detailed performance statistics');
    console.log('   hist, history   - Trade history and analysis');
    console.log('   cfg, config     - Configuration management');
    console.log('   alerts, alert   - Alert and notification settings');
    console.log('   h, help         - Show detailed help');
    console.log('   q, exit         - Exit CrestX');
    console.log('\n💡 Quick Commands: balance, refresh, clear');
    
    this.menuStack = ['main'];
  }

  async showDashboard() {
    console.clear();
    console.log(displayCompactBanner(config));
    
    // Live dashboard with real-time updates
    console.log('\n📊 REAL-TIME DASHBOARD');
    console.log('═'.repeat(60));
    
    // Current balance
    if (config.DRY_RUN) {
      console.log(`💰 Paper Balance: $${(this.currentStats.balance || 0).toFixed(2)}`);
    } else {
      console.log(`💰 Account Balance: Checking...`);
    }
    
    // Active trades section
    if (this.currentStats.activeTrades && this.currentStats.activeTrades.length > 0) {
      console.log(`\n🔄 ACTIVE TRADES (${this.currentStats.activeTrades.length}):`);
      this.currentStats.activeTrades.forEach((trade, index) => {
        const profitColor = trade.profit >= 0 ? '\x1b[32m' : '\x1b[31m';
        const profitText = trade.profit ? `${profitColor}${trade.profitPercent}\x1b[0m` : 'N/A';
        
        console.log(`   ${index + 1}. ${trade.contractAddress.slice(0, 8)}... - ${profitText}`);
        console.log(`      Entry: $${trade.entryPrice.toFixed(8)} | Channel: ${trade.channelName || 'Unknown'}`);
      });
    } else {
      console.log('\n🔄 ACTIVE TRADES: None');
    }
    
    // Channel activity
    if (this.currentStats.messageStats) {
      const msgStats = this.currentStats.messageStats;
      console.log(`\n📡 MESSAGE ACTIVITY:`);
      console.log(`   Total Messages: ${msgStats.totalMessages}`);
      console.log(`   Uptime: ${(msgStats.uptimeMs / (1000 * 60 * 60)).toFixed(1)}h`);
    }
    
    // Recent performance
    if (this.currentStats.tradeStats) {
      const stats = this.currentStats.tradeStats;
      console.log(`\n📈 TODAY'S PERFORMANCE:`);
      console.log(`   Total Trades: ${stats.totalTrades}`);
      console.log(`   Closed Trades: ${stats.closedTrades}`);
      console.log(`   Win Rate: ${stats.winRate.toFixed(1)}%`);
      console.log(`   Total P/L: $${stats.totalProfit.toFixed(2)}`);
    }
    
    console.log('\n⌨️  Commands: trades, channels, stats, back, refresh');
    this.menuStack.push('dashboard');
  }

  async showTradesMenu(subCommand) {
    console.clear();
    console.log(displaySmallBanner(config));
    
    console.log('\n📊 TRADES MANAGEMENT');
    console.log('═'.repeat(50));
    
    if (subCommand === 'active' || !subCommand) {
      await this.showActiveTrades();
    } else if (subCommand === 'history') {
      await this.showTradeHistory(10);
    } else if (subCommand === 'performance') {
      await this.showPerformanceAnalysis();
    }
    
    console.log('\n⌨️  Commands:');
    console.log('   trades active   - Show active trades');
    console.log('   trades history  - Show trade history');
    console.log('   trades performance - Performance analysis');
    console.log('   cancel <address> - Cancel specific trade');
    console.log('   back, refresh');
    
    this.menuStack.push('trades');
  }

  async showActiveTrades() {
    const activeTrades = this.currentStats.activeTrades || [];
    
    if (activeTrades.length === 0) {
      console.log('📭 No active trades');
      return;
    }
    
    console.log(`🔄 ACTIVE TRADES (${activeTrades.length}):`);
    console.log('─'.repeat(80));
    
    activeTrades.forEach((trade, index) => {
      const profitColor = trade.profit >= 0 ? '\x1b[32m' : '\x1b[31m';
      const resetColor = '\x1b[0m';
      
      console.log(`${index + 1}. Contract: ${trade.contractAddress}`);
      console.log(`   Channel: ${trade.channelName || 'Unknown'} | Size: ${trade.tradePercent}%`);
      console.log(`   Entry: $${trade.entryPrice.toFixed(8)}`);
      
      if (trade.currentPrice) {
        console.log(`   Current: $${trade.currentPrice.toFixed(8)}`);
        console.log(`   P/L: ${profitColor}${trade.profitPercent}${resetColor} ($${trade.profit.toFixed(2)})`);
      }
      
      console.log('');
    });
  }

  async showChannelsMenu() {
    console.clear();
    console.log(displaySmallBanner(config));
    
    console.log('\n📡 CHANNEL MONITORING');
    console.log('═'.repeat(50));
    
    // Channel configuration
    const channels = config.TELEGRAM_CHANNEL_IDS || [];
    console.log(`📊 Configured Channels: ${channels.length}`);
    
    channels.forEach((channelId, index) => {
      const channelStats = this.currentStats.channelStats[channelId];
      console.log(`\n${index + 1}. Channel ID: ${channelId}`);
      
      if (channelStats) {
        console.log(`   Name: ${channelStats.icon} ${channelStats.name}`);
        console.log(`   Trades: ${channelStats.totalTrades}`);
        console.log(`   Win Rate: ${channelStats.winRate}%`);
        console.log(`   Total P/L: $${channelStats.totalProfit.toFixed(2)}`);
      } else {
        console.log(`   Status: Monitoring`);
      }
    });
    
    // Message statistics
    if (this.currentStats.messageStats) {
      const msgStats = this.currentStats.messageStats;
      console.log(`\n📈 MESSAGE STATISTICS:`);
      console.log(`   Total Messages: ${msgStats.totalMessages}`);
      console.log(`   Messages/Hour: ${(msgStats.totalMessages / (msgStats.uptimeMs / (1000 * 60 * 60))).toFixed(1)}`);
      
      Object.entries(msgStats.messagesByChannel || {}).forEach(([channelId, count]) => {
        console.log(`   ${channelId}: ${count} messages`);
      });
    }
    
    console.log('\n⌨️  Commands: back, refresh');
    this.menuStack.push('channels');
  }

  async showSafetyMenu(subCommand) {
    console.clear();
    console.log(displaySmallBanner(config));
    
    console.log('\n🛡️ SAFETY & RISK ANALYSIS');
    console.log('═'.repeat(50));
    
    if (this.currentStats.safetyStats) {
      const safety = this.currentStats.safetyStats;
      console.log(`📊 SAFETY STATISTICS:`);
      console.log(`   Total Checks: ${safety.totalChecks}`);
      console.log(`   Safe Tokens: ${safety.safeTokens}`);
      console.log(`   Unsafe Tokens: ${safety.unsafeTokens}`);
      console.log(`   Safety Rate: ${safety.safetyRate}%`);
      console.log(`   Cache Size: ${safety.cacheSize}`);
    }
    
    console.log(`\n🔧 CURRENT SAFETY SETTINGS:`);
    console.log(`   Safety Checks: ${config.ENABLE_SAFETY_CHECKS ? 'Enabled' : 'Disabled'}`);
    console.log(`   Min Liquidity: $${config.MIN_LIQUIDITY_USD}`);
    console.log(`   Max Price Impact: ${config.MAX_PRICE_IMPACT}%`);
    console.log(`   Min Token Age: ${Math.floor(config.MIN_TOKEN_AGE_SECONDS / 60)} minutes`);
    
    if (subCommand) {
      console.log(`\n🔍 Checking token: ${subCommand}`);
      await this.checkTokenSafety(subCommand);
    }
    
    console.log('\n⌨️  Commands:');
    console.log('   safety <address> - Check specific token');
    console.log('   back, refresh');
    
    this.menuStack.push('safety');
  }

  async showDetailedStats() {
    console.clear();
    console.log(displaySmallBanner(config));
    
    console.log('\n📈 DETAILED STATISTICS');
    console.log('═'.repeat(50));
    
    if (this.currentStats.tradeStats) {
      const stats = this.currentStats.tradeStats;
      console.log(`📊 TRADING PERFORMANCE:`);
      console.log(`   Total Trades: ${stats.totalTrades}`);
      console.log(`   Active Trades: ${stats.activeTrades}`);
      console.log(`   Closed Trades: ${stats.closedTrades}`);
      console.log(`   Winning Trades: ${stats.winningTrades}`);
      console.log(`   Win Rate: ${stats.winRate.toFixed(1)}%`);
      console.log(`   Total P/L: $${stats.totalProfit.toFixed(2)}`);
      
      if (stats.closedTrades > 0) {
        console.log(`   Avg P/L per Trade: $${(stats.totalProfit / stats.closedTrades).toFixed(2)}`);
      }
    }
    
    // Channel breakdown
    if (this.currentStats.channelStats && Object.keys(this.currentStats.channelStats).length > 0) {
      console.log(`\n📡 CHANNEL BREAKDOWN:`);
      Object.entries(this.currentStats.channelStats).forEach(([channelId, stats]) => {
        console.log(`   ${stats.icon} ${stats.name}:`);
        console.log(`     Trades: ${stats.totalTrades} | W/L: ${stats.wins}/${stats.losses}`);
        console.log(`     Win Rate: ${stats.winRate}% | P/L: $${stats.totalProfit.toFixed(2)}`);
      });
    }
    
    console.log('\n⌨️  Commands: performance, history, back');
    this.menuStack.push('stats');
  }

  async showPerformanceAnalysis() {
    console.log('\n🔬 PERFORMANCE ANALYSIS');
    console.log('─'.repeat(40));
    
    // This would show detailed performance metrics
    // Risk-adjusted returns, Sharpe ratio, drawdown analysis, etc.
    console.log('📊 Advanced analytics coming soon...');
    console.log('   • Risk-adjusted returns');
    console.log('   • Maximum drawdown');
    console.log('   • Profit factor');
    console.log('   • Channel performance comparison');
  }

  async showTradeHistory(limit = 10) {
    const recentTrades = tradeStore.getRecentTrades(limit);
    
    console.log(`\n📜 TRADE HISTORY (Last ${limit}):`);
    console.log('─'.repeat(60));
    
    if (recentTrades.length === 0) {
      console.log('📭 No trade history available');
      return;
    }
    
    recentTrades.forEach((trade, index) => {
      const date = new Date(trade.timestamp).toLocaleDateString();
      const status = trade.closed ? '✅' : '⏳';
      const profit = trade.profit ? `$${trade.profit.toFixed(2)}` : 'Open';
      
      console.log(`${index + 1}. ${status} ${trade.contractAddress?.slice(0, 8)}...`);
      console.log(`   Date: ${date} | Entry: $${trade.entryPrice?.toFixed(8)}`);
      console.log(`   Channel: ${trade.channelName || 'Unknown'} | P/L: ${profit}`);
    });
  }

  async showAlertsMenu() {
    console.clear();
    console.log(displaySmallBanner(config));
    
    console.log('\n🔔 ALERTS & NOTIFICATIONS');
    console.log('═'.repeat(50));
    
    console.log(`📱 NOTIFICATION SETTINGS:`);
    console.log(`   Enabled: ${config.ENABLE_NOTIFICATIONS ? 'Yes' : 'No'}`);
    console.log(`   Bot Token: ${config.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Not set'}`);
    console.log(`   Chat ID: ${config.NOTIFICATION_CHAT_ID || 'Not set'}`);
    
    console.log(`\n⚠️ ALERT CONDITIONS:`);
    console.log(`   • Trade executed`);
    console.log(`   • Trade closed (profit/loss)`);
    console.log(`   • Safety warnings`);
    console.log(`   • System errors`);
    
    console.log('\n⌨️  Commands: back');
    this.menuStack.push('alerts');
  }

  showHelpMenu() {
    console.clear();
    console.log(displaySmallBanner(config));
    
    console.log('\n❓ CRESTX HELP SYSTEM');
    console.log('═'.repeat(50));
    
    console.log('🎛️  NAVIGATION:');
    console.log('   menu, m         - Show main menu');
    console.log('   back, b         - Go back to previous menu');
    console.log('   clear, cls      - Clear screen');
    console.log('   refresh, r      - Refresh data');
    console.log('   exit, quit, q   - Exit CrestX');
    
    console.log('\n📊 MONITORING:');
    console.log('   dashboard, d    - Real-time dashboard');
    console.log('   trades, t       - Manage trades');
    console.log('   channels, ch    - Channel monitoring');
    console.log('   stats           - Detailed statistics');
    console.log('   history         - Trade history');
    
    console.log('\n🛡️ SAFETY & CONFIG:');
    console.log('   safety <addr>   - Check token safety');
    console.log('   config, cfg     - Configuration');
    console.log('   alerts          - Notification settings');
    
    console.log('\n⚡ QUICK ACTIONS:');
    console.log('   balance         - Show current balance');
    console.log('   cancel <addr>   - Cancel specific trade');
    
    console.log('\n💡 TIPS:');
    console.log('   • Use short commands (d, t, ch) for quick access');
    console.log('   • Type "refresh" to update all data');
    console.log('   • All commands are case-insensitive');
  }

  async showBalance() {
    if (config.DRY_RUN) {
      const balance = getDryRunBalance();
      console.log(`💰 [DRY RUN] Paper trading balance: $${balance.toFixed(2)} USDC`);
    } else {
      console.log('💰 Checking live balance...');
      try {
        const { getAccountBalance } = require('./exchangeClient');
        const balance = await getAccountBalance();
        console.log(`💰 Wallet balance: $${balance.toFixed(2)} USDC`);
      } catch (error) {
        console.error(`❌ Error getting balance: ${error.message}`);
      }
    }
  }

  async cancelTrade(address) {
    if (!address) {
      console.log("⚠️ Please specify a contract address to cancel");
      return true;
    }
    
    console.log(`🔄 ${config.DRY_RUN ? '[DRY RUN] ' : ''}Cancelling trade for ${address}...`);
    const { cancelTrade } = require('./trader');
    const result = await cancelTrade(address);
    console.log(result ? "✅ Trade cancelled" : "❌ Failed to cancel trade");
    return true;
  }

  async checkTokenSafety(address) {
    if (!address) {
      console.log("⚠️ Please specify a contract address to check");
      return true;
    }
    
    console.log(`🔒 Checking safety for ${address}...`);
    const safety = await tokenSafety.checkToken(address);
    
    if (safety.isSafe) {
      console.log(`✅ Token appears safe. ${safety.liquidity ? `Liquidity: $${safety.liquidity.toFixed(2)}` : ''}`);
    } else {
      console.log(`❌ Safety concerns detected:`);
      safety.warnings.forEach(w => console.log(`  - ${w}`));
    }
    return true;
  }

  async showCurrentMenu() {
    const current = this.menuStack[this.menuStack.length - 1];
    
    switch (current) {
      case 'dashboard':
        await this.showDashboard();
        break;
      case 'trades':
        await this.showTradesMenu();
        break;
      case 'channels':
        await this.showChannelsMenu();
        break;
      case 'safety':
        await this.showSafetyMenu();
        break;
      case 'stats':
        await this.showDetailedStats();
        break;
      default:
        await this.showMainMenu();
    }
  }

  shutdown() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.isActive = false;
  }
}

module.exports = { EnhancedMenu };