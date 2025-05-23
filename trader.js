// src/trader.js
const config = require("./config");
const exchange = require("./exchangeClient");
const fs = require('fs');
const path = require('path');

// Premium channel configurations for trading logic
const CHANNEL_CONFIGS = {
  '-1002209371269': { // Underdog Calls Private
    name: 'Underdog Calls',
    icon: '🔥',
    maxTradePercent: 7,        // Slightly higher for quality signals
    defaultStopLoss: 15,       // Tighter stop loss
    riskMultiplier: 1.2,       // Allow slightly higher risk
    confidenceThreshold: 2,     // Lower confidence requirement
    trailingStopDistance: 18   // Tighter trailing stop
  },
  '-1002277274250': { // Degen
    name: 'Degen',
    icon: '💎',
    maxTradePercent: 4,        // More conservative for high-risk calls
    defaultStopLoss: 22,       // Wider stop loss for volatility
    riskMultiplier: 0.8,       // Reduce risk
    confidenceThreshold: 2,     // Standard confidence requirement
    trailingStopDistance: 25   // Wider trailing stop
  }
};

// Track active trades to prevent duplicates and manage trailing stops
const activeTrades = new Map();

// Enhanced trade statistics by channel
const tradeStats = {
  totalByChannel: {},
  profitByChannel: {},
  winRateByChannel: {}
};

// For dry run, we keep a virtual order book and price simulation
let dryRunState = null;
let paperTradingEngine = null;

if (config.DRY_RUN) {
  const dryRunPath = path.join(__dirname, '..', 'data', 'dry-run-state.json');
  
  // Initialize or load dry run state
  if (fs.existsSync(dryRunPath)) {
    try {
      dryRunState = JSON.parse(fs.readFileSync(dryRunPath, 'utf8'));
      console.log("🔄 Loaded dry run state from file");
      
      // Initialize paper trading engine with loaded state
      paperTradingEngine = initializePaperTradingEngine(dryRunState);
    } catch (err) {
      console.error("Error loading dry run state:", err);
      dryRunState = { prices: {}, orders: [], positions: {}, balance: config.DRY_RUN_BALANCE };
      paperTradingEngine = initializePaperTradingEngine(dryRunState);
    }
  } else {
    dryRunState = { 
      prices: {}, 
      orders: [], 
      positions: {}, 
      balance: config.DRY_RUN_BALANCE,
      startingBalance: config.DRY_RUN_BALANCE,
      totalTrades: 0,
      realizedPnL: 0
    };
    paperTradingEngine = initializePaperTradingEngine(dryRunState);
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
 * Initialize the paper trading engine with a state object
 */
function initializePaperTradingEngine(state) {
  return {
    getPortfolioSummary: () => {
      // Calculate total value of positions plus balance
      let unrealizedPnL = 0;
      let totalPositionsValue = 0;
      
      for (const [token, position] of Object.entries(state.positions)) {
        const currentPrice = state.prices[token] || position.entryPrice;
        const positionValue = position.amount * currentPrice;
        const positionPnL = (currentPrice - position.entryPrice) * position.amount;
        
        totalPositionsValue += positionValue;
        unrealizedPnL += positionPnL;
      }
      
      const totalValue = state.balance + totalPositionsValue;
      const totalPnL = unrealizedPnL + (state.realizedPnL || 0);
      const roi = state.startingBalance ? (totalPnL / state.startingBalance) * 100 : 0;
      
      return {
        balance: state.balance,
        totalValue: totalValue,
        unrealizedPnL: unrealizedPnL,
        realizedPnL: state.realizedPnL || 0,
        totalPnL: totalPnL,
        roi: roi,
        totalTrades: state.totalTrades || 0,
        startingBalance: state.startingBalance || config.DRY_RUN_BALANCE
      };
    },
    
    getActivePositions: () => {
      return Object.entries(state.positions).map(([token, position]) => {
        const currentPrice = state.prices[token] || position.entryPrice;
        const profit = (currentPrice - position.entryPrice) * position.amount;
        const pnlPercent = ((currentPrice / position.entryPrice) - 1) * 100;
        
        return {
          contractAddress: token,
          symbol: position.symbol || token.substring(0, 8),
          entryPrice: position.entryPrice,
          currentPrice: currentPrice,
          amount: position.amount,
          value: position.amount * currentPrice,
          profit: profit,
          pnlPercent: pnlPercent,
          timestamp: position.timestamp,
          channelId: position.channelId,
          channelName: position.channelName
        };
      });
    }
  };
}

/**
 * Get live paper trading status
 */
function getLivePaperTradingStatus() {
  if (!config.DRY_RUN || !paperTradingEngine) {
    return null;
  }
  
  const portfolio = paperTradingEngine.getPortfolioSummary();
  const positions = paperTradingEngine.getActivePositions();
  
  return {
    balance: portfolio.balance,
    totalValue: portfolio.totalValue,
    unrealizedPnL: portfolio.unrealizedPnL,
    realizedPnL: portfolio.realizedPnL,
    totalPnL: portfolio.totalPnL,
    roi: portfolio.roi,
    activePositions: positions.length,
    totalTrades: portfolio.totalTrades,
    startingBalance: portfolio.startingBalance,
    positions: positions.map(pos => ({
      symbol: pos.symbol || pos.contractAddress,
      entryPrice: pos.entryPrice,
      currentPrice: pos.currentPrice,
      size: pos.amount || pos.size,
      value: pos.value || (pos.currentPrice * pos.amount),
      pnl: pos.profit || (pos.currentPrice - pos.entryPrice) * pos.amount,
      pnlPercent: ((pos.currentPrice / pos.entryPrice - 1) * 100).toFixed(2),
      timestamp: pos.timestamp,
      channelId: pos.channelId,
      channelName: pos.channelName
    }))
  };
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
    
    // Update channel statistics
    if (position.channelId) {
      updateChannelStats(position.channelId, profit > 0, profit);
    }
    
    // Add profit back to balance
    dryRunState.balance += position.amount * executionPrice;
    
    // Update realized P&L
    dryRunState.realizedPnL = (dryRunState.realizedPnL || 0) + profit;
    
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
    
    // Update realized P&L
    dryRunState.realizedPnL = (dryRunState.realizedPnL || 0) + profit;
    
    // Reduce position size
    position.amount -= order.amount;
    
    // If position is now zero, remove it
    if (position.amount <= 0) {
      // Update channel statistics for full position close
      if (position.channelId) {
        updateChannelStats(position.channelId, profit > 0, profit);
      }
      
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
 * Update channel-specific trading statistics
 */
function updateChannelStats(channelId, isWin, profit) {
  if (!tradeStats.totalByChannel[channelId]) {
    tradeStats.totalByChannel[channelId] = 0;
    tradeStats.profitByChannel[channelId] = 0;
    tradeStats.winRateByChannel[channelId] = { wins: 0, total: 0 };
  }
  
  tradeStats.totalByChannel[channelId]++;
  tradeStats.profitByChannel[channelId] += profit;
  tradeStats.winRateByChannel[channelId].total++;
  
  if (isWin) {
    tradeStats.winRateByChannel[channelId].wins++;
  }
}

/**
 * Get channel-specific trading configuration
 */
function getChannelConfig(channelId) {
  return CHANNEL_CONFIGS[channelId] || {
    name: 'Custom Channel',
    icon: '📱',
    maxTradePercent: config.MAX_TRADE_PERCENT,
    defaultStopLoss: 20,
    riskMultiplier: 1.0,
    confidenceThreshold: 3,
    trailingStopDistance: config.TRAILING_STOP_PERCENT
  };
}

/**
 * Executes a trade based on parsed signals with channel-aware logic
 */
async function executeTrade(signal, metadata = {}) {
  const { contractAddress, tradePercent, stopLossPercent, takeProfitTargets } = signal;
  const { channelId, channelInfo } = metadata;
  
  // Get channel-specific configuration
  const channelConfig = getChannelConfig(channelId);
  const channelDisplay = channelInfo ? `${channelInfo.icon} ${channelInfo.name}` : `📱 ${channelConfig.name}`;
  
  // Validation
  if (!contractAddress || !tradePercent) {
    console.error(`⚠️ [${channelDisplay}] Missing contract address or trade percentage, skipping trade.`);
    return { success: false, error: "Missing required parameters" };
  }
  
  // Prevent duplicate trades
  if (activeTrades.has(contractAddress)) {
    console.log(`⚠️ [${channelDisplay}] Already trading ${contractAddress}, skipping duplicate.`);
    return { success: false, error: "Already trading this token" };
  }
  
  console.log(`🔔 [${channelDisplay}] Executing trade for ${contractAddress}`);
  
  try {
    // 1. Calculate trade amount with channel-specific limits
    let balance = 0;
    
    if (config.DRY_RUN) {
      // In dry run, use the virtual balance
      balance = dryRunState.balance; 
      console.log(`[DRY RUN] [${channelDisplay}] Using paper trading balance of $${balance.toFixed(2)}`);
    } else {
      balance = await exchange.getAccountBalance();
    }
    
    // Apply channel-specific max trade percentage
    const maxTradePercent = Math.min(channelConfig.maxTradePercent, config.MAX_TRADE_PERCENT);
    const adjustedTradePercent = Math.min(tradePercent * channelConfig.riskMultiplier, maxTradePercent);
    const amount = balance * (adjustedTradePercent / 100);
    
    console.log(`💸 [${channelDisplay}] ${config.DRY_RUN ? '[DRY RUN]' : ''} Buying amount: ${amount.toFixed(2)} USDC (${adjustedTradePercent.toFixed(1)}% of account, channel limit: ${maxTradePercent}%)`);
    
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
      console.log(`[DRY RUN] [${channelDisplay}] Would buy ${tokenAmount.toFixed(2)} tokens at $${buyPrice.toFixed(8)}`);
      
      // Deduct from balance
      dryRunState.balance -= amount;
      
      // Create virtual position with channel metadata
      dryRunState.positions[contractAddress] = {
        entryPrice: buyPrice,
        amount: tokenAmount,
        timestamp: Date.now(),
        channelId: channelId,
        channelName: channelConfig.name,
        symbol: signal.symbol || contractAddress.substring(0, 8)
      };
      
      // Track total trades
      dryRunState.totalTrades = (dryRunState.totalTrades || 0) + 1;
      
      buyOrder = { id: `dry-${Date.now()}`, filledPrice: buyPrice };
    } else {
      // Execute real trade
      buyOrder = await exchange.buyMarket(contractAddress, amount);
      buyPrice = buyOrder.filledPrice;
    }
    
    console.log(`✅ [${channelDisplay}] ${config.DRY_RUN ? '[DRY RUN]' : ''} Bought at price: ${buyPrice}`);
    
    // 3. Place initial stop loss with channel-specific settings
    const channelStopLoss = stopLossPercent || channelConfig.defaultStopLoss;
    const initialStop = buyPrice * (1 - channelStopLoss / 100);
    let currentStop = initialStop;
    console.log(`🛑 [${channelDisplay}] ${config.DRY_RUN ? '[DRY RUN]' : ''} STOP LOSS → placing at: ${initialStop.toFixed(8)} (${channelStopLoss}%)`);
    
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
          
        console.log(`🎯 [${channelDisplay}] ${config.DRY_RUN ? '[DRY RUN]' : ''} TAKE PROFIT → placing at: ${tpPrice.toFixed(8)} for ${tpAmount.toFixed(2)} (${tpPercent}%)`);
        
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
    } else {
      console.log(`💡 [${channelDisplay}] No take profit targets specified - consider manual profit taking`);
    }
    
    // 5. Channel-specific trailing stop logic
    let trailingInterval = null;
    if (config.USE_TRAILING_STOP) {
      const trailDist = channelConfig.trailingStopDistance / 100;
      console.log(`⏱️ [${channelDisplay}] ${config.DRY_RUN ? '[DRY RUN]' : ''} Starting trailing stop with distance: ${channelConfig.trailingStopDistance}%`);
      
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
              console.log(`⏱️ [${channelDisplay}] ${config.DRY_RUN ? '[DRY RUN]' : ''} Updating trailing stop to: ${currentStop.toFixed(8)}`);
              
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
              console.log(`🔄 [${channelDisplay}] Position closed, cleaning up trailing stop`);
              clearInterval(trailingInterval);
              activeTrades.delete(contractAddress);
            }
          }
        } catch (err) {
          console.error(`⚠️ [${channelDisplay}] Error in trailing loop: ${err.message}`);
        }
      }, 5000); // Check every 5 seconds
    }
    
    // Track active trade with enhanced metadata
    activeTrades.set(contractAddress, {
      entryPrice: buyPrice,
      amount: config.DRY_RUN ? dryRunState.positions[contractAddress].amount : amount,
      stopLoss: slOrder,
      takeProfits: tpOrders,
      trailingInterval,
      // Enhanced metadata
      channelId: channelId,
      channelName: channelConfig.name,
      channelConfig: channelConfig,
      tradePercent: adjustedTradePercent,
      originalSignal: signal
    });
    
    return {
      success: true,
      entryPrice: buyPrice,
      amount: config.DRY_RUN ? dryRunState.positions[contractAddress].amount : amount,
      id: buyOrder.id,
      channelId: channelId,
      channelName: channelConfig.name
    };
    
  } catch (err) {
    console.error(`❌ [${channelDisplay}] Trade execution failed for ${contractAddress}: ${err.message}`);
    
    // Clean up any active trades on failure
    if (activeTrades.has(contractAddress)) {
      const trade = activeTrades.get(contractAddress);
      if (trade.trailingInterval) clearInterval(trade.trailingInterval);
      activeTrades.delete(contractAddress);
    }
    
    return {
      success: false,
      error: err.message,
      channelId: channelId,
      channelName: channelConfig.name
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
    const channelDisplay = trade.channelName ? `${trade.channelName}` : 'Unknown Channel';
    
    // Cancel trailing stop interval
    if (trade.trailingInterval) {
      clearInterval(trade.trailingInterval);
    }
    
    if (config.DRY_RUN) {
      console.log(`[DRY RUN] [${channelDisplay}] Cancelling all orders for ${contractAddress}`);
      
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
    console.log(`✅ [${channelDisplay}] ${config.DRY_RUN ? '[DRY RUN]' : ''} Successfully canceled trade for ${contractAddress}`);
    return true;
  } catch (err) {
    console.error(`❌ Error canceling trade for ${contractAddress}: ${err.message}`);
    return false;
  }
}

/**
 * Get status of all active trades with enhanced metadata
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
        profitPercent: profitPercent.toFixed(2) + '%',
        channelId: trade.channelId,
        channelName: trade.channelName,
        tradePercent: trade.tradePercent
      };
    } else {
      return {
        contractAddress: token,
        entryPrice: trade.entryPrice,
        amount: trade.amount,
        channelId: trade.channelId,
        channelName: trade.channelName,
        tradePercent: trade.tradePercent
      };
    }
  });
}

/**
 * Get channel-specific trading statistics
 */
function getChannelStats() {
  const stats = {};
  
  Object.keys(tradeStats.totalByChannel).forEach(channelId => {
    const channelConfig = getChannelConfig(channelId);
    const winRate = tradeStats.winRateByChannel[channelId];
    
    stats[channelId] = {
      name: channelConfig.name,
      icon: channelConfig.icon,
      totalTrades: tradeStats.totalByChannel[channelId],
      totalProfit: tradeStats.profitByChannel[channelId],
      winRate: winRate.total > 0 ? ((winRate.wins / winRate.total) * 100).toFixed(1) : '0.0',
      wins: winRate.wins,
      losses: winRate.total - winRate.wins
    };
  });
  
  return stats;
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

/**
 * Get recommended settings for a channel
 */
function getChannelRecommendations(channelId) {
  const channelConfig = getChannelConfig(channelId);
  
  return {
    channelName: channelConfig.name,
    recommendations: {
      maxTradeSize: `${channelConfig.maxTradePercent}%`,
      stopLoss: `${channelConfig.defaultStopLoss}%`,
      trailingStop: `${channelConfig.trailingStopDistance}%`,
      confidenceThreshold: channelConfig.confidenceThreshold,
      riskLevel: channelConfig.riskMultiplier > 1 ? 'Higher' : channelConfig.riskMultiplier < 1 ? 'Lower' : 'Standard'
    }
  };
}

module.exports = { 
  executeTrade, 
  cancelTrade, 
  getActiveTrades, 
  getDryRunBalance,
  getChannelStats,
  getChannelRecommendations,
  getLivePaperTradingStatus,
  CHANNEL_CONFIGS
};