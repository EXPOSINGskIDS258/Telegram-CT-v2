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
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fetch = require('node-fetch');

// Jupiter API integration (using v6 API instead of deprecated core package)
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
      try {
        // Handle different private key formats
        let privateKeyBytes;
        if (config.WALLET_PRIVATE_KEY.startsWith('[') && config.WALLET_PRIVATE_KEY.endsWith(']')) {
          // Array format: [1,2,3,...]
          privateKeyBytes = new Uint8Array(JSON.parse(config.WALLET_PRIVATE_KEY));
        } else if (config.WALLET_PRIVATE_KEY.length === 128) {
          // Hex format
          privateKeyBytes = Buffer.from(config.WALLET_PRIVATE_KEY, 'hex');
        } else {
          // Base58 format
          const bs58 = require('bs58');
          privateKeyBytes = bs58.decode(config.WALLET_PRIVATE_KEY);
        }
        
        wallet = Keypair.fromSecretKey(privateKeyBytes);
        console.log('✅ Wallet initialized:', wallet.publicKey.toString());
      } catch (err) {
        console.error('❌ Failed to parse private key:', err.message);
        throw new Error('Invalid private key format. Use hex, base58, or array format.');
      }
    }
    
    console.log('✅ Exchange client initialized');
  } catch (err) {
    console.error('❌ Failed to initialize exchange client:', err);
    throw err;
  }
}

// ----- Paper Trading State Management -----
const STATE_FILE = path.join(__dirname, 'data', 'simulation-state.json');
let simulationState = {
  prices: {},
  positions: {},
  orders: [],
  balance: config.DRY_RUN_BALANCE || 1000,
  lastUpdate: Date.now()
};

function initSimulation() {
  try {
    const dataDir = path.dirname(STATE_FILE);
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

// ----- Jupiter API Integration -----

/**
 * Get Jupiter quote for a swap
 */
async function getJupiterQuote(inputMint, outputMint, amount, slippageBps = 50) {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amount}&` +
      `slippageBps=${slippageBps}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Jupiter quote API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('Jupiter quote error:', err);
    throw err;
  }
}

/**
 * Execute swap via Jupiter
 */
async function executeJupiterSwap(quoteResponse) {
  if (!wallet) throw new Error('Wallet not initialized');
  
  try {
    // Get swap transaction
    const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: config.PRIORITY_FEE_LAMPORTS || 10000
      })
    });

    if (!swapResponse.ok) {
      throw new Error(`Jupiter swap API error: ${swapResponse.status}`);
    }

    const { swapTransaction } = await swapResponse.json();
    
    // Deserialize transaction
    const transactionBuf = Buffer.from(swapTransaction, 'base64');
    const transaction = Transaction.from(transactionBuf);
    
    // Sign and send transaction
    transaction.sign(wallet);
    
    const signature = await connection.sendTransaction(transaction, [wallet], {
      skipPreflight: false,
      maxRetries: 3
    });
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    return {
      signature,
      success: true
    };
  } catch (err) {
    console.error('Jupiter swap execution error:', err);
    throw err;
  }
}

/**
 * Get real-time price from Jupiter
 */
async function getLivePrice(mintAddress) {
  try {
    const inputMint = config.USDC_MINT_ADDRESS;
    const outputMint = mintAddress;
    
    // Get quote for 1 USDC worth
    const quote = await getJupiterQuote(inputMint, outputMint, 1_000_000); // 1 USDC (6 decimals)
    
    if (!quote || !quote.outAmount) {
      throw new Error('No quote available');
    }
    
    const price = 1_000_000 / parseInt(quote.outAmount); // Price per token in USDC
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
  if (!wallet) throw new Error('Wallet not initialized');
  
  try {
    const inputMint = config.USDC_MINT_ADDRESS;
    const outputMint = mintAddress;
    const amount = Math.floor(amountUsdc * 1_000_000); // Convert to USDC decimals
    
    // Get quote
    const quote = await getJupiterQuote(
      inputMint, 
      outputMint, 
      amount, 
      config.DEFAULT_SLIPPAGE * 100
    );
    
    if (!quote || !quote.outAmount) {
      throw new Error('No quote available for swap');
    }
    
    console.log(`Found route: ${amountUsdc} USDC → ~${parseInt(quote.outAmount) / 1e9} tokens`);
    
    // Execute swap
    const result = await executeJupiterSwap(quote);
    
    const filledPrice = amount / parseInt(quote.outAmount);
    
    return {
      id: result.signature,
      filledPrice,
      amountOut: parseInt(quote.outAmount),
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
      // Test swap of $100 to check liquidity and price impact
      const testAmount = 100_000_000; // 100 USDC
      const quote = await getJupiterQuote(
        config.USDC_MINT_ADDRESS,
        mintAddress,
        testAmount,
        1000 // 10% for safety check
      );
      
      if (quote && quote.outAmount) {
        // Estimate price impact based on quote vs linear scaling
        const expectedOut = (testAmount / 1_000_000) * parseInt(quote.outAmount);
        priceImpact = Math.abs(1 - (parseInt(quote.outAmount) / expectedOut)) * 100;
        
        // Estimate liquidity based on price impact
        if (priceImpact < 1) liquidity = 100000; // Good liquidity
        else if (priceImpact < 5) liquidity = 50000; // Moderate
        else if (priceImpact < 10) liquidity = 10000; // Low
        else liquidity = 5000; // Very low
      }
    } catch (err) {
      console.warn('Could not fetch Jupiter quote for safety check');
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
    if (!connection || !wallet) {
      await initializeJupiter();
    }
    
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
    return balance || 0;
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
  if (!connection || !wallet) {
    await initializeJupiter();
  }
  
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
  
  // Live trading - return a simulated order that the trader.js will monitor
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
  
  // Live trading - return a simulated order that the trader.js will monitor
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
    if (!connection || !wallet) {
      await initializeJupiter();
    }
    
    const mint = new PublicKey(mintAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { mint }
    );
    
    if (tokenAccounts.value.length === 0) {
      return { size: 0 };
    }
    
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return { size: balance || 0 };
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
    
    // Swap tokens back to USDC using Jupiter
    const outputMint = config.USDC_MINT_ADDRESS;
    const inputMint = mintAddress;
    
    // Get amount in smallest unit (assuming 9 decimals for most tokens)
    const amount = Math.floor(position.size * 1e9);
    
    const quote = await getJupiterQuote(
      inputMint,
      outputMint,
      amount,
      config.EXIT_SLIPPAGE * 100
    );
    
    if (!quote || !quote.outAmount) {
      throw new Error('No quote available for exit');
    }
    
    const result = await executeJupiterSwap(quote);
    const exitPrice = parseInt(quote.outAmount) / amount;
    
    return { 
      success: true, 
      exitPrice,
      amountOut: parseInt(quote.outAmount) / 1e6 // USDC amount
    };
  } catch (err) {
    console.error('Error closing position:', err);
    return { success: false, error: err.message };
  }
}

// Initialize on module load only for live trading
if (!config.DRY_RUN) {
  initializeJupiter().catch(err => {
    console.warn('Failed to initialize Jupiter on load:', err.message);
  });
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