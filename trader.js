// src/trader.js
const config = require("./config");
const exchange = require("./exchangeClient");
const fs = require('fs');
const path = require('path');

// Track active trades to prevent duplicates and manage trailing stops
const activeTrades = new Map();

// For dry run, we keep a virtual order book and price simulation
let dryRunState = null;
if (config.DRY_RUN) {
  const dryRunPath = path.join(__dirname, '..', 'data', 'dry-run-state.json');
  
  // Initialize or load dry run state
  if (fs.existsSync(dryRunPath)) {
    try {
      dryRunState = JSON.parse(fs.readFileSync(dryRunPath, 'utf8'));
      console.log("🔄 Loaded dry run state from file");
    } catch (err) {
      console.error("Error loading dry run state:", err);
      dryRunState = { prices: {}, orders: [], positions: {}, balance: config.DRY_RUN_BALANCE };
    }
  } else {
    dryRunState = { prices: {}, orders: [], positions: {}, balance: config.DRY_RUN_BALANCE };
  }

  // Save state periodically
  setInterval(() => {
    try {
      fs.writeFileSync(dryRunPath, JSON.stringify(dryRunState, null, 2));
    } catch (err) {
      console.error("Error saving dry run state:", err);
    }
  }, 30000); // Every 30 seconds
  
  // Simulate price movements for dry run
  setInterval(() => {
    for (const [token, price] of Object.entries(dryRunState.prices)) {
      // Random price movement with configurable volatility
      const volatility = config.DRY_RUN_PRICE_VOLATILITY / 100;
      const change = 1 + (Math.random() * volatility * 2 - volatility);
      dryRunState.prices[token] = price * change;
      
      // Check if any orders should trigger
      checkDryRunOrders(token);
    }
  }, 10000); // Every 10 seconds
}

/**
 * Check if any dry run orders should trigger based on current prices
 */
function checkDryRunOrders(token) {
  if (!config.DRY_RUN || !dryRunState) return;
  
  const currentPrice = dryRunState.prices[token];
  if (!currentPrice) return;
  
  // Find orders for this token
  const triggeredOrders = [];
  dryRunState.orders = dryRunState.orders.filter(order => {
    if (order.token !== token) return true;
    
    // Check stop-loss
    if (order.type === 'stop' && currentPrice <= order.price) {
      console.log(`🔴 [DRY RUN] Stop-loss triggered for ${token} at ${currentPrice}`);
      executeVirtualOrder(order, currentPrice);
      return false;
    }
    
    // Check take-profit
    if (order.type === 'limit' && currentPrice >= order.price) {
      console.log(`🟢 [DRY RUN] Take-profit triggered for ${token} at ${currentPrice}`);
      executeVirtualOrder(order, currentPrice);
      return false;
    }
    
    return true;
  });
}

/**
 * Execute a virtual order when triggered
 */
function executeVirtualOrder(order, executionPrice) {
  if (!dryRunState.positions[order.token]) return;
  
  const position = dryRunState.positions[order.token];
  
  // For stop-loss, close entire position
  if (order.type === 'stop') {
    const profit = (executionPrice - position.entryPrice) * position.amount;
    console.log(`[DRY RUN] Closed position with P/L: $${profit.toFixed(2)}`);
    
    // Add profit back to balance
    dryRunState.balance += position.amount * executionPrice;
    
    // Remove all orders for this token
    dryRunState.orders = dryRunState.orders.filter(o => o.token !== order.token);
    
    // Remove position
    delete dryRunState.positions[order.token];
    
    // Trigger any trailing stop cleanup
    if (activeTrades.has(order.token)) {
      const trade = activeTrades.get(order.token);
      if (trade.trailingInterval) clearInterval(trade.trailingInterval);
      activeTrades.delete(order.token);
    }
  }
  
  // For take-profit, reduce position size
  if (order.type === 'limit') {
    const profit = (executionPrice - position.entryPrice) * order.amount;
    console.log(`[DRY RUN] Take-profit executed with profit: $${profit.toFixed(2)}`);
    
    // Add proceeds back to balance
    dryRunState.balance += order.amount * executionPrice;
    
    // Reduce position size
    position.amount -= order.amount;
    
    // If position is now zero, remove it
    if (position.amount <= 0) {
      delete dryRunState.positions[order.token];
      
      // Remove all orders for this token
      dryRunState.orders = dryRunState.orders.filter(o => o.token !== order.token);
      
      // Clean up trailing stop
      if (activeTrades.has(order.token)) {
        const trade = activeTrades.get(order.token);
        if (trade.trailingInterval) clearInterval(trade.trailingInterval);
        activeTrades.delete(order.token);
      }
    }
  }
}

/**
 * Executes a trade based on parsed signals
 */
async function executeTrade(signal) {
  const { contractAddress, tradePercent, stopLossPercent, takeProfitTargets } = signal;
  
  // Validation
  if (!contractAddress || !tradePercent) {
    console.error("⚠️ Missing contract address or trade percentage, skipping trade.");
    return { success: false, error: "Missing required parameters" };
  }
  
  // Prevent duplicate trades
  if (activeTrades.has(contractAddress)) {
    console.log(`⚠️ Already trading ${contractAddress}, skipping duplicate.`);
    return { success: false, error: "Already trading this token" };
  }
  
  console.log(`🔔 Executing trade for ${contractAddress}`);
  
  try {
    // 1. Calculate trade amount
    let balance = 0;
    
    if (config.DRY_RUN) {
      // In dry run, use the virtual balance
      balance = dryRunState.balance; 
      console.log(`[DRY RUN] Using paper trading balance of $${balance.toFixed(2)}`);
    } else {
      balance = await exchange.getAccountBalance();
    }
    
    const amount = balance * (Math.min(tradePercent, config.MAX_TRADE_PERCENT) / 100);
    console.log(`💸 ${config.DRY_RUN ? '[DRY RUN]' : ''} Buying amount: ${amount.toFixed(2)} USDC (${tradePercent}% of account)`);
    
    // 2. Place market buy
    let buyOrder;
    let buyPrice;
    
    if (config.DRY_RUN) {
      // Simulate buying at current price or initialize a random price
      if (!dryRunState.prices[contractAddress]) {
        // Initialize with a random price between $0.00001 and $0.1 for new memecoins
        dryRunState.prices[contractAddress] = Math.random() * 0.1 + 0.00001;
      }
      
      buyPrice = dryRunState.prices[contractAddress];
      const tokenAmount = amount / buyPrice;
      console.log(`[DRY RUN] Would buy ${tokenAmount.toFixed(2)} tokens at $${buyPrice.toFixed(8)}`);
      
      // Deduct from balance
      dryRunState.balance -= amount;
      
      // Create virtual position
      dryRunState.positions[contractAddress] = {
        entryPrice: buyPrice,
        amount: tokenAmount,
        timestamp: Date.now()
      };
      
      buyOrder = { id: `dry-${Date.now()}`, filledPrice: buyPrice };
    } else {
      // Execute real trade
      buyOrder = await exchange.buyMarket(contractAddress, amount);
      buyPrice = buyOrder.filledPrice;
    }
    
    console.log(`✅ ${config.DRY_RUN ? '[DRY RUN]' : ''} Bought at price: ${buyPrice}`);
    
    // 3. Place initial stop loss
    const initialStop = buyPrice * (1 - stopLossPercent / 100);
    let currentStop = initialStop;
    console.log(`🛑 ${config.DRY_RUN ? '[DRY RUN]' : ''} STOP LOSS → placing at: ${initialStop}`);
    
    let slOrder;
    if (config.DRY_RUN) {
      // Create virtual stop order
      slOrder = { 
        id: `sl-dry-${Date.now()}`,
        token: contractAddress,
        type: 'stop',
        price: initialStop,
        amount: dryRunState.positions[contractAddress].amount
      };
      dryRunState.orders.push(slOrder);
    } else {
      slOrder = await exchange.placeStopLoss(contractAddress, amount, initialStop);
    }
    
    // 4. Place take profit orders - with position splitting
    const tpOrders = [];
    if (takeProfitTargets && takeProfitTargets.length > 0) {
      // Split position across take profits
      const portionPerTP = 1 / takeProfitTargets.length;
      
      for (const tpPercent of takeProfitTargets) {
        const tpPrice = buyPrice * (1 + tpPercent / 100);
        const tpAmount = config.DRY_RUN 
          ? dryRunState.positions[contractAddress].amount * portionPerTP
          : amount * portionPerTP;
          
        console.log(`🎯 ${config.DRY_RUN ? '[DRY RUN]' : ''} TAKE PROFIT → placing at: ${tpPrice} for ${tpAmount}`);
        
        let tpOrder;
        if (config.DRY_RUN) {
          // Create virtual take profit order
          tpOrder = {
            id: `tp-dry-${Date.now()}-${tpPercent}`,
            token: contractAddress,
            type: 'limit',
            price: tpPrice,
            amount: tpAmount
          };
          dryRunState.orders.push(tpOrder);
        } else {
          tpOrder = await exchange.placeTakeProfit(contractAddress, tpAmount, tpPrice);
        }
        
        tpOrders.push(tpOrder);
      }
    }
    
    // 5. Trailing stop logic
    let trailingInterval = null;
    if (config.USE_TRAILING_STOP) {
      const trailDist = config.TRAILING_STOP_PERCENT / 100;
      console.log(`⏱️ ${config.DRY_RUN ? '[DRY RUN]' : ''} Starting trailing stop with distance: ${config.TRAILING_STOP_PERCENT}%`);
      
      trailingInterval = setInterval(async () => {
        try {
          let currentPrice;
          
          if (config.DRY_RUN) {
            currentPrice = dryRunState.prices[contractAddress];
            
            // Skip if no price or position found
            if (!currentPrice || !dryRunState.positions[contractAddress]) {
              clearInterval(trailingInterval);
              return;
            }
          } else {
            currentPrice = await exchange.getCurrentPrice(contractAddress);
          }
          
          // Update highest price
          if (currentPrice > buyPrice) {
            const newStop = currentPrice * (1 - trailDist);
            if (newStop > currentStop) {
              currentStop = newStop;
              console.log(`⏱️ ${config.DRY_RUN ? '[DRY RUN]' : ''} Updating trailing stop to: ${currentStop}`);
              
              if (config.DRY_RUN) {
                // Update virtual stop order
                const stopOrder = dryRunState.orders.find(o => 
                  o.token === contractAddress && o.type === 'stop');
                  
                if (stopOrder) {
                  stopOrder.price = currentStop;
                }
              } else {
                slOrder = await exchange.modifyOrder(slOrder.id, { stopPrice: currentStop });
              }
            }
          }
          
          // Check if position closed in real trading
          if (!config.DRY_RUN) {
            const position = await exchange.getPosition(contractAddress);
            if (!position || position.size === 0) {
              console.log(`🔄 Position closed, cleaning up trailing stop`);
              clearInterval(trailingInterval);
              activeTrades.delete(contractAddress);
            }
          }
        } catch (err) {
          console.error(`⚠️ Error in trailing loop: ${err.message}`);
        }
      }, 5000); // Check every 5 seconds
    }
    
    // Track active trade
    activeTrades.set(contractAddress, {
      entryPrice: buyPrice,
      amount: config.DRY_RUN ? dryRunState.positions[contractAddress].amount : amount,
      stopLoss: slOrder,
      takeProfits: tpOrders,
      trailingInterval
    });
    
    return {
      success: true,
      entryPrice: buyPrice,
      amount: config.DRY_RUN ? dryRunState.positions[contractAddress].amount : amount,
      id: buyOrder.id
    };
    
  } catch (err) {
    console.error(`❌ Trade execution failed for ${contractAddress}: ${err.message}`);
    
    // Clean up any active trades on failure
    if (activeTrades.has(contractAddress)) {
      const trade = activeTrades.get(contractAddress);
      if (trade.trailingInterval) clearInterval(trade.trailingInterval);
      activeTrades.delete(contractAddress);
    }
    
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Cancel an active trade
 */
async function cancelTrade(contractAddress) {
  if (!activeTrades.has(contractAddress)) {
    console.log(`⚠️ No active trade found for ${contractAddress}`);
    return false;
  }
  
  try {
    const trade = activeTrades.get(contractAddress);
    
    // Cancel trailing stop interval
    if (trade.trailingInterval) {
      clearInterval(trade.trailingInterval);
    }
    
    if (config.DRY_RUN) {
      console.log(`[DRY RUN] Cancelling all orders for ${contractAddress}`);
      
      // Add position value back to balance
      if (dryRunState.positions[contractAddress]) {
        const position = dryRunState.positions[contractAddress];
        const currentPrice = dryRunState.prices[contractAddress] || position.entryPrice;
        dryRunState.balance += position.amount * currentPrice;
      }
      
      // Remove all virtual orders
      dryRunState.orders = dryRunState.orders.filter(o => o.token !== contractAddress);
      
      // Remove position
      delete dryRunState.positions[contractAddress];
    } else {
      // Cancel all orders
      if (trade.stopLoss) await exchange.cancelOrder(trade.stopLoss.id);
      for (const tp of trade.takeProfits || []) {
        await exchange.cancelOrder(tp.id);
      }
      
      // Close position
      await exchange.closePosition(contractAddress);
    }
    
    activeTrades.delete(contractAddress);
    console.log(`✅ ${config.DRY_RUN ? '[DRY RUN]' : ''} Successfully canceled trade for ${contractAddress}`);
    return true;
  } catch (err) {
    console.error(`❌ Error canceling trade for ${contractAddress}: ${err.message}`);
    return false;
  }
}

/**
 * Get status of all active trades
 */
async function getActiveTrades() {
  return Array.from(activeTrades.keys()).map(token => {
    const trade = activeTrades.get(token);
    
    if (config.DRY_RUN && dryRunState.positions[token]) {
      const position = dryRunState.positions[token];
      const currentPrice = dryRunState.prices[token] || trade.entryPrice;
      const profit = (currentPrice - trade.entryPrice) * position.amount;
      const profitPercent = ((currentPrice / trade.entryPrice) - 1) * 100;
      
      return {
        contractAddress: token,
        entryPrice: trade.entryPrice,
        currentPrice,
        amount: position.amount,
        profit,
        profitPercent: profitPercent.toFixed(2) + '%'
      };
    } else {
      return {
        contractAddress: token,
        entryPrice: trade.entryPrice,
        amount: trade.amount
      };
    }
  });
}

/**
 * Get the current dry run balance
 */
function getDryRunBalance() {
  if (!config.DRY_RUN || !dryRunState) {
    return 0;
  }
  return dryRunState.balance;
}

module.exports = { executeTrade, cancelTrade, getActiveTrades, getDryRunBalance };