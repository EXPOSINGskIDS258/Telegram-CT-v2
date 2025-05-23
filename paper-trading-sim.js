// Enhanced Paper Trading Simulator with realistic market conditions
class PaperTradingSimulator {
  constructor(config) {
    this.config = config;
    this.state = {
      balance: parseFloat(config.DRY_RUN_BALANCE) || 1000,
      positions: new Map(),
      orders: new Map(),
      priceHistory: new Map(),
      marketConditions: {
        volatility: 0.05, // Base volatility
        trend: 0,         // -1 bearish, 0 neutral, 1 bullish
        volume: 1.0       // Volume multiplier
      },
      performance: {
        totalTrades: 0,
        winningTrades: 0,
        totalProfit: 0,
        maxDrawdown: 0,
        peakBalance: parseFloat(config.DRY_RUN_BALANCE) || 1000
      }
    };

    this.priceEngine = new RealisticPriceEngine(config);
    this.marketEvents = new MarketEventSimulator();
  }

  /**
   * Execute a paper trade with realistic slippage and timing
   */
  async executePaperTrade(signal, metadata = {}) {
    const tokenAddress = signal.contractAddress;

    // Generate initial price if new token
    if (!this.state.priceHistory.has(tokenAddress)) {
      const initialPrice = this.generateInitialPrice();
      this.state.priceHistory.set(tokenAddress, [{
        price: initialPrice,
        timestamp: Date.now(),
        volume: Math.random() * 1000000 + 100000 // Random volume
      }]);
    }

    const currentPrice = this.getCurrentPrice(tokenAddress);
    const tradeAmount = this.state.balance * (signal.tradePercent / 100);

    // Simulate order execution delay and slippage
    const executionResult = await this.simulateOrderExecution(
      tokenAddress,
      'buy',
      tradeAmount,
      currentPrice,
      signal
    );

    // Handle failure
    if (!executionResult.success) {
      return {
        success: false,
        error: executionResult.error,
        timestamp: Date.now()
      };
    }

    // Create position on success
    const position = {
      tokenAddress,
      entryPrice: executionResult.executedPrice,
      quantity: tradeAmount / executionResult.executedPrice,
      entryTime: Date.now(),
      stopLoss: signal.stopLossPercent
        ? executionResult.executedPrice * (1 - signal.stopLossPercent / 100)
        : null,
      takeProfits: Array.isArray(signal.takeProfitTargets)
        ? signal.takeProfitTargets.map(tp =>
            executionResult.executedPrice * (1 + tp / 100)
          )
        : [],
      metadata: {
        ...metadata,
        signal: signal,
        originalTradePercent: signal.tradePercent
      }
    };

    this.state.positions.set(tokenAddress, position);
    this.state.balance -= tradeAmount;
    this.state.performance.totalTrades++;

    // Set up price monitoring for this position
    this.startPositionMonitoring(tokenAddress);

    // Return success payload
    return {
      success: true,
      id: `paper_${Date.now()}`,
      entryPrice: executionResult.executedPrice,
      amount: tradeAmount,
      quantity: position.quantity,
      slippage: executionResult.slippage,
      executionTime: executionResult.executionTime,
      timestamp: Date.now()
    };
  }

  /**
   * Simulate realistic order execution with slippage and delays
   */
  async simulateOrderExecution(tokenAddress, side, amount, targetPrice, signal) {
    // Simulate network delay (50-500ms)
    const networkDelay = Math.random() * 450 + 50;
    await new Promise(resolve => setTimeout(resolve, networkDelay));

    // Calculate slippage based on trade size and market conditions
    const slippage = this.calculateRealisticSlippage(amount, targetPrice, signal);

    // Price movement during execution
    const priceMovement = this.calculatePriceMovementDuringExecution(targetPrice);

    const executedPrice = side === 'buy'
      ? targetPrice * (1 + slippage + priceMovement)
      : targetPrice * (1 - slippage + priceMovement);

    // Check if execution would fail (extreme slippage)
    if (slippage > 0.15) { // 15% slippage threshold
      return {
        success: false,
        error: `Excessive slippage: ${(slippage * 100).toFixed(2)}%`,
        slippage: slippage
      };
    }

    return {
      success: true,
      executedPrice,
      slippage,
      executionTime: networkDelay,
      priceMovement
    };
  }

  calculateRealisticSlippage(amount, price, signal) {
    // Base slippage from config
    let slippage = (this.config.DEFAULT_SLIPPAGE || 3) / 100;

    // Adjust for trade size (larger trades = more slippage)
    const tradeSizeMultiplier = Math.min(amount / 10000, 2); // Cap at 2x
    slippage *= 1 + tradeSizeMultiplier * 0.5;

    // Adjust for market volatility
    slippage *= 1 + this.state.marketConditions.volatility;

    // Adjust for signal urgency (urgent signals often face more slippage)
    if (signal.urgency === 'high') slippage *= 1.3;

    // Add random component (market microstructure)
    slippage += (Math.random() - 0.5) * 0.02; // ±1% random

    return Math.max(0, slippage);
  }

  calculatePriceMovementDuringExecution(price) {
    // Price can move during the execution delay
    const vol = this.state.marketConditions.volatility;
    return (Math.random() - 0.5) * vol * 0.1;
  }

  /**
   * Start monitoring a position for stop loss and take profit triggers
   */
  startPositionMonitoring(tokenAddress) {
    const interval = setInterval(() => {
      const pos = this.state.positions.get(tokenAddress);
      if (!pos) return clearInterval(interval);

      const currentPrice = this.getCurrentPrice(tokenAddress);

      // Stop loss
      if (pos.stopLoss && currentPrice <= pos.stopLoss) {
        this.executePositionClose(tokenAddress, 'stop_loss', currentPrice);
        return clearInterval(interval);
      }

      // Take profits
      for (let i = 0; i < pos.takeProfits.length; i++) {
        if (currentPrice >= pos.takeProfits[i]) {
          const pct = 1 / pos.takeProfits.length;
          this.executePartialClose(tokenAddress, pct, currentPrice, 'take_profit');
          pos.takeProfits.splice(i, 1);
          break;
        }
      }

      // Trailing stop
      if (this.config.USE_TRAILING_STOP && pos.stopLoss) {
        const dist = (this.config.TRAILING_STOP_PERCENT || 20) / 100;
        const newSL = currentPrice * (1 - dist);
        if (newSL > pos.stopLoss) pos.stopLoss = newSL;
      }
    }, 5000);
  }

  executePositionClose(tokenAddress, reason, price) {
    const pos = this.state.positions.get(tokenAddress);
    if (!pos) return;

    const proceeds = pos.quantity * price;
    const profit = proceeds - pos.quantity * pos.entryPrice;

    this.state.balance += proceeds;
    this.updatePerformanceStats(profit);
    this.state.positions.delete(tokenAddress);
  }

  executePartialClose(tokenAddress, pct, price, reason) {
    const pos = this.state.positions.get(tokenAddress);
    if (!pos) return;

    const qty = pos.quantity * pct;
    const proceeds = qty * price;
    const cost = qty * pos.entryPrice;
    const profit = proceeds - cost;

    this.state.balance += proceeds;
    pos.quantity -= qty;
    this.updatePerformanceStats(profit);
    if (pos.quantity < 1e-6) this.state.positions.delete(tokenAddress);
  }

  updatePerformanceStats(profit) {
    this.state.performance.totalProfit += profit;
    if (profit > 0) this.state.performance.winningTrades++;

    if (this.state.balance > this.state.performance.peakBalance) {
      this.state.performance.peakBalance = this.state.balance;
    }
    const dd =
      (this.state.performance.peakBalance - this.state.balance) /
      this.state.performance.peakBalance;
    this.state.performance.maxDrawdown =
      Math.max(this.state.performance.maxDrawdown, dd);
  }

  getCurrentPrice(tokenAddress) {
    const hist = this.state.priceHistory.get(tokenAddress) || [];
    const last = hist.length ? hist[hist.length - 1].price : this.generateInitialPrice();
    const next = this.priceEngine.generateNextPrice(last, tokenAddress);

    hist.push({ price: next, timestamp: Date.now(), volume: this.generateVolume() });
    if (hist.length > 1000) hist.shift();
    this.state.priceHistory.set(tokenAddress, hist);
    return next;
  }

  generateInitialPrice() {
    const ranges = [
      { min: 1e-6, max: 1e-5, w: 0.4 },
      { min: 1e-5, max: 1e-4, w: 0.3 },
      { min: 1e-4, max: 1e-3, w: 0.2 },
      { min: 1e-3, max: 1e-2, w: 0.1 }
    ];
    let cum = 0;
    const r = Math.random();
    for (const rng of ranges) {
      cum += rng.w;
      if (r <= cum) return Math.random() * (rng.max - rng.min) + rng.min;
    }
    return 1e-5;
  }

  generateVolume() {
    return Math.random() * 500000 + 50000;
  }

  getPortfolioSummary() {
    const positions = Array.from(this.state.positions.values());
    let val = 0, pnl = 0;
    positions.forEach(pos => {
      const cp = this.getCurrentPrice(pos.tokenAddress);
      val += pos.quantity * cp;
      pnl += pos.quantity * (cp - pos.entryPrice);
    });
    const total = this.state.balance + val;
    return {
      balance: this.state.balance,
      positionValue: val,
      totalValue: total,
      unrealizedPnL: pnl,
      realizedPnL: this.state.performance.totalProfit,
      totalPnL: pnl + this.state.performance.totalProfit,
      active: positions.length,
      trades: this.state.performance.totalTrades,
      winRate: this.state.performance.totalTrades
        ? (this.state.performance.winningTrades / this.state.performance.totalTrades) * 100
        : 0,
      maxDrawdown: this.state.performance.maxDrawdown * 100,
      roi:
        ((total - (parseFloat(this.config.DRY_RUN_BALANCE) || 1000)) /
          (parseFloat(this.config.DRY_RUN_BALANCE) || 1000)) *
        100
    };
  }

  getDetailedPositions() {
    return Array.from(this.state.positions.entries()).map(
      ([addr, pos]) => {
        const cp = this.getCurrentPrice(addr);
        const pnl = pos.quantity * (cp - pos.entryPrice);
        return {
          tokenAddress: addr,
          entryPrice: pos.entryPrice,
          currentPrice: cp,
          quantity: pos.quantity,
          positionValue: pos.quantity * cp,
          unrealizedPnL: pnl,
          unrealizedPnLPercent: (pnl / (pos.entryPrice * pos.quantity)) * 100,
          stopLoss: pos.stopLoss,
          takeProfits: pos.takeProfits,
          holdingTime: Date.now() - pos.entryTime,
          channelSource: pos.metadata?.signal?.channelInfo?.name || 'Unknown'
        };
      }
    );
  }
}

// Realistic price engine for paper trading
class RealisticPriceEngine {
  constructor(config) {
    this.config = config;
    this.baseVolatility = (config.DRY_RUN_PRICE_VOLATILITY || 5) / 100;
    this.trendFactors = new Map();
  }

  generateNextPrice(lastPrice, tokenAddress) {
    if (!this.trendFactors.has(tokenAddress)) {
      this.trendFactors.set(tokenAddress, {
        momentum: 0,
        volatility: this.baseVolatility*(0.5+Math.random()),
        trendDirection: Math.random()-0.5,
        lastUpdate:Date.now()
      });
    }
    const t = this.trendFactors.get(tokenAddress);
    if (Date.now()-t.lastUpdate>60000) {
      t.trendDirection += (Math.random()-0.5)*0.1;
      t.trendDirection = Math.max(-1,Math.min(1,t.trendDirection));
      t.lastUpdate=Date.now();
    }
    const rand=(Math.random()-0.5)*2;
    const change=(rand + t.trendDirection*0.3)*t.volatility;
    const np = lastPrice*(1+change);
    return Math.max(np,lastPrice*0.01);
  }
}

// Market event simulator for realistic conditions
class MarketEventSimulator {
  constructor() {
    this.events=[
      {type:'pump',probability:0.02,impact:0.5},
      {type:'dump',probability:0.02,impact:-0.3},
      {type:'whale_buy',probability:0.005,impact:0.2},
      {type:'whale_sell',probability:0.005,impact:-0.15},
      {type:'listing',probability:0.001,impact:0.8}
    ];
  }
  checkForEvents() {
    const triggered=[];
    this.events.forEach(e=>{ if(Math.random()<e.probability) triggered.push(e); });
    return triggered;
  }
}

module.exports = PaperTradingSimulator;
