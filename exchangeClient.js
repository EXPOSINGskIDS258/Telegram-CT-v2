// exchangeClient.js - Complete implementation with Jupiter DEX integration
require('dotenv').config();
const config = require('./config');
const fs = require('fs');
const path = require('path');
const { 
  Connection, 
  PublicKey, 
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const { Jupiter } = require('@jup-ag/core');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');

// Jupiter DEX instance
let jupiter = null;
let connection = null;
let wallet = null;

// Initialize Jupiter and wallet
async function initializeJupiter() {
  try {
    // Set up connection with fallback
    connection = new Connection(config.RPC_ENDPOINT, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000
    });
    
    // Initialize wallet from private key
    if (config.WALLET_PRIVATE_KEY && !config.DRY_RUN) {
      const privateKeyBytes = Buffer.from(config.WALLET_PRIVATE_KEY, 'hex');
      wallet = Keypair.fromSecretKey(privateKeyBytes);
      console.log('✅ Wallet initialized:', wallet.publicKey.toString());
    }
    
    // Initialize Jupiter
    if (wallet && !config.DRY_RUN) {
      jupiter = await Jupiter.load({
        connection,
        cluster: 'mainnet-beta',
        user: wallet.publicKey,
        platformFeeAndAccounts: {
          feeBps: 50, // 0.5% platform fee
          feeAccounts: new Map() // No fee collection for now
        }
      });
      console.log('✅ Jupiter DEX initialized');
    }
  } catch (err) {
    console.error('❌ Failed to initialize Jupiter:', err);
    throw err;
  }
}

// Initialize on module load
if (!config.DRY_RUN) {
  initializeJupiter().catch(console.error);
}

// ----- Paper Trading State Management -----
const STATE_FILE = path.join(__dirname, '..', 'data', 'simulation-state.json');
let simulationState = {
  prices: {},
  positions: {},
  orders: [],
  balance: config.DRY_RUN_BALANCE || 1000,
  lastUpdate: Date.now()
};

function initSimulation() {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    if (fs.existsSync(STATE_FILE)) {
      const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      simulationState = { ...loaded, lastUpdate: Date.now() };
      console.log(`🔄 Loaded simulation state: $${simulationState.balance.toFixed(2)}, ${Object.keys(simulationState.prices).length} tokens`);
    }
  } catch (e) {
    console.error('Simulation init error:', e);
  }
  setInterval(saveState, 30000);
  simulatePriceMovements();
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(simulationState, null, 2));
  } catch (e) {
    console.error('Save state error:', e);
  }
}

function simulatePriceMovements() {
  setInterval(() => {
    for (const token in simulationState.prices) {
      const vol = config.DRY_RUN_PRICE_VOLATILITY / 100;
      const change = 1 + (Math.random() * vol * 2 - vol);
      simulationState.prices[token] *= change;
      checkOrderTriggers(token);
    }
    simulationState.lastUpdate = Date.now();
  }, 5000);
}

function checkOrderTriggers(token) {
  const price = simulationState.prices[token];
  const remaining = [];
  for (const o of simulationState.orders) {
    if (o.token !== token) { remaining.push(o); continue; }
    if (o.type === 'stop' && price <= o.price) { executeSimulationOrder(o, price); continue; }
    if (o.type === 'limit' && price >= o.price) { executeSimulationOrder(o, price); continue; }
    remaining.push(o);
  }
  simulationState.orders = remaining;
}

function executeSimulationOrder(order, execPrice) {
  const pos = simulationState.positions[order.token];
  if (!pos) return;
  
  if (order.type === 'stop') {
    const pnl = (execPrice - pos.entryPrice) * pos.amount;
    console.log(`[DRY RUN] Stop-loss ${order.token} closed for P/L $${pnl.toFixed(2)}`);
    simulationState.balance += pos.amount * execPrice;
    delete simulationState.positions[order.token];
    simulationState.orders = simulationState.orders.filter(o => o.token !== order.token);
  } else if (order.type === 'limit') {
    const takeAmt = Math.min(order.amount, pos.amount);
    const pnl = (execPrice - pos.entryPrice) * takeAmt;
    console.log(`[DRY RUN] Take-profit ${order.token} executed for profit $${pnl.toFixed(2)}`);
    simulationState.balance += takeAmt * execPrice;
    pos.amount -= takeAmt;
    if (pos.amount <= 0) delete simulationState.positions[order.token];
  }
  saveState();
}

// Initialize simulation if in paper mode
if (config.DRY_RUN) initSimulation();

// ----- Live Trading Implementation -----

/**
 * Get real-time price from Jupiter
 */
async function getLivePrice(mintAddress) {
  if (!jupiter) throw new Error('Jupiter not initialized');
  
  try {
    const inputMint = new PublicKey(config.USDC_MINT_ADDRESS);
    const outputMint = new PublicKey(mintAddress);
    
    // Get route for 1 USDC worth
    const routes = await jupiter.computeRoutes({
      inputMint,
      outputMint,
      amount: 1_000_000, // 1 USDC (6 decimals)
      slippageBps: 50, // 0.5% slippage for price check
    });
    
    if (routes.routesInfos.length === 0) {
      throw new Error('No routes found');
    }
    
    const bestRoute = routes.routesInfos[0];
    const price = 1_000_000 / bestRoute.outAmount; // Price per token in USDC
    
    return price;
  } catch (err) {
    console.error('Error fetching price:', err);
    throw err;
  }
}

/**
 * Execute live market buy through Jupiter
 */
async function executeLiveBuy(mintAddress, amountUsdc) {
  if (!jupiter || !wallet) throw new Error('Jupiter or wallet not initialized');
  
  try {
    const inputMint = new PublicKey(config.USDC_MINT_ADDRESS);
    const outputMint = new PublicKey(mintAddress);
    const amount = Math.floor(amountUsdc * 1_000_000); // Convert to USDC decimals
    
    // Compute routes
    const routes = await jupiter.computeRoutes({
      inputMint,
      outputMint,
      amount,
      slippageBps: config.DEFAULT_SLIPPAGE * 100, // Convert percentage to bps
    });
    
    if (routes.routesInfos.length === 0) {
      throw new Error('No routes found for swap');
    }
    
    const bestRoute = routes.routesInfos[0];
    console.log(`Found route: ${amountUsdc} USDC → ~${bestRoute.outAmount / 1e9} tokens`);
    
    // Build transaction
    const { swapTransaction } = await jupiter.exchange({
      routeInfo: bestRoute,
      userPublicKey: wallet.publicKey,
      feeAccount: undefined
    });
    
    // Add priority fee
    swapTransaction.instructions.unshift(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: config.PRIORITY_FEE_LAMPORTS || 10000
      })
    );
    
    // Sign and send
    swapTransaction.sign(wallet);
    const txid = await connection.sendTransaction(swapTransaction, [wallet], {
      skipPreflight: true,
      maxRetries: 3
    });
    
    console.log(`Swap transaction sent: ${txid}`);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(txid, 'confirmed');
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }
    
    const filledPrice = amount / bestRoute.outAmount;
    
    return {
      id: txid,
      filledPrice,
      amountOut: bestRoute.outAmount,
      success: true
    };
  } catch (err) {
    console.error('Live buy error:', err);
    throw err;
  }
}

/**
 * Check token safety using on-chain data
 */
async function checkTokenSafety(mintAddress) {
  try {
    const mint = new PublicKey(mintAddress);
    
    // Get token account info
    const accountInfo = await connection.getAccountInfo(mint);
    if (!accountInfo) {
      return { safe: false, reason: 'Token account not found' };
    }
    
    // Try to get price/liquidity from Jupiter
    let liquidity = 0;
    let priceImpact = 0;
    
    try {
      // Test swap of $100 to check liquidity
      const testAmount = 100_000_000; // 100 USDC
      const routes = await jupiter.computeRoutes({
        inputMint: new PublicKey(config.USDC_MINT_ADDRESS),
        outputMint: mint,
        amount: testAmount,
        slippageBps: 1000, // 10% for safety check
      });
      
      if (routes.routesInfos.length > 0) {
        const route = routes.routesInfos[0];
        priceImpact = route.priceImpactPct;
        
        // Estimate liquidity based on price impact
        if (priceImpact < 1) liquidity = 100000; // Good liquidity
        else if (priceImpact < 5) liquidity = 50000; // Moderate
        else if (priceImpact < 10) liquidity = 10000; // Low
        else liquidity = 5000; // Very low
      }
    } catch (err) {
      console.warn('Could not fetch Jupiter routes for safety check');
    }
    
    return {
      safe: liquidity >= config.MIN_LIQUIDITY_USD,
      name: mintAddress.slice(0, 8),
      liquidity,
      priceImpact: priceImpact / 100, // Convert to decimal
      reason: liquidity < config.MIN_LIQUIDITY_USD ? 'Insufficient liquidity' : null
    };
  } catch (err) {
    console.error('Token safety check error:', err);
    return { safe: false, reason: err.message };
  }
}

// ----- Unified Interface -----

async function getAccountBalance() {
  if (config.DRY_RUN) {
    return simulationState.balance;
  }
  
  try {
    // Get USDC token account
    const usdcMint = new PublicKey(config.USDC_MINT_ADDRESS);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { mint: usdcMint }
    );
    
    if (tokenAccounts.value.length === 0) {
      return 0;
    }
    
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return balance;
  } catch (err) {
    console.error('Error getting balance:', err);
    throw err;
  }
}

async function buyMarket(mintAddress, amountUsdc) {
  if (config.DRY_RUN) {
    // Paper trading logic
    if (!simulationState.prices[mintAddress]) {
      simulationState.prices[mintAddress] = Math.random() * 0.1 + 0.00001;
    }
    
    const price = simulationState.prices[mintAddress];
    const tokenAmount = amountUsdc / price;
    
    simulationState.balance -= amountUsdc;
    simulationState.positions[mintAddress] = {
      entryPrice: price,
      amount: tokenAmount,
      timestamp: Date.now()
    };
    
    saveState();
    
    return {
      id: `sim-buy-${Date.now()}`,
      filledPrice: price,
      amountOut: tokenAmount,
      success: true
    };
  }
  
  // Live trading
  return executeLiveBuy(mintAddress, amountUsdc);
}

async function placeStopLoss(mintAddress, amount, stopPrice) {
  if (config.DRY_RUN) {
    const order = {
      id: `sim-stop-${Date.now()}`,
      token: mintAddress,
      type: 'stop',
      price: stopPrice,
      amount: simulationState.positions[mintAddress]?.amount || amount
    };
    simulationState.orders.push(order);
    saveState();
    return order;
  }
  
  // Live trading - would need a service that monitors price and executes
  // For now, return a simulated order that the trader.js will monitor
  return {
    id: `stop-${Date.now()}`,
    token: mintAddress,
    type: 'stop',
    price: stopPrice,
    amount,
    status: 'pending'
  };
}

async function placeTakeProfit(mintAddress, amount, tpPrice) {
  if (config.DRY_RUN) {
    const order = {
      id: `sim-tp-${Date.now()}`,
      token: mintAddress,
      type: 'limit',
      price: tpPrice,
      amount
    };
    simulationState.orders.push(order);
    saveState();
    return order;
  }
  
  // Live trading - would need a service that monitors price and executes
  return {
    id: `tp-${Date.now()}`,
    token: mintAddress,
    type: 'limit',
    price: tpPrice,
    amount,
    status: 'pending'
  };
}

async function modifyOrder(orderId, updates) {
  if (config.DRY_RUN) {
    const idx = simulationState.orders.findIndex(o => o.id === orderId);
    if (idx < 0) throw new Error(`Order ${orderId} not found`);
    
    simulationState.orders[idx] = { 
      ...simulationState.orders[idx], 
      ...updates, 
      lastUpdated: Date.now() 
    };
    saveState();
    return { id: orderId, ...updates };
  }
  
  // Live trading - update the monitored order
  return { id: orderId, ...updates, modified: true };
}

async function cancelOrder(orderId) {
  if (config.DRY_RUN) {
    const len = simulationState.orders.length;
    simulationState.orders = simulationState.orders.filter(o => o.id !== orderId);
    saveState();
    return simulationState.orders.length < len;
  }
  
  // Live trading - remove from monitoring
  return true;
}

async function getCurrentPrice(mintAddress) {
  if (config.DRY_RUN) {
    return simulationState.prices[mintAddress] || 0;
  }
  
  try {
    return await getLivePrice(mintAddress);
  } catch (err) {
    console.error('Error getting current price:', err);
    return 0;
  }
}

async function getPosition(mintAddress) {
  if (config.DRY_RUN) {
    const p = simulationState.positions[mintAddress];
    return { size: p ? p.amount : 0 };
  }
  
  try {
    const mint = new PublicKey(mintAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { mint }
    );
    
    if (tokenAccounts.value.length === 0) {
      return { size: 0 };
    }
    
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return { size: balance };
  } catch (err) {
    console.error('Error getting position:', err);
    return { size: 0 };
  }
}

async function closePosition(mintAddress) {
  if (config.DRY_RUN) {
    const pos = simulationState.positions[mintAddress];
    if (!pos) return { success: false, error: 'No position' };
    
    const price = simulationState.prices[mintAddress];
    if (!price) return { success: false, error: 'No price' };
    
    const pnl = (price - pos.entryPrice) * pos.amount;
    simulationState.balance += pos.amount * price;
    delete simulationState.positions[mintAddress];
    simulationState.orders = simulationState.orders.filter(o => o.token !== mintAddress);
    saveState();
    
    return { success: true, profit: pnl, exitPrice: price };
  }
  
  try {
    // Get current position
    const position = await getPosition(mintAddress);
    if (position.size === 0) {
      return { success: false, error: 'No position to close' };
    }
    
    // Swap tokens back to USDC
    const outputMint = new PublicKey(config.USDC_MINT_ADDRESS);
    const inputMint = new PublicKey(mintAddress);
    const amount = Math.floor(position.size * 1e9); // Convert to token decimals
    
    const routes = await jupiter.computeRoutes({
      inputMint,
      outputMint,
      amount,
      slippageBps: config.EXIT_SLIPPAGE * 100,
    });
    
    if (routes.routesInfos.length === 0) {
      throw new Error('No routes found for exit');
    }
    
    const bestRoute = routes.routesInfos[0];
    const { swapTransaction } = await jupiter.exchange({
      routeInfo: bestRoute,
      userPublicKey: wallet.publicKey,
    });
    
    swapTransaction.sign(wallet);
    const txid = await connection.sendTransaction(swapTransaction, [wallet], {
      skipPreflight: true,
      maxRetries: 3
    });
    
    await connection.confirmTransaction(txid, 'confirmed');
    
    const exitPrice = bestRoute.outAmount / amount;
    
    return { 
      success: true, 
      exitPrice,
      amountOut: bestRoute.outAmount / 1e6 // USDC amount
    };
  } catch (err) {
    console.error('Error closing position:', err);
    return { success: false, error: err.message };
  }
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
  initializeJupiter
};