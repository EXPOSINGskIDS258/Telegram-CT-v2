// src/config.js - Enhanced with better Telegram channel handling
// Load environment variables
require('dotenv').config();

// Default Telegram channels for memecoin signals
const DEFAULT_CHANNELS = ['-1002209371269', '-1002277274250']; // Underdog Calls Private, Degen

module.exports = {
  // Telegram MTProto settings
  API_ID: parseInt(process.env.API_ID, 10),
  API_HASH: process.env.API_HASH,
  SESSION_NAME: process.env.SESSION_NAME,
  TELEGRAM_CHANNEL_IDS: process.env.TELEGRAM_CHANNEL_IDS
    ? process.env.TELEGRAM_CHANNEL_IDS.split(',').map(id => id.trim())
    : DEFAULT_CHANNELS, // Use default channels if none specified
    
  // Trade settings - NEW: Fixed dollar amount per trade
  TRADE_AMOUNT_USD: parseFloat(process.env.TRADE_AMOUNT_USD) || 20,
  
  // Legacy percentage-based (kept as fallback)
  USE_TRAILING_STOP: process.env.USE_TRAILING_STOP === 'true',
  TRAILING_STOP_PERCENT: parseFloat(process.env.TRAILING_STOP_PERCENT) || 20,
  MAX_TRADE_PERCENT: parseFloat(process.env.MAX_TRADE_PERCENT) || 5,
  
  // New trading parameters specific to memecoins
  DEFAULT_SLIPPAGE: parseFloat(process.env.DEFAULT_SLIPPAGE) || 3, // % slippage for entering trades
  EXIT_SLIPPAGE: parseFloat(process.env.EXIT_SLIPPAGE) || 5,     // % slippage for exits
  MIN_LIQUIDITY_USD: parseFloat(process.env.MIN_LIQUIDITY_USD) || 5000,  // Minimum pool liquidity in USD
  MAX_PRICE_IMPACT: parseFloat(process.env.MAX_PRICE_IMPACT) || 10,      // Max acceptable price impact %
  
  // Solana / Jupiter settings
  RPC_ENDPOINT: process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
  BACKUP_RPC_ENDPOINTS: process.env.BACKUP_RPC_ENDPOINTS 
    ? process.env.BACKUP_RPC_ENDPOINTS.split(',') 
    : ['https://solana-api.projectserum.com'],
  WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY,
  USDC_MINT_ADDRESS: process.env.USDC_MINT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  NETWORK: process.env.NETWORK || 'mainnet-beta',
  PRIORITY_FEE_LAMPORTS: parseInt(process.env.PRIORITY_FEE_LAMPORTS, 10) || 10000, // Higher priority fee for memecoins
  
  // Safety checks for memecoins
  ENABLE_SAFETY_CHECKS: process.env.ENABLE_SAFETY_CHECKS !== 'false', // Default true
  MIN_TOKEN_AGE_SECONDS: parseInt(process.env.MIN_TOKEN_AGE_SECONDS, 10) || 300, // Enforce token age before trading
  BLACKLISTED_TOKENS: process.env.BLACKLISTED_TOKENS 
    ? process.env.BLACKLISTED_TOKENS.split(',') 
    : [],
  
  // Monitoring & retries
  MONITOR_INTERVAL_MS: parseInt(process.env.MONITOR_INTERVAL_MS, 10) || 10000,
  ERROR_RETRY_DELAY_MS: parseInt(process.env.ERROR_RETRY_DELAY_MS, 10) || 5000,
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES, 10) || 3,
  
  // Logging & notifications
  LOG_LEVEL: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  ENABLE_NOTIFICATIONS: process.env.ENABLE_NOTIFICATIONS === 'true',
  NOTIFICATION_CHAT_ID: process.env.NOTIFICATION_CHAT_ID,
  
  // Dry run / paper trading mode settings
  DRY_RUN: process.env.DRY_RUN === 'true', // If true, simulate trades instead of executing them
  DRY_RUN_PRICE_VOLATILITY: parseFloat(process.env.DRY_RUN_PRICE_VOLATILITY) || 5, // % volatility for simulated prices
  DRY_RUN_BALANCE: parseFloat(process.env.DRY_RUN_BALANCE) || 1000, // Starting balance in USDC for paper trading
  
  // Helper methods for channel management
  /**
   * Save channels to .env file
   * @param {Array} channels - Array of channel IDs
   * @returns {boolean} - Success status
   */
  saveChannels: function(channels) {
    if (!Array.isArray(channels)) {
      console.error("Channels must be an array");
      return false;
    }
    
    try {
      const fs = require('fs');
      const dotenv = fs.readFileSync('.env', 'utf8');
      
      // Check if TELEGRAM_CHANNEL_IDS exists in .env
      if (dotenv.includes('TELEGRAM_CHANNEL_IDS=')) {
        // Replace existing value
        const updatedDotenv = dotenv.replace(
          /TELEGRAM_CHANNEL_IDS=.*/,
          `TELEGRAM_CHANNEL_IDS=${channels.join(',')}`
        );
        fs.writeFileSync('.env', updatedDotenv);
      } else {
        // Add new entry at the end of the file
        const updatedDotenv = dotenv.trim() + `\nTELEGRAM_CHANNEL_IDS=${channels.join(',')}\n`;
        fs.writeFileSync('.env', updatedDotenv);
      }
      
      // Update the runtime config
      this.TELEGRAM_CHANNEL_IDS = channels;
      
      return true;
    } catch (error) {
      console.error(`Error saving channels to .env: ${error.message}`);
      return false;
    }
  },
  
  /**
   * Add a channel to the monitoring list
   * @param {string} channelId - Channel ID to add
   * @returns {boolean} - Success status
   */
  addChannel: function(channelId) {
    // Validate channel ID format
    if (!channelId || (typeof channelId !== 'string' && typeof channelId !== 'number')) {
      console.error("Invalid channel ID");
      return false;
    }
    
    // Convert to string
    channelId = String(channelId).trim();
    
    // Check if already exists
    if (this.TELEGRAM_CHANNEL_IDS.includes(channelId)) {
      console.warn(`Channel ${channelId} is already being monitored`);
      return true; // Not an error, just a no-op
    }
    
    // Add to the list
    const newChannels = [...this.TELEGRAM_CHANNEL_IDS, channelId];
    
    // Save to .env
    return this.saveChannels(newChannels);
  },
  
  /**
   * Remove a channel from the monitoring list
   * @param {string} channelId - Channel ID to remove
   * @returns {boolean} - Success status
   */
  removeChannel: function(channelId) {
    // Validate channel ID format
    if (!channelId || (typeof channelId !== 'string' && typeof channelId !== 'number')) {
      console.error("Invalid channel ID");
      return false;
    }
    
    // Convert to string
    channelId = String(channelId).trim();
    
    // Check if exists
    if (!this.TELEGRAM_CHANNEL_IDS.includes(channelId)) {
      console.warn(`Channel ${channelId} is not in the monitoring list`);
      return true; // Not an error, just a no-op
    }
    
    // Remove from the list
    const newChannels = this.TELEGRAM_CHANNEL_IDS.filter(id => id !== channelId);
    
    // Save to .env
    return this.saveChannels(newChannels);
  },
  
  /**
   * Set specific channels for monitoring (replaces all existing channels)
   * @param {Array} channels - Array of channel IDs
   * @returns {boolean} - Success status
   */
  setChannels: function(channels) {
    if (!Array.isArray(channels)) {
      console.error("Channels must be an array");
      return false;
    }
    
    // Save the new channels
    return this.saveChannels(channels);
  },
  
  /**
   * Use premium channels preset
   * @returns {boolean} - Success status
   */
  usePremiumChannels: function() {
    return this.setChannels(DEFAULT_CHANNELS);
  },
  
  /**
   * Validate a Telegram channel ID
   * @param {string} channelId - Channel ID to validate
   * @returns {boolean} - Is valid
   */
  isValidChannelId: function(channelId) {
    if (!channelId || (typeof channelId !== 'string' && typeof channelId !== 'number')) {
      return false;
    }
    
    // Convert to string
    channelId = String(channelId).trim();
    
    // Telegram channel IDs are usually numeric and often negative (for supergroups)
    return /^-?\d+$/.test(channelId);
  },
  
  /**
   * Get channel names (if available)
   * @returns {Object} - Map of channel IDs to names
   */
  getChannelNames: function() {
    return {
      '-1002209371269': 'Underdog Calls Private',
      '-1002277274250': 'Degen'
    };
  }
};