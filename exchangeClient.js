// exchangeClient.js - Enhanced version with Jupiter-like functionality but compatible with newer Node
const config = require('./config');
const fs = require('fs');
const path = require('path');

// Store simulation state
const STATE_FILE = path.join(__dirname, 'data', 'simulation-state.json');
let simulationState = {
  prices: {},
  positions: {},
  orders: [],
  balance: config.DRY_RUN_BALANCE || 1000,
  lastUpdate: Date.now()
};

// Initialize or load simulation state
(function initSimulation() {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load existing state if available
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const loadedState = JSON.parse(data);
      
      // Use loaded state or initialize
      simulationState = {
        ...loadedState,
        lastUpdate: Date.now()
      };
      
      console.log(`🔄 Loaded simulation state with ${Object.keys(simulationState.prices).length} tokens and $${simulationState.balance.toFixed(2)} balance`);
    }
  } catch (err) {
    console.error('Error initializing simulation:', err);
  }
  
  // Save state periodically
  setInterval(saveState, 30000);
  
  // Run price simulation
  simulatePriceMovements();
})();

// Save simulation state to file
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(simulationState, null, 2));
  } catch (err) {
    console.error('Error saving simulation state:', err);
  }
}

// Simulate price movements
function simulatePriceMovements() {
  setInterval(() => {
    // Update prices for all tokens
    for (const token in simulationState.prices) {
      // Random price movement +/- x% based on volatility setting
      const volatility = config.DRY_RUN_PRICE_VOLATILITY / 100;
      const change = 1 + (Math.random() * volatility * 2 - volatility);
      simulationState.prices[token] *= change;
      
      // Check for order triggers
      checkOrderTriggers(token);
    }
    
    simulationState.lastUpdate = Date.now();
  }, 5000);
}

// Check if any orders should trigger based on current prices
function checkOrderTriggers(token) {
  const currentPrice = simulationState.prices[token];
  if (!currentPrice) return;
  
  // Find orders for this token
  const remainingOrders = [];
  
  for (const order of simulationState.orders) {
    if (order.token !== token) {
      remainingOrders.push(order);
      continue;
    }
    
    // Check stop-loss
    if (order.type === 'stop' && currentPrice <= order.price) {
      console.log(`🔴 Stop-loss triggered for ${token} at ${currentPrice}`);
      executeOrder(order, currentPrice);
      // Don't add to remaining orders
      continue;
    }
    
    // Check take-profit
    if (order.type === 'limit' && currentPrice >= order.price) {
      console.log(`🟢 Take-profit triggered for ${token} at ${currentPrice}`);
      executeOrder(order, currentPrice);
      // Don't add to remaining orders
      continue;
    }
    
    // Order not triggered, keep it
    remainingOrders.push(order);
  }
  
  simulationState.orders = remainingOrders;
}

// Execute an order when triggered
function executeOrder(order, executionPrice) {
  const position = simulationState.positions[order.token];
  if (!position) return;
  
  // For stop-loss, close entire position
  if (order.type === 'stop') {
    const profit = (executionPrice - position.entryPrice) * position.amount;
    console.log(`[DRY RUN] Closed position with P/L: $${profit.toFixed(2)}`);
    
    // Add proceeds back to balance
    simulationState.balance += position.amount * executionPrice;
    
    // Remove all orders for this token
    simulationState.orders = simulationState.orders.filter(o => o.token !== order.token);
    
    // Remove position
    delete simulationState.positions[order.token];
  }
  
  // For take-profit, reduce position size
  if (order.type === 'limit') {
    const profit = (executionPrice - position.entryPrice) * order.amount;
    console.log(`[DRY RUN] Take-profit executed with profit: $${profit.toFixed(2)}`);
    
    // Add proceeds back to balance
    simulationState.balance += order.amount * executionPrice;
    
    // Reduce position size
    position.amount -= order.amount;
    
    // If position is now zero, remove it
    if (position.amount <= 0) {
      delete simulationState.positions[order.token];
      
      // Remove all orders for this token
      simulationState.orders = simulationState.orders.filter(o => o.token !== order.token);
    }
  }
  
  // Save state after order execution
  saveState();
}

/**
 * Check token safety (liquidity + metadata)
 */
async function checkTokenSafety(mintAddress) {
  // Implement realistic token safety checks with artificial delays
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  // For testing, consider tokens ending with 'pump' as valid
  if (mintAddress.toLowerCase().includes('pump')) {
    // Realistic liquidity assessment 
    const liquidity = 10000 + Math.random() * 90000;
    const priceImpact = Math.random() * (liquidity > 50000 ? 3 : 7);
    
    // Generate plausible token name based on address
    let name = mintAddress.slice(0, 3).toUpperCase();
    if (mintAddress.toLowerCase().includes('sol')) {
      name += 'SOL';
    } else if (mintAddress.toLowerCase().includes('doge')) {
      name += 'DOGE';
    } else if (mintAddress.toLowerCase().includes('pepe')) {
      name += 'PEPE';
    } else {
      name += 'MEME';
    }
    
    return {
      safe: priceImpact < config.MAX_PRICE_IMPACT,
      name,
      liquidity,
      priceImpact
    };
  }
  
  // Generate various realistic failure reasons
  const reasons = [
    'Insufficient liquidity',
    'High price impact: 15.2%',
    'Token contract has suspicious code',
    'Low trading volume',
    'No trading pairs found'
  ];
  
  return { 
    safe: false, 
    reason: reasons[Math.floor(Math.random() * reasons.length)],
    liquidity: Math.random() * 2000
  };
}

/**
 * Get total USDC balance for wallet
 */
async function getAccountBalance() {
  return simulationState.balance;
}

/**
 * Market buy token via simulated swap
 */
async function buyMarket(mintAddress, amountUsdc) {
  // Make sure we don't exceed available balance
  const availableAmount = Math.min(amountUsdc, simulationState.balance);
  
  if (availableAmount < 1) {
    throw new Error(`Insufficient balance: $${simulationState.balance.toFixed(2)}`);
  }
  
  // Add token to prices if not exists
  if (!simulationState.prices[mintAddress]) {
    simulationState.prices[mintAddress] = 0.00001 + (Math.random() * 0.0001);
  }
  
  // Simulate price slippage on trade
  const basePrice = simulationState.prices[mintAddress];
  const slippage = 1 + (config.DEFAULT_SLIPPAGE / 100) * (0.5 + Math.random() * 0.5);
  const executionPrice = basePrice * slippage;
  
  // Calculate tokens received
  const tokensReceived = availableAmount / executionPrice;
  
  // Update simulation state
  simulationState.balance -= availableAmount;
  
  // Create or update position
  if (simulationState.positions[mintAddress]) {
    // Average down/up existing position
    const position = simulationState.positions[mintAddress];
    const totalTokens = position.amount + tokensReceived;
    const totalCost = (position.amount * position.entryPrice) + availableAmount;
    position.entryPrice = totalCost / totalTokens;
    position.amount = totalTokens;
  } else {
    // Create new position
    simulationState.positions[mintAddress] = {
      entryPrice: executionPrice,
      amount: tokensReceived,
      timestamp: Date.now()
    };
  }
  
  // Save updated state
  saveState();
  
  console.log(`[DRY RUN] Bought ${tokensReceived.toFixed(2)} tokens at $${executionPrice.toFixed(8)}`);
  
  return { 
    id: `dry-${Date.now()}`, 
    filledPrice: executionPrice, 
    outputAmount: tokensReceived 
  };
}

/**
 * Place a stop-loss order
 */
async function placeStopLoss(mintAddress, amount, stopPrice) {
  const position = simulationState.positions[mintAddress];
  if (!position) {
    throw new Error(`No position found for ${mintAddress}`);
  }
  
  // Create stop loss order
  const order = {
    id: `sl-${Date.now()}`,
    token: mintAddress,
    type: 'stop',
    price: stopPrice,
    amount: position.amount,
    timestamp: Date.now()
  };
  
  // Remove any existing stop orders for this token
  simulationState.orders = simulationState.orders.filter(
    o => !(o.token === mintAddress && o.type === 'stop')
  );
  
  // Add new stop order
  simulationState.orders.push(order);
  
  // Save state
  saveState();
  
  return { id: order.id };
}

/**
 * Place a take-profit limit order
 */
async function placeTakeProfit(mintAddress, amount, tpPrice) {
  const position = simulationState.positions[mintAddress];
  if (!position) {
    throw new Error(`No position found for ${mintAddress}`);
  }
  
  // Make sure we don't exceed position size
  const tpAmount = Math.min(amount, position.amount);
  
  // Create take profit order
  const order = {
    id: `tp-${Date.now()}`,
    token: mintAddress,
    type: 'limit',
    price: tpPrice,
    amount: tpAmount,
    timestamp: Date.now()
  };
  
  // Add take profit order
  simulationState.orders.push(order);
  
  // Save state
  saveState();
  
  return { id: order.id };
}

/**
 * Modify an existing order
 */
async function modifyOrder(orderId, updates) {
  const orderIndex = simulationState.orders.findIndex(o => o.id === orderId);
  
  if (orderIndex === -1) {
    throw new Error(`Order ${orderId} not found`);
  }
  
  // Update order
  simulationState.orders[orderIndex] = {
    ...simulationState.orders[orderIndex],
    ...updates,
    lastUpdated: Date.now()
  };
  
  // Save state
  saveState();
  
  return { id: orderId };
}

/**
 * Cancel order by ID
 */
async function cancelOrder(orderId) {
  const initialLength = simulationState.orders.length;
  simulationState.orders = simulationState.orders.filter(o => o.id !== orderId);
  
  // Save state if something was removed
  if (initialLength !== simulationState.orders.length) {
    saveState();
    return true;
  }
  
  return false;
}

/**
 * Get current price for token 
 */
async function getCurrentPrice(mintAddress) {
  return simulationState.prices[mintAddress] || 0;
}

/**
 * Get token balance (position size)
 */
async function getPosition(mintAddress) {
  const position = simulationState.positions[mintAddress];
  return { 
    size: position ? position.amount : 0 
  };
}

/**
 * Close position
 */
async function closePosition(mintAddress) {
  const position = simulationState.positions[mintAddress];
  
  if (!position) {
    return { success: false, error: 'No position found' };
  }
  
  // Get current price
  const currentPrice = simulationState.prices[mintAddress];
  
  if (!currentPrice) {
    return { success: false, error: 'No price available' };
  }
  
  // Calculate profit/loss
  const profit = (currentPrice - position.entryPrice) * position.amount;
  
  // Add proceeds back to balance
  simulationState.balance += position.amount * currentPrice;
  
  // Remove all orders for this token
  simulationState.orders = simulationState.orders.filter(o => o.token !== mintAddress);
  
  // Remove position
  delete simulationState.positions[mintAddress];
  
  // Save state
  saveState();
  
  return { 
    success: true, 
    profit,
    exitPrice: currentPrice
  };
}

// Make sure DRY_RUN is enforced
if (!config.DRY_RUN) {
  console.warn("⚠️ This implementation only works in DRY_RUN mode. Setting DRY_RUN=true forcefully.");
  config.DRY_RUN = true;
}

// Function to get current dry run balance (for trader.js)
function getDryRunBalance() {
  return simulationState.balance;
}

module.exports = {
  getAccountBalance,
  buyMarket,
  placeStopLoss,
  placeTakeProfit,
  modifyOrder,
  cancelOrder,
  getCurrentPrice,
  getPosition,
  closePosition,
  checkTokenSafety,
  getDryRunBalance
};