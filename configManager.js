// configManager.js - Enhanced configuration management for CrestX
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ConfigManager {
  constructor() {
    this.envPath = '.env';
    this.backupPath = '.env.backup';
    this.config = null;
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.envPath)) {
        // Parse .env file
        const envContent = fs.readFileSync(this.envPath, 'utf8');
        this.config = this.parseEnvContent(envContent);
      } else {
        this.config = {};
      }
    } catch (error) {
      console.error('Error loading configuration:', error.message);
      this.config = {};
    }
  }

  parseEnvContent(content) {
    const config = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        config[key.trim()] = value;
      }
    }
    
    return config;
  }

  generateEnvContent(config) {
    return `# ================================================================
# CRESTX MEMECOIN TRADING BOT CONFIGURATION
# Last Updated: ${new Date().toISOString()}
# Mode: ${config.DRY_RUN === 'true' ? 'PAPER TRADING' : 'LIVE TRADING'}
# ================================================================

# TELEGRAM SETTINGS
API_ID=${config.API_ID || ''}
API_HASH=${config.API_HASH || ''}
SESSION_NAME=${config.SESSION_NAME || ''}
TELEGRAM_CHANNEL_IDS=${config.TELEGRAM_CHANNEL_IDS || ''}

# TRADE SETTINGS
MAX_TRADE_PERCENT=${config.MAX_TRADE_PERCENT || '5'}
USE_TRAILING_STOP=${config.USE_TRAILING_STOP || 'true'}
TRAILING_STOP_PERCENT=${config.TRAILING_STOP_PERCENT || '20'}
DEFAULT_SLIPPAGE=${config.DEFAULT_SLIPPAGE || '3'}
EXIT_SLIPPAGE=${config.EXIT_SLIPPAGE || '5'}

# SAFETY CHECKS
ENABLE_SAFETY_CHECKS=${config.ENABLE_SAFETY_CHECKS || 'true'}
MIN_LIQUIDITY_USD=${config.MIN_LIQUIDITY_USD || '5000'}
MAX_PRICE_IMPACT=${config.MAX_PRICE_IMPACT || '10'}
MIN_TOKEN_AGE_SECONDS=${config.MIN_TOKEN_AGE_SECONDS || '300'}
BLACKLISTED_TOKENS=${config.BLACKLISTED_TOKENS || ''}

# SOLANA/JUPITER SETTINGS
RPC_ENDPOINT=${config.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'}
BACKUP_RPC_ENDPOINTS=${config.BACKUP_RPC_ENDPOINTS || 'https://solana-api.projectserum.com'}
NETWORK=${config.NETWORK || 'mainnet-beta'}
WALLET_PRIVATE_KEY=${config.WALLET_PRIVATE_KEY || ''}
USDC_MINT_ADDRESS=${config.USDC_MINT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'}
PRIORITY_FEE_LAMPORTS=${config.PRIORITY_FEE_LAMPORTS || '50000'}

# DRY RUN / PAPER TRADING SETTINGS
DRY_RUN=${config.DRY_RUN || 'true'}
DRY_RUN_BALANCE=${config.DRY_RUN_BALANCE || '1000'}
DRY_RUN_PRICE_VOLATILITY=${config.DRY_RUN_PRICE_VOLATILITY || '5'}

# NOTIFICATION SETTINGS
ENABLE_NOTIFICATIONS=${config.ENABLE_NOTIFICATIONS || 'false'}
NOTIFICATION_CHAT_ID=${config.NOTIFICATION_CHAT_ID || ''}
TELEGRAM_BOT_TOKEN=${config.TELEGRAM_BOT_TOKEN || ''}

# ADVANCED SETTINGS
MONITOR_INTERVAL_MS=${config.MONITOR_INTERVAL_MS || '10000'}
ERROR_RETRY_DELAY_MS=${config.ERROR_RETRY_DELAY_MS || '5000'}
MAX_RETRIES=${config.MAX_RETRIES || '3'}
LOG_LEVEL=${config.LOG_LEVEL || 'info'}

# ================================================================
# End of configuration file
# ================================================================`;
  }

  saveConfig(newConfig = null) {
    try {
      const configToSave = newConfig || this.config;
      
      // Create backup of current config
      if (fs.existsSync(this.envPath)) {
        fs.copyFileSync(this.envPath, this.backupPath);
      }
      
      // Save new configuration
      const envContent = this.generateEnvContent(configToSave);
      fs.writeFileSync(this.envPath, envContent, 'utf8');
      
      // Update internal config
      this.config = { ...configToSave };
      
      return true;
    } catch (error) {
      console.error('Error saving configuration:', error.message);
      return false;
    }
  }

  getValue(key, defaultValue = null) {
    return this.config[key] || defaultValue;
  }

  setValue(key, value) {
    this.config[key] = value;
  }

  getConfig() {
    return { ...this.config };
  }

  // Interactive configuration methods
  async showConfigMenu() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.clear();
      console.log('⚙️  CONFIGURATION MANAGEMENT');
      console.log('═'.repeat(50));
      
      await this.showCurrentConfig();
      
      console.log('\n🔧 Configuration Options:');
      console.log('1. Edit Trading Settings');
      console.log('2. Edit Safety Settings');
      console.log('3. Edit Telegram Settings');
      console.log('4. Edit Notification Settings');
      console.log('5. Switch Trading Mode (Paper/Live)');
      console.log('6. Reset to Defaults');
      console.log('7. Export Configuration');
      console.log('8. Import Configuration');
      console.log('9. Back to Main Menu');
      
      const choice = await this.askQuestion(rl, '\nSelect option (1-9): ');
      
      switch (choice) {
        case '1':
          await this.editTradingSettings(rl);
          break;
        case '2':
          await this.editSafetySettings(rl);
          break;
        case '3':
          await this.editTelegramSettings(rl);
          break;
        case '4':
          await this.editNotificationSettings(rl);
          break;
        case '5':
          await this.switchTradingMode(rl);
          break;
        case '6':
          await this.resetToDefaults(rl);
          break;
        case '7':
          await this.exportConfig();
          break;
        case '8':
          await this.importConfig(rl);
          break;
        default:
          break;
      }
    } finally {
      rl.close();
    }
  }

  async showCurrentConfig() {
    console.log('\n📊 CURRENT CONFIGURATION:');
    console.log('─'.repeat(40));
    
    const mode = this.getValue('DRY_RUN') === 'true' ? '🧪 Paper Trading' : '💰 Live Trading';
    const modeColor = this.getValue('DRY_RUN') === 'true' ? '\x1b[33m' : '\x1b[31m';
    
    console.log(`Trading Mode: ${modeColor}${mode}\x1b[0m`);
    console.log(`Max Trade Size: ${this.getValue('MAX_TRADE_PERCENT', '5')}%`);
    console.log(`Trailing Stop: ${this.getValue('USE_TRAILING_STOP', 'true') === 'true' ? 'Enabled' : 'Disabled'} (${this.getValue('TRAILING_STOP_PERCENT', '20')}%)`);
    console.log(`Default Slippage: ${this.getValue('DEFAULT_SLIPPAGE', '3')}%`);
    console.log(`Safety Checks: ${this.getValue('ENABLE_SAFETY_CHECKS', 'true') === 'true' ? 'Enabled' : 'Disabled'}`);
    console.log(`Min Liquidity: $${this.getValue('MIN_LIQUIDITY_USD', '5000')}`);
    console.log(`Notifications: ${this.getValue('ENABLE_NOTIFICATIONS', 'false') === 'true' ? 'Enabled' : 'Disabled'}`);
    
    const channels = this.getValue('TELEGRAM_CHANNEL_IDS', '').split(',').filter(c => c.trim());
    console.log(`Channels: ${channels.length} configured`);
  }

  async editTradingSettings(rl) {
    console.log('\n💰 TRADING SETTINGS');
    console.log('─'.repeat(30));
    
    const maxTrade = await this.askQuestion(rl, `Max trade size % [${this.getValue('MAX_TRADE_PERCENT', '5')}]: `) || this.getValue('MAX_TRADE_PERCENT', '5');
    this.setValue('MAX_TRADE_PERCENT', maxTrade);
    
    const useTrailing = await this.askYesNo(rl, 'Enable trailing stop loss', this.getValue('USE_TRAILING_STOP', 'true') === 'true');
    this.setValue('USE_TRAILING_STOP', useTrailing);
    
    if (useTrailing === 'true') {
      const trailingPercent = await this.askQuestion(rl, `Trailing stop % [${this.getValue('TRAILING_STOP_PERCENT', '20')}]: `) || this.getValue('TRAILING_STOP_PERCENT', '20');
      this.setValue('TRAILING_STOP_PERCENT', trailingPercent);
    }
    
    const slippage = await this.askQuestion(rl, `Default slippage % [${this.getValue('DEFAULT_SLIPPAGE', '3')}]: `) || this.getValue('DEFAULT_SLIPPAGE', '3');
    this.setValue('DEFAULT_SLIPPAGE', slippage);
    this.setValue('EXIT_SLIPPAGE', String(parseFloat(slippage) + 2));
    
    console.log('✅ Trading settings updated');
    await this.saveConfig();
  }

  async editSafetySettings(rl) {
    console.log('\n🛡️ SAFETY SETTINGS');
    console.log('─'.repeat(30));
    
    const enableSafety = await this.askYesNo(rl, 'Enable safety checks', this.getValue('ENABLE_SAFETY_CHECKS', 'true') === 'true');
    this.setValue('ENABLE_SAFETY_CHECKS', enableSafety);
    
    if (enableSafety === 'true') {
      const minLiquidity = await this.askQuestion(rl, `Min liquidity USD [${this.getValue('MIN_LIQUIDITY_USD', '5000')}]: `) || this.getValue('MIN_LIQUIDITY_USD', '5000');
      this.setValue('MIN_LIQUIDITY_USD', minLiquidity);
      
      const maxImpact = await this.askQuestion(rl, `Max price impact % [${this.getValue('MAX_PRICE_IMPACT', '10')}]: `) || this.getValue('MAX_PRICE_IMPACT', '10');
      this.setValue('MAX_PRICE_IMPACT', maxImpact);
      
      const minAge = await this.askQuestion(rl, `Min token age seconds [${this.getValue('MIN_TOKEN_AGE_SECONDS', '300')}]: `) || this.getValue('MIN_TOKEN_AGE_SECONDS', '300');
      this.setValue('MIN_TOKEN_AGE_SECONDS', minAge);
    }
    
    console.log('✅ Safety settings updated');
    await this.saveConfig();
  }

  async switchTradingMode(rl) {
    const currentMode = this.getValue('DRY_RUN', 'true') === 'true' ? 'Paper Trading' : 'Live Trading';
    const newMode = currentMode === 'Paper Trading' ? 'Live Trading' : 'Paper Trading';
    
    console.log(`\n🔄 SWITCH TRADING MODE`);
    console.log(`Current: ${currentMode}`);
    console.log(`Switch to: ${newMode}`);
    
    if (newMode === 'Live Trading') {
      console.log('\n⚠️  WARNING: Live trading involves real money!');
      const confirm = await this.askQuestion(rl, 'Type "I UNDERSTAND" to enable live trading: ');
      
      if (confirm !== 'I UNDERSTAND') {
        console.log('❌ Live trading not enabled');
        return;
      }
      
      // Check if wallet is configured
      if (!this.getValue('WALLET_PRIVATE_KEY')) {
        console.log('💳 Wallet private key required for live trading');
        const privateKey = await this.askQuestion(rl, 'Enter wallet private key: ');
        if (privateKey.length < 64) {
          console.log('❌ Invalid private key format');
          return;
        }
        this.setValue('WALLET_PRIVATE_KEY', privateKey);
      }
    }
    
    this.setValue('DRY_RUN', newMode === 'Paper Trading' ? 'true' : 'false');
    console.log(`✅ Switched to ${newMode} mode`);
    await this.saveConfig();
  }

  async resetToDefaults(rl) {
    console.log('\n🔄 RESET TO DEFAULTS');
    const confirm = await this.askYesNo(rl, 'This will reset all settings to defaults. Continue', false);
    
    if (confirm === 'true') {
      // Keep essential settings
      const essentials = {
        API_ID: this.getValue('API_ID'),
        API_HASH: this.getValue('API_HASH'),
        TELEGRAM_CHANNEL_IDS: this.getValue('TELEGRAM_CHANNEL_IDS'),
        WALLET_PRIVATE_KEY: this.getValue('WALLET_PRIVATE_KEY')
      };
      
      // Reset to defaults
      this.config = {
        ...essentials,
        DRY_RUN: 'true',
        MAX_TRADE_PERCENT: '5',
        USE_TRAILING_STOP: 'true',
        TRAILING_STOP_PERCENT: '20',
        DEFAULT_SLIPPAGE: '3',
        EXIT_SLIPPAGE: '5',
        ENABLE_SAFETY_CHECKS: 'true',
        MIN_LIQUIDITY_USD: '5000',
        MAX_PRICE_IMPACT: '10',
        MIN_TOKEN_AGE_SECONDS: '300',
        RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com',
        PRIORITY_FEE_LAMPORTS: '50000',
        DRY_RUN_BALANCE: '1000',
        DRY_RUN_PRICE_VOLATILITY: '5',
        ENABLE_NOTIFICATIONS: 'false'
      };
      
      await this.saveConfig();
      console.log('✅ Configuration reset to defaults');
    }
  }

  async exportConfig() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportPath = `crestx-config-${timestamp}.json`;
      
      // Create sanitized config for export (remove sensitive data)
      const exportConfig = { ...this.config };
      if (exportConfig.WALLET_PRIVATE_KEY) {
        exportConfig.WALLET_PRIVATE_KEY = '[REDACTED]';
      }
      if (exportConfig.TELEGRAM_BOT_TOKEN) {
        exportConfig.TELEGRAM_BOT_TOKEN = '[REDACTED]';
      }
      
      const configData = {
        version: '1.1.0',
        exportDate: new Date().toISOString(),
        config: exportConfig
      };
      
      fs.writeFileSync(exportPath, JSON.stringify(configData, null, 2));
      console.log(`✅ Configuration exported to: ${exportPath}`);
      console.log('⚠️  Sensitive data has been redacted from export');
    } catch (error) {
      console.error('❌ Error exporting configuration:', error.message);
    }
  }

  async importConfig(rl) {
    try {
      const importPath = await this.askQuestion(rl, 'Enter path to config file: ');
      
      if (!fs.existsSync(importPath)) {
        console.log('❌ File not found');
        return;
      }
      
      const importData = JSON.parse(fs.readFileSync(importPath, 'utf8'));
      
      if (!importData.config) {
        console.log('❌ Invalid configuration file format');
        return;
      }
      
      console.log(`📋 Importing configuration from ${importData.exportDate || 'unknown date'}`);
      
      // Merge with current config, keeping sensitive data
      const newConfig = {
        ...importData.config,
        API_ID: this.getValue('API_ID'),
        API_HASH: this.getValue('API_HASH'),
        WALLET_PRIVATE_KEY: this.getValue('WALLET_PRIVATE_KEY'),
        TELEGRAM_BOT_TOKEN: this.getValue('TELEGRAM_BOT_TOKEN')
      };
      
      const confirm = await this.askYesNo(rl, 'Import this configuration', false);
      
      if (confirm === 'true') {
        this.config = newConfig;
        await this.saveConfig();
        console.log('✅ Configuration imported successfully');
      }
    } catch (error) {
      console.error('❌ Error importing configuration:', error.message);
    }
  }

  async editTelegramSettings(rl) {
    console.log('\n📱 TELEGRAM SETTINGS');
    console.log('─'.repeat(30));
    
    console.log('Current API credentials:');
    console.log(`API ID: ${this.getValue('API_ID') ? '[SET]' : '[NOT SET]'}`);
    console.log(`API Hash: ${this.getValue('API_HASH') ? '[SET]' : '[NOT SET]'}`);
    
    const updateApi = await this.askYesNo(rl, 'Update API credentials', false);
    
    if (updateApi === 'true') {
      const apiId = await this.askQuestion(rl, 'Enter API ID: ');
      const apiHash = await this.askQuestion(rl, 'Enter API Hash: ');
      
      if (apiId && apiHash) {
        this.setValue('API_ID', apiId);
        this.setValue('API_HASH', apiHash);
        console.log('✅ API credentials updated');
      }
    }
    
    // Channel management
    const channels = this.getValue('TELEGRAM_CHANNEL_IDS', '').split(',').filter(c => c.trim());
    console.log(`\nCurrent channels: ${channels.length}`);
    channels.forEach((channel, index) => {
      console.log(`${index + 1}. ${channel}`);
    });
    
    const updateChannels = await this.askYesNo(rl, 'Update channel list', false);
    
    if (updateChannels === 'true') {
      console.log('\nChannel options:');
      console.log('1. Add premium channels (Underdog + Degen)');
      console.log('2. Add custom channel');
      console.log('3. Remove channel');
      console.log('4. Replace all channels');
      
      const channelChoice = await this.askQuestion(rl, 'Select option (1-4): ');
      
      switch (channelChoice) {
        case '1':
          const premiumChannels = '-1002209371269,-1002277274250';
          this.setValue('TELEGRAM_CHANNEL_IDS', premiumChannels);
          console.log('✅ Premium channels added');
          break;
        case '2':
          const newChannel = await this.askQuestion(rl, 'Enter channel ID: ');
          if (newChannel) {
            const updatedChannels = [...channels, newChannel].join(',');
            this.setValue('TELEGRAM_CHANNEL_IDS', updatedChannels);
            console.log('✅ Channel added');
          }
          break;
        case '3':
          if (channels.length > 0) {
            const removeIndex = await this.askQuestion(rl, `Remove channel (1-${channels.length}): `);
            const index = parseInt(removeIndex) - 1;
            if (index >= 0 && index < channels.length) {
              channels.splice(index, 1);
              this.setValue('TELEGRAM_CHANNEL_IDS', channels.join(','));
              console.log('✅ Channel removed');
            }
          }
          break;
        case '4':
          const allChannels = await this.askQuestion(rl, 'Enter all channel IDs (comma-separated): ');
          this.setValue('TELEGRAM_CHANNEL_IDS', allChannels);
          console.log('✅ Channels updated');
          break;
      }
    }
    
    await this.saveConfig();
  }

  async editNotificationSettings(rl) {
    console.log('\n🔔 NOTIFICATION SETTINGS');
    console.log('─'.repeat(30));
    
    const enableNotifications = await this.askYesNo(rl, 'Enable notifications', this.getValue('ENABLE_NOTIFICATIONS', 'false') === 'true');
    this.setValue('ENABLE_NOTIFICATIONS', enableNotifications);
    
    if (enableNotifications === 'true') {
      console.log('\n📋 To set up notifications:');
      console.log('1. Create a bot via @BotFather on Telegram');
      console.log('2. Get your chat ID from @userinfobot');
      
      const botToken = await this.askQuestion(rl, 'Enter bot token (or press Enter to skip): ');
      if (botToken) {
        this.setValue('TELEGRAM_BOT_TOKEN', botToken);
      }
      
      const chatId = await this.askQuestion(rl, 'Enter chat ID (or press Enter to skip): ');
      if (chatId) {
        this.setValue('NOTIFICATION_CHAT_ID', chatId);
      }
      
      console.log('✅ Notification settings updated');
    }
    
    await this.saveConfig();
  }

  // Utility methods
  askQuestion(rl, question) {
    return new Promise(resolve => {
      rl.question(question, resolve);
    });
  }

  async askYesNo(rl, question, defaultValue = false) {
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    const answer = await this.askQuestion(rl, `${question}? [${defaultText}]: `);
    
    if (!answer.trim()) {
      return defaultValue ? 'true' : 'false';
    }
    
    return answer.toLowerCase().startsWith('y') ? 'true' : 'false';
  }

  // Validation methods
  validateConfig() {
    const errors = [];
    const warnings = [];
    
    // Required fields
    if (!this.getValue('API_ID')) {
      errors.push('Telegram API ID is required');
    }
    
    if (!this.getValue('API_HASH')) {
      errors.push('Telegram API Hash is required');
    }
    
    if (!this.getValue('TELEGRAM_CHANNEL_IDS')) {
      errors.push('At least one Telegram channel is required');
    }
    
    // Live trading specific
    if (this.getValue('DRY_RUN') === 'false') {
      if (!this.getValue('WALLET_PRIVATE_KEY')) {
        errors.push('Wallet private key is required for live trading');
      }
      
      if (!this.getValue('RPC_ENDPOINT')) {
        errors.push('RPC endpoint is required for live trading');
      }
    }
    
    // Value validations
    const maxTrade = parseFloat(this.getValue('MAX_TRADE_PERCENT', '5'));
    if (maxTrade <= 0 || maxTrade > 100) {
      warnings.push('Max trade percentage should be between 0 and 100');
    }
    
    const minLiquidity = parseFloat(this.getValue('MIN_LIQUIDITY_USD', '5000'));
    if (minLiquidity < 1000) {
      warnings.push('Min liquidity below $1000 may be risky');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Backup and restore methods
  createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `.env.backup.${timestamp}`;
      
      if (fs.existsSync(this.envPath)) {
        fs.copyFileSync(this.envPath, backupPath);
        console.log(`✅ Backup created: ${backupPath}`);
        return backupPath;
      }
    } catch (error) {
      console.error('❌ Error creating backup:', error.message);
    }
    return null;
  }

  restoreBackup(backupPath) {
    try {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, this.envPath);
        this.loadConfig();
        console.log('✅ Configuration restored from backup');
        return true;
      } else {
        console.log('❌ Backup file not found');
        return false;
      }
    } catch (error) {
      console.error('❌ Error restoring backup:', error.message);
      return false;
    }
  }

  listBackups() {
    try {
      const files = fs.readdirSync('.');
      const backups = files.filter(f => f.startsWith('.env.backup.'));
      
      if (backups.length === 0) {
        console.log('📭 No backups found');
        return [];
      }
      
      console.log('📋 Available backups:');
      backups.forEach((backup, index) => {
        const stats = fs.statSync(backup);
        console.log(`${index + 1}. ${backup} (${stats.mtime.toLocaleString()})`);
      });
      
      return backups;
    } catch (error) {
      console.error('❌ Error listing backups:', error.message);
      return [];
    }
  }

  // Get configuration summary for display
  getConfigSummary() {
    const mode = this.getValue('DRY_RUN') === 'true' ? 'Paper Trading' : 'Live Trading';
    const channels = this.getValue('TELEGRAM_CHANNEL_IDS', '').split(',').filter(c => c.trim());
    
    return {
      mode,
      modeIcon: this.getValue('DRY_RUN') === 'true' ? '🧪' : '💰',
      maxTradePercent: this.getValue('MAX_TRADE_PERCENT', '5'),
      trailingStopEnabled: this.getValue('USE_TRAILING_STOP', 'true') === 'true',
      trailingStopPercent: this.getValue('TRAILING_STOP_PERCENT', '20'),
      safetyChecksEnabled: this.getValue('ENABLE_SAFETY_CHECKS', 'true') === 'true',
      channelCount: channels.length,
      notificationsEnabled: this.getValue('ENABLE_NOTIFICATIONS', 'false') === 'true',
      minLiquidity: this.getValue('MIN_LIQUIDITY_USD', '5000'),
      defaultSlippage: this.getValue('DEFAULT_SLIPPAGE', '3')
    };
  }
}

module.exports = { ConfigManager };