// src/config.js
// Load environment variables
require('dotenv').config();

module.exports = {
  // Telegram MTProto settings
  API_ID: parseInt(process.env.API_ID, 10),
  API_HASH: process.env.API_HASH,
  SESSION_NAME: process.env.SESSION_NAME,
  TELEGRAM_CHANNEL_IDS: process.env.TELEGRAM_CHANNEL_IDS
    ? process.env.TELEGRAM_CHANNEL_IDS.split(',').map(id => id.trim())
    : [],
    
  // Trade settings
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
};