// src/tradeStore.js
// Persistent storage for trades and statistics in JSON format

const fs = require('fs');
const path = require('path');

class TradeStore {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'data', 'trades.json');
    this.ensureDbExists();
    this.trades = this.loadTrades();
  }

  // Ensure the data directory and file exist
  ensureDbExists() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify({ trades: [] }, null, 2), 'utf8');
    }
  }

  // Load trades array from disk
  loadTrades() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      const parsed = JSON.parse(data);
      return Array.isArray(parsed.trades) ? parsed.trades : [];
    } catch (err) {
      console.error('Error loading trades:', err);
      return [];
    }
  }

  // Save current trades to disk
  saveTrades() {
    try {
      fs.writeFileSync(
        this.dbPath,
        JSON.stringify({ trades: this.trades }, null, 2),
        'utf8'
      );
    } catch (err) {
      console.error('Error saving trades:', err);
    }
  }

  // Add a new trade
  addTrade(trade) {
    const record = { ...trade, id: trade.id || Date.now().toString(), timestamp: Date.now(), closed: false };
    this.trades.push(record);
    this.saveTrades();
    return record;
  }

  // Update existing trade by ID
  updateTrade(id, updates) {
    const idx = this.trades.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.trades[idx] = {
      ...this.trades[idx],
      ...updates,
      lastUpdated: Date.now(),
    };
    this.saveTrades();
    return this.trades[idx];
  }

  // Mark a trade as closed and record profit
  closeTrade(id, profit) {
    return this.updateTrade(id, { closed: true, profit });
  }

  // Get all active (open) trades
  getActiveTrades() {
    return this.trades.filter(t => !t.closed);
  }

  // Get overall statistics
  getTradeStats() {
    const total = this.trades.length;
    const closedTrades = this.trades.filter(t => t.closed);
    const activeCount = total - closedTrades.length;
    const profits = closedTrades.map(t => t.profit || 0);
    const totalProfit = profits.reduce((sum, p) => sum + p, 0);
    const winners = profits.filter(p => p > 0).length;
    const winRate = closedTrades.length ? (winners / closedTrades.length) * 100 : 0;

    return {
      totalTrades: total,
      activeTrades: activeCount,
      closedTrades: closedTrades.length,
      totalProfit,
      winningTrades: winners,
      winRate,
    };
  }

  // Get recent trades
  getRecentTrades(limit = 10) {
    return [...this.trades]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}

module.exports = new TradeStore();
