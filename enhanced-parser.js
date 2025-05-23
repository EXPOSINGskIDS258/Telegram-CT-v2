// enhanced-parser.js - Enhanced parser with machine learning-like pattern recognition
class EnhancedSignalParser {
  constructor() {
    this.patterns = {
      // Contract address patterns for different chains
      solana: /[A-Za-z0-9]{32,50}(?=\s|$|pump|sol)/g,
      ethereum: /0x[a-fA-F0-9]{40}/g,
      
      // Price and percentage patterns
      percentage: /(\d+(?:\.\d+)?)\s*%/g,
      price: /\$?(\d+(?:\.\d+)?(?:[kKmM])?)/g,
      
      // Trading keywords with confidence weights
      tradingKeywords: {
        high: ['ape', 'buy now', 'entry', 'long', 'pump'],
        medium: ['bullish', 'moon', 'gem', 'signal'],
        low: ['watch', 'potential', 'maybe', 'could']
      },
      
      // Stop loss indicators
      stopLoss: [
        /(?:sl|stop\s*loss|stop)\s*(?:at|@|:)?\s*(\d+(?:\.\d+)?)\s*%?/i,
        /cut\s*(?:at|@)\s*(\d+(?:\.\d+)?)\s*%?/i,
        /stop\s*(\d+(?:\.\d+)?)\s*%/i
      ],
      
      // Take profit indicators
      takeProfit: [
        /(?:tp|take\s*profit)\s*(?:\d+)?\s*(?:at|@|:)?\s*(\d+(?:\.\d+)?)\s*%/gi,
        /target\s*(?:\d+)?\s*(?:at|@|:)?\s*(\d+(?:\.\d+)?)\s*%/gi,
        /sell\s*(?:at|@)\s*(\d+(?:\.\d+)?)\s*%/gi
      ]
    };
    
    // Learning system to track pattern success rates
    this.patternStats = {
      successByPattern: new Map(),
      failuresByPattern: new Map(),
      channelPatterns: new Map()
    };
  }

  /**
   * Enhanced parsing with pattern recognition and confidence scoring
   */
  parseSignal(message, channelId = null, metadata = {}) {
    const result = {
      contractAddress: null,
      tradePercent: null,
      stopLossPercent: null,
      takeProfitTargets: [],
      manualTakeProfit: false,
      confidence: 0,
      patterns: [],
      channelType: this.getChannelType(channelId),
      sentiment: this.analyzeSentiment(message),
      urgency: this.analyzeUrgency(message),
      risk: this.analyzeRisk(message)
    };

    // Contract address extraction with chain detection
    result.contractAddress = this.extractContractAddress(message);
    if (result.contractAddress) {
      result.patterns.push('contract_found');
      result.confidence += 1;
    }

    // Trading percentage extraction
    result.tradePercent = this.extractTradePercent(message, channelId);
    if (result.tradePercent) {
      result.patterns.push('trade_percent');
      result.confidence += 0.5;
    }

    // Stop loss extraction
    result.stopLossPercent = this.extractStopLoss(message);
    if (result.stopLossPercent) {
      result.patterns.push('stop_loss');
      result.confidence += 0.5;
    }

    // Take profit extraction
    result.takeProfitTargets = this.extractTakeProfits(message);
    if (result.takeProfitTargets.length > 0) {
      result.patterns.push('take_profits');
      result.confidence += 0.3 * result.takeProfitTargets.length;
    }

    // Keyword analysis for additional confidence
    const keywordScore = this.analyzeKeywords(message);
    result.confidence += keywordScore;

    // Channel-specific adjustments
    result.confidence = this.adjustConfidenceForChannel(result.confidence, channelId, result.patterns);

    // Pattern learning update
    this.updatePatternStats(result.patterns, channelId);

    return result;
  }

  extractContractAddress(message) {
    // Try Solana addresses first (most common for memecoins)
    const solanaMatches = message.match(this.patterns.solana);
    if (solanaMatches) {
      // Filter out obviously wrong matches (too short, common words, etc.)
      for (const match of solanaMatches) {
        if (this.isValidSolanaAddress(match)) {
          return match;
        }
      }
    }

    // Try Ethereum addresses
    const ethMatches = message.match(this.patterns.ethereum);
    if (ethMatches) {
      return ethMatches[0];
    }

    // Try context-based extraction
    const contextPatterns = [
      /(?:ca|contract|address|token)\s*[:=]\s*([A-Za-z0-9]{32,50})/i,
      /([A-Za-z0-9]{32,50})(?:\s+|$)(?:pump|sol|token)/i
    ];

    for (const pattern of contextPatterns) {
      const match = message.match(pattern);
      if (match && this.isValidSolanaAddress(match[1])) {
        return match[1];
      }
    }

    return null;
  }

  isValidSolanaAddress(address) {
    // Basic Solana address validation
    if (!address || address.length < 32 || address.length > 50) return false;
    
    // Check for obvious non-addresses
    const invalidPatterns = [
      /^(pump|moon|gem|safe|doge|shib|pepe)$/i,
      /^\d+$/,
      /^[a-z]+$/i
    ];
    
    return !invalidPatterns.some(pattern => pattern.test(address));
  }

  extractTradePercent(message, channelId) {
    const tradePatterns = [
      /(?:ape|buy|trade|use)\s*(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s*(?:ape|buy|trade)/i,
      /risk\s*(\d+(?:\.\d+)?)\s*%/i,
      /size\s*(\d+(?:\.\d+)?)\s*%/i
    ];

    for (const pattern of tradePatterns) {
      const match = message.match(pattern);
      if (match) {
        const percent = parseFloat(match[1]);
        if (percent > 0 && percent <= 100) {
          return percent;
        }
      }
    }

    // Channel-specific defaults
    if (channelId === '-1002209371269') return 5; // Underdog
    if (channelId === '-1002277274250') return 3; // Degen
    
    return null;
  }

  extractStopLoss(message) {
    for (const pattern of this.patterns.stopLoss) {
      const match = message.match(pattern);
      if (match) {
        const percent = parseFloat(match[1]);
        if (percent > 0 && percent <= 90) {
          return percent;
        }
      }
    }
    return null;
  }

  extractTakeProfits(message) {
    const targets = [];
    
    for (const pattern of this.patterns.takeProfit) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const percent = parseFloat(match[1]);
        if (percent > 0 && percent <= 1000) {
          targets.push(percent);
        }
      }
    }

    // Remove duplicates and sort
    return [...new Set(targets)].sort((a, b) => a - b);
  }

  analyzeKeywords(message) {
    let score = 0;
    const text = message.toLowerCase();

    // High confidence keywords
    this.patterns.tradingKeywords.high.forEach(keyword => {
      if (text.includes(keyword)) score += 0.3;
    });

    // Medium confidence keywords
    this.patterns.tradingKeywords.medium.forEach(keyword => {
      if (text.includes(keyword)) score += 0.2;
    });

    // Low confidence keywords
    this.patterns.tradingKeywords.low.forEach(keyword => {
      if (text.includes(keyword)) score += 0.1;
    });

    return Math.min(score, 1.0); // Cap at 1.0
  }

  analyzeSentiment(message) {
    const positiveWords = ['moon', 'pump', 'bullish', 'gem', 'rocket', '🚀', '🔥', '💎'];
    const negativeWords = ['dump', 'bearish', 'risky', 'caution', '⚠️', '❌'];
    
    const text = message.toLowerCase();
    let sentiment = 0;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) sentiment += 1;
    });
    
    negativeWords.forEach(word => {
      if (text.includes(word)) sentiment -= 1;
    });
    
    if (sentiment > 0) return 'bullish';
    if (sentiment < 0) return 'bearish';
    return 'neutral';
  }

  analyzeUrgency(message) {
    const urgentWords = ['now', 'quick', 'fast', 'asap', 'urgent', '!!!', 'hurry'];
    const text = message.toLowerCase();
    
    const urgencyCount = urgentWords.filter(word => text.includes(word)).length;
    
    if (urgencyCount >= 2) return 'high';
    if (urgencyCount === 1) return 'medium';
    return 'low';
  }

  analyzeRisk(message) {
    const highRiskWords = ['yolo', 'degen', 'gamble', 'risky', 'volatile'];
    const lowRiskWords = ['safe', 'stable', 'conservative', 'low risk'];
    
    const text = message.toLowerCase();
    
    const highRisk = highRiskWords.filter(word => text.includes(word)).length;
    const lowRisk = lowRiskWords.filter(word => text.includes(word)).length;
    
    if (highRisk > lowRisk) return 'high';
    if (lowRisk > highRisk) return 'low';
    return 'medium';
  }

  getChannelType(channelId) {
    const channelTypes = {
      '-1002209371269': 'underdog',
      '-1002277274250': 'degen'
    };
    return channelTypes[channelId] || 'generic';
  }

  adjustConfidenceForChannel(confidence, channelId, patterns) {
    // Premium channels get slight confidence boost
    if (channelId === '-1002209371269' || channelId === '-1002277274250') {
      confidence += 0.2;
    }

    // Pattern-based adjustments
    if (patterns.includes('contract_found') && patterns.includes('stop_loss')) {
      confidence += 0.3; // Complete signals get bonus
    }

    return Math.min(confidence, 3.0); // Cap at 3.0
  }

  updatePatternStats(patterns, channelId) {
    const key = `${channelId || 'unknown'}_${patterns.join('_')}`;
    
    if (!this.patternStats.successByPattern.has(key)) {
      this.patternStats.successByPattern.set(key, 0);
    }
  }

  /**
   * Validate signal with multiple checks
   */
  validateSignal(signal, channelId = null) {
    const validation = {
      isValid: true,
      warnings: [],
      suggestions: [],
      riskLevel: 'medium'
    };

    // Basic validation
    if (!signal.contractAddress) {
      validation.isValid = false;
      validation.warnings.push('No contract address found');
    }

    // Confidence check
    if (signal.confidence < 1) {
      validation.warnings.push('Low signal confidence');
      validation.suggestions.push('Consider waiting for clearer signals');
    }

    // Risk assessment
    if (signal.risk === 'high' && signal.urgency === 'high') {
      validation.riskLevel = 'high';
      validation.warnings.push('High risk + high urgency detected');
      validation.suggestions.push('Consider reducing position size');
    }

    return validation;
  }
}

// Advanced message filtering system
class MessageFilter {
  constructor() {
    this.filters = {
      spam: [
        /(.)\1{4,}/g, // Repeated characters
        /🚀{3,}/g,    // Too many rockets
        /‼️{2,}/g,    // Multiple exclamations
      ],
      
      scam: [
        /t\.me\/\w+/g,           // Telegram links
        /(?:dm|pm)\s+me/i,      // DM requests
        /send\s+\w+\s+to/i,     // Send X to Y scams
        /guaranteed\s+profit/i,  // Guaranteed profit claims
      ]
    };
  }

  isSpam(message) {
    return this.filters.spam.some(pattern => pattern.test(message));
  }

  isScam(message) {
    return this.filters.scam.some(pattern => pattern.test(message));
  }

  shouldIgnore(message) {
    return this.isSpam(message) || this.isScam(message);
  }
}

// Export both classes
module.exports = { 
  EnhancedSignalParser, 
  MessageFilter 
};