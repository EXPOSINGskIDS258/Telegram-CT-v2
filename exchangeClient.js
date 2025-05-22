require('dotenv').config();
const config = require('./config');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// ----- Simulation (Paper) Setup -----
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
    const dataDir = path.join(__dirname, 'data');
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
    simulationState.orders = simulationState.orders.filter(o => o.token !== order.token);
  }
  saveState();
}

// Initialize simulation only if in paper mode
if (config.mode === 'paper') initSimulation();

// ----- Live Order Helpers -----
function signRequest(payload, secret) {
  const message = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

async function placeLiveMarketOrder(symbol, amountUsdc) {
  const url = `${config.EXCHANGE_API_BASE_URL}/orders`;
  const body = { symbol, side: 'buy', type: 'market', quantity: amountUsdc };
  const headers = {
    'API-KEY': process.env.EXCHANGE_API_KEY,
    'API-SIGN': signRequest(body, process.env.EXCHANGE_API_SECRET),
    'Content-Type': 'application/json'
  };
  const resp = await axios.post(url, body, { headers });
  return resp.data;
}

async function placeLiveStopLoss(symbol, amount, stopPrice) {
  const url = `${config.EXCHANGE_API_BASE_URL}/orders`;
  const body = { symbol, side: 'sell', type: 'stop', quantity: amount, stopPrice };
  const headers = {
    'API-KEY': process.env.EXCHANGE_API_KEY,
    'API-SIGN': signRequest(body, process.env.EXCHANGE_API_SECRET),
    'Content-Type': 'application/json'
  };
  const resp = await axios.post(url, body, { headers });
  return resp.data;
}

async function placeLiveTakeProfit(symbol, amount, tpPrice) {
  const url = `${config.EXCHANGE_API_BASE_URL}/orders`;
  const body = { symbol, side: 'sell', type: 'limit', quantity: amount, price: tpPrice };
  const headers = {
    'API-KEY': process.env.EXCHANGE_API_KEY,
    'API-SIGN': signRequest(body, process.env.EXCHANGE_API_SECRET),
    'Content-Type': 'application/json'
  };
  const resp = await axios.post(url, body, { headers });
  return resp.data;
}

// ----- Unified Interface -----
async function getAccountBalance() {
  if (config.mode === 'live') {
    // implement live balance fetch if available
    throw new Error('Live balance fetch not implemented');
  }
  return simulationState.balance;
}

async function buyMarket(mintAddress, amountUsdc) {
  if (config.mode === 'live') return placeLiveMarketOrder(mintAddress, amountUsdc);
  return module.exports._buySimulation(mintAddress, amountUsdc);
}

async function placeStopLoss(mintAddress, amount, stopPrice) {
  if (config.mode === 'live') return placeLiveStopLoss(mintAddress, amount, stopPrice);
  return module.exports._placeSimulationStop(mintAddress, stopPrice);
}

async function placeTakeProfit(mintAddress, amount, tpPrice) {
  if (config.mode === 'live') return placeLiveTakeProfit(mintAddress, amount, tpPrice);
  return module.exports._placeSimulationTP(mintAddress, amount, tpPrice);
}

async function modifyOrder(orderId, updates) {
  if (config.mode === 'live') {
    // implement live modify
    throw new Error('Live modify order not implemented');
  }
  const idx = simulationState.orders.findIndex(o => o.id === orderId);
  if (idx < 0) throw new Error(`Order ${orderId} not found`);
  simulationState.orders[idx] = { ...simulationState.orders[idx], ...updates, lastUpdated: Date.now() };
  saveState();
  return { id: orderId };
}

async function cancelOrder(orderId) {
  if (config.mode === 'live') {
    // implement live cancel
    throw new Error('Live cancel not implemented');
  }
  const len = simulationState.orders.length;
  simulationState.orders = simulationState.orders.filter(o => o.id !== orderId);
  if (simulationState.orders.length < len) { saveState(); return true; }
  return false;
}

async function getCurrentPrice(mintAddress) {
  if (config.mode === 'live') {
    // implement live price fetch
    throw new Error('Live price fetch not implemented');
  }
  return simulationState.prices[mintAddress] || 0;
}

async function getPosition(mintAddress) {
  if (config.mode === 'live') {
    // implement live position fetch
    throw new Error('Live position fetch not implemented');
  }
  const p = simulationState.positions[mintAddress];
  return { size: p ? p.amount : 0 };
}

async function closePosition(mintAddress) {
  if (config.mode === 'live') {
    // implement live close
    throw new Error('Live close not implemented');
  }
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

// Expose simulation internals for unified functions
const _buySimulation = buyMarket;
const _placeSimulationStop = placeStopLoss;
const _placeSimulationTP = placeTakeProfit;

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

  // Internals for paper logic
  _buySimulation,
  _placeSimulationStop,
  _placeSimulationTP,
};
