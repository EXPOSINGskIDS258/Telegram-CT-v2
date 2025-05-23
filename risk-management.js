// risk-management.js - Advanced Risk Management System
class RiskManager {
  constructor(config) {
    this.config = config;
    this.dailyLimits = {
      maxTrades: 20,
      maxLoss: config.DRY_RUN ? config.DRY_RUN_BALANCE * 0.15 : 1000,
      maxDrawdown: 0.25 // 25% max drawdown
    };
    
    this.sessionStats = {
      tradesCount: 0,
      totalLoss: 0,
      totalProfit: 0,
      consecutiveLosses: 0,
      startingBalance: config.DRY_RUN ? config.DRY_RUN_BALANCE : 0,
      peakBalance: config.DRY_RUN ? config.DRY_RUN_BALANCE : 0
    };
    
    this.riskLevels = {
      low: { maxTradePercent: 2, maxConcurrentTrades: 3 },
      medium: { maxTradePercent: 5, maxConcurrentTrades: 5 },
      high: { maxTradePercent: 10, maxConcurrentTrades: 8 }
    };
  }

  /**
   * Evaluate if a trade should be allowed based on risk parameters
   */
  evaluateTradeRisk(signal, currentBalance, activeTrades) {
    const riskAssessment = {
      allowed: true,
      riskScore: 0,
      warnings: [],
      adjustments: {},
      maxTradeSize: signal.tradePercent
    };

    // 1. Daily limits check
    if (this.sessionStats.tradesCount >= this.dailyLimits.maxTrades) {
      riskAssessment.allowed = false;
      riskAssessment.warnings.push('Daily trade limit reached');
      return riskAssessment;
    }

    // 2. Loss limit check
    if (this.sessionStats.totalLoss >= this.dailyLimits.maxLoss) {
      riskAssessment.allowed = false;
      riskAssessment.warnings.push('Daily loss limit reached');
      return riskAssessment;
    }

    // 3. Drawdown check
    const currentDrawdown = (this.sessionStats.peakBalance - currentBalance) / this.sessionStats.peakBalance;
    if (currentDrawdown >= this.dailyLimits.maxDrawdown) {
      riskAssessment.allowed = false;
      riskAssessment.warnings.push(`Maximum drawdown reached: ${(currentDrawdown * 100).toFixed(1)}%`);
      return riskAssessment;
    }

    // 4. Consecutive losses check
    if (this.sessionStats.consecutiveLosses >= 5) {
      riskAssessment.maxTradeSize = Math.min(signal.tradePercent, 2); // Reduce to 2%
      riskAssessment.adjustments.tradeSize = 'Reduced due to consecutive losses';
      riskAssessment.warnings.push('Trade size reduced due to losing streak');
    }

    // 5. Concurrent trades check
    const riskLevel = this.determineRiskLevel(signal);
    const maxConcurrent = this.riskLevels[riskLevel].maxConcurrentTrades;
    
    if (activeTrades.length >= maxConcurrent) {
      riskAssessment.allowed = false;
      riskAssessment.warnings.push(`Maximum concurrent trades reached for ${riskLevel} risk level`);
      return riskAssessment;
    }

    // 6. Signal confidence risk adjustment
    if (signal.confidence < 2) {
      riskAssessment.maxTradeSize = Math.min(signal.tradePercent, 3); // Cap at 3%
      riskAssessment.adjustments.tradeSize = 'Reduced due to low signal confidence';
      riskAssessment.warnings.push('Trade size adjusted for low confidence signal');
    }

    // 7. Channel-specific risk adjustments
    if (signal.channelType === 'degen') {
      riskAssessment.maxTradeSize = Math.min(riskAssessment.maxTradeSize, 4); // Max 4% for degen
      riskAssessment.adjustments.channelRisk = 'Degen channel risk adjustment applied';
    }

    // Calculate overall risk score (0-10)
    riskAssessment.riskScore = this.calculateRiskScore(signal, currentBalance, activeTrades);

    return riskAssessment;
  }

  determineRiskLevel(signal) {
    if (signal.risk === 'high' || signal.urgency === 'high' || signal.channelType === 'degen') {
      return 'high';
    }
    if (signal.confidence >= 2.5 && signal.risk === 'low') {
      return 'low';
    }
    return 'medium';
  }

  calculateRiskScore(signal, currentBalance, activeTrades) {
    let score = 5; // Base score

    // Adjust for signal quality
    if (signal.confidence >= 2.5) score -= 1;
    if (signal.confidence < 1.5) score += 2;

    // Adjust for market sentiment
    if (signal.sentiment === 'bullish') score -= 1;
    if (signal.sentiment === 'bearish') score += 1;

    // Adjust for position sizing
    if (signal.tradePercent > 8) score += 2;
    if (signal.tradePercent < 3) score -= 1;

    // Adjust for current portfolio state
    if (activeTrades.length > 3) score += 1;
    if (this.sessionStats.consecutiveLosses > 2) score += 2;

    // Adjust for channel type
    if (signal.channelType === 'degen') score += 1;
    if (signal.channelType === 'underdog') score -= 0.5;

    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Update session statistics after trade completion
   */
  updateStats(tradeResult) {
    this.sessionStats.tradesCount++;
    
    if (tradeResult.profit > 0) {
      this.sessionStats.totalProfit += tradeResult.profit;
      this.sessionStats.consecutiveLosses = 0;
      
      // Update peak balance
      const newBalance = this.getCurrentBalance() + tradeResult.profit;
      if (newBalance > this.sessionStats.peakBalance) {
        this.sessionStats.peakBalance = newBalance;
      }
    } else {
      this.sessionStats.totalLoss += Math.abs(tradeResult.profit);
      this.sessionStats.consecutiveLosses++;
    }
  }

  /**
   * Get current risk status
   */
  getRiskStatus() {
    const currentBalance = this.getCurrentBalance();
    const drawdown = (this.sessionStats.peakBalance - currentBalance) / this.sessionStats.peakBalance;
    
    return {
      tradesRemaining: this.dailyLimits.maxTrades - this.sessionStats.tradesCount,
      lossRemaining: this.dailyLimits.maxLoss - this.sessionStats.totalLoss,
      currentDrawdown: (drawdown * 100).toFixed(1) + '%',
      consecutiveLosses: this.sessionStats.consecutiveLosses,
      riskLevel: this.getCurrentRiskLevel(),
      recommendations: this.getRiskRecommendations()
    };
  }

  getCurrentRiskLevel() {
    const currentBalance = this.getCurrentBalance();
    const drawdown = (this.sessionStats.peakBalance - currentBalance) / this.sessionStats.peakBalance;
    
    if (drawdown >= 0.15 || this.sessionStats.consecutiveLosses >= 4) {
      return 'HIGH';
    } else if (drawdown >= 0.08 || this.sessionStats.consecutiveLosses >= 2) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  getRiskRecommendations() {
    const recommendations = [];
    const riskLevel = this.getCurrentRiskLevel();
    
    if (riskLevel === 'HIGH') {
      recommendations.push('Consider taking a break from trading');
      recommendations.push('Reduce position sizes significantly');
      recommendations.push('Focus only on highest confidence signals');
    } else if (riskLevel === 'MEDIUM') {
      recommendations.push('Reduce position sizes by 25-50%');
      recommendations.push('Be more selective with signals');
      recommendations.push('Consider tighter stop losses');
    } else {
      recommendations.push('Current risk level is acceptable');
      recommendations.push('Continue with normal trading parameters');
    }
    
    return recommendations;
  }

  getCurrentBalance() {
    // This would be integrated with the actual balance checking
    return this.config.DRY_RUN ? 1000 : 0; // Simplified for now
  }

  /**
   * Generate risk report
   */
  generateRiskReport() {
    const status = this.getRiskStatus();
    const balance = this.getCurrentBalance();
    
    return `
╔══════════════════════════════════════════════════════════════╗
║                        RISK REPORT                           ║
╚══════════════════════════════════════════════════════════════╝

📊 CURRENT STATUS:
  Risk Level: ${status.riskLevel}
  Current Balance: $${balance.toFixed(2)}
  Peak Balance: $${this.sessionStats.peakBalance.toFixed(2)}
  Current Drawdown: ${status.currentDrawdown}

📈 SESSION STATISTICS:
  Trades Executed: ${this.sessionStats.tradesCount}
  Trades Remaining: ${status.tradesRemaining}
  Total Profit: $${this.sessionStats.totalProfit.toFixed(2)}
  Total Loss: $${this.sessionStats.totalLoss.toFixed(2)}
  Net P/L: $${(this.sessionStats.totalProfit - this.sessionStats.totalLoss).toFixed(2)}
  Consecutive Losses: ${this.sessionStats.consecutiveLosses}

🎯 RECOMMENDATIONS:
${status.recommendations.map(r => `  • ${r}`).join('\n')}

⚠️  LIMITS:
  Max Daily Trades: ${this.dailyLimits.maxTrades}
  Max Daily Loss: $${this.dailyLimits.maxLoss.toFixed(2)}
  Max Drawdown: ${(this.dailyLimits.maxDrawdown * 100).toFixed(0)}%
    `;
  }
}

// Portfolio analyzer for position management
class PortfolioAnalyzer {
  constructor() {
    this.positions = new Map();
    this.correlations = new Map();
  }

  analyzePortfolio(activeTrades) {
    const analysis = {
      totalValue: 0,
      totalPnL: 0,
      diversification: this.calculateDiversification(activeTrades),
      riskConcentration: this.calculateRiskConcentration(activeTrades),
      correlationRisk: this.calculateCorrelationRisk(activeTrades),
      recommendations: []
    };

    // Calculate portfolio metrics
    activeTrades.forEach(trade => {
      analysis.totalValue += trade.amount || 0;
      analysis.totalPnL += trade.profit || 0;
    });

    // Generate recommendations
    if (analysis.riskConcentration > 0.4) {
      analysis.recommendations.push('Portfolio is concentrated - consider diversifying');
    }

    if (activeTrades.length > 8) {
      analysis.recommendations.push('Too many concurrent positions - consider reducing');
    }

    if (analysis.diversification < 0.3) {
      analysis.recommendations.push('Low diversification - avoid similar tokens');
    }

    return analysis;
  }

  calculateDiversification(trades) {
    // Simple diversification metric based on number of positions
    // and their relative sizes
    const totalValue = trades.reduce((sum, trade) => sum + (trade.amount || 0), 0);
    
    if (totalValue === 0) return 1;
    
    const weights = trades.map(trade => (trade.amount || 0) / totalValue);
    const herfindahl = weights.reduce((sum, weight) => sum + weight * weight, 0);
    
    return 1 - herfindahl; // Higher = more diversified
  }

  calculateRiskConcentration(trades) {
    if (trades.length === 0) return 0;
    
    const totalValue = trades.reduce((sum, trade) => sum + (trade.amount || 0), 0);
    const largestPosition = Math.max(...trades.map(trade => trade.amount || 0));
    
    return totalValue > 0 ? largestPosition / totalValue : 0;
  }

  calculateCorrelationRisk(trades) {
    // Simplified correlation risk - in reality would need price data
    // For now, just check if trading similar tokens (same channel, similar timing)
    const channels = new Set(trades.map(trade => trade.channelId));
    const channelConcentration = 1 - (channels.size / Math.max(trades.length, 1));
    
    return channelConcentration;
  }
}

module.exports = { RiskManager, PortfolioAnalyzer };