// analytics-dashboard.js - Performance Analytics Dashboard
class PerformanceAnalytics {
  constructor() {
    this.metrics = {
      trades: [],
      dailyPnL: new Map(),
      channelPerformance: new Map(),
      timeBasedMetrics: new Map(),
      riskMetrics: {
        sharpeRatio: 0,
        maxDrawdown: 0,
        calmarRatio: 0,
        winRate: 0,
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0
      }
    };
  }

  /**
   * Add a completed trade to analytics
   */
  addTrade(trade) {
    const tradeData = {
      ...trade,
      timestamp: trade.timestamp || Date.now(),
      profit: trade.profit || 0,
      duration: trade.exitTimestamp ? trade.exitTimestamp - trade.timestamp : 0,
      returnPercent: trade.entryPrice
        ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100
        : 0
    };

    this.metrics.trades.push(tradeData);
    this.updateDailyPnL(tradeData);
    this.updateChannelPerformance(tradeData);
    this.calculateRiskMetrics();
  }

  updateDailyPnL(trade) {
    const date = new Date(trade.timestamp).toDateString();
    const current = this.metrics.dailyPnL.get(date) || { profit: 0, trades: 0 };
    this.metrics.dailyPnL.set(date, {
      profit: current.profit + trade.profit,
      trades: current.trades + 1
    });
  }

  updateChannelPerformance(trade) {
    const channelId = trade.sourceChannel || 'unknown';
    const current = this.metrics.channelPerformance.get(channelId) || {
      trades: 0,
      profit: 0,
      wins: 0,
      totalReturn: 0
    };

    this.metrics.channelPerformance.set(channelId, {
      trades: current.trades + 1,
      profit: current.profit + trade.profit,
      wins: current.wins + (trade.profit > 0 ? 1 : 0),
      totalReturn: current.totalReturn + trade.returnPercent
    });
  }

  calculateRiskMetrics() {
    const trades = this.metrics.trades;
    if (trades.length === 0) return;

    const profits = trades.map(t => t.profit);
    const returns = trades.map(t => t.returnPercent / 100);

    // Win rate
    const wins = trades.filter(t => t.profit > 0);
    const losses = trades.filter(t => t.profit < 0);
    this.metrics.riskMetrics.winRate = (wins.length / trades.length) * 100;

    // Average win/loss
    this.metrics.riskMetrics.avgWin =
      wins.length > 0 ? wins.reduce((sum, t) => sum + t.profit, 0) / wins.length : 0;
    this.metrics.riskMetrics.avgLoss =
      losses.length > 0
        ? losses.reduce((sum, t) => sum + Math.abs(t.profit), 0) / losses.length
        : 0;

    // Profit factor
    const grossWin = wins.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));
    this.metrics.riskMetrics.profitFactor = grossLoss > 0 ? grossWin / grossLoss : 0;

    // Sharpe ratio
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStdDev = this.calculateStdDev(returns);
    this.metrics.riskMetrics.sharpeRatio =
      returnStdDev > 0 ? avgReturn / returnStdDev : 0;

    // Max drawdown
    this.metrics.riskMetrics.maxDrawdown = this.calculateMaxDrawdown(profits);
  }

  calculateStdDev(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff =
      squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  calculateMaxDrawdown(profits) {
    let peak = 0;
    let maxDrawdown = 0;
    let runningTotal = 0;

    profits.forEach(profit => {
      runningTotal += profit;
      peak = Math.max(peak, runningTotal);
      const dd = (peak - runningTotal) / Math.max(peak, 1);
      maxDrawdown = Math.max(maxDrawdown, dd);
    });

    return maxDrawdown * 100;
  }

  generatePerformanceReport() {
    const totalTrades = this.metrics.trades.length;
    const totalProfit = this.metrics.trades.reduce((sum, t) => sum + t.profit, 0);

    return `
📊 OVERALL PERFORMANCE:
  Total Trades: ${totalTrades}
  Total P/L: ${totalProfit.toFixed(2)}
  Win Rate: ${this.metrics.riskMetrics.winRate.toFixed(1)}%
  Profit Factor: ${this.metrics.riskMetrics.profitFactor.toFixed(2)}
  Sharpe Ratio: ${this.metrics.riskMetrics.sharpeRatio.toFixed(2)}

💰 TRADE METRICS:
  Average Win: ${this.metrics.riskMetrics.avgWin.toFixed(2)}
  Average Loss: ${this.metrics.riskMetrics.avgLoss.toFixed(2)}
  Max Drawdown: ${this.metrics.riskMetrics.maxDrawdown.toFixed(1)}%
  Best Trade: ${this.getBestTrade().toFixed(2)}
  Worst Trade: ${this.getWorstTrade().toFixed(2)}

⏱️ TIMING ANALYSIS:
  Avg Hold Time: ${this.getAverageHoldTime()}
  Best Hour: ${this.getBestTradingHour()}:00
  Best Day: ${this.getBestTradingDay()}

${this.getChannelPerformanceReport()}
`;
  }

  // ... (other methods unchanged) ...
}

module.exports = PerformanceAnalytics;
