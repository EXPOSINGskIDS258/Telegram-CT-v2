/**
 * Enhanced parser.js with channel-specific optimizations
 * Parses trading signals from known channel formats and general memecoin callouts
 */

// Known premium channel IDs
const PREMIUM_CHANNELS = {
  UNDERDOG: '-1002209371269',  // Underdog Calls Private
  DEGEN: '-1002277274250'      // Degen
};

/**
 * Parses a meme-coin callout message and extracts:
 *  - contractAddress (Solana/ETH/etc.)
 *  - tradePercent (how much of the account to ape)
 *  - stopLossPercent
 *  - takeProfitTargets (array of explicit TP% targets)
 *  - manualTakeProfit (fallback flag)
 *  - confidence (0–3 score)
 *
 * @param {string} message  The raw Telegram callout text
 * @param {boolean} debug   If true, logs parsed result
 * @param {string} channelId Optional channel ID for channel-specific parsing
 */
function parseMemeCoinMessage(message, debug = false, channelId = null) {
  // Check if we have a known premium channel format
  if (channelId && Object.values(PREMIUM_CHANNELS).includes(channelId)) {
    if (channelId === PREMIUM_CHANNELS.UNDERDOG) {
      return parseUnderdogMessage(message, debug);
    } else if (channelId === PREMIUM_CHANNELS.DEGEN) {
      return parseDegenMessage(message, debug);
    }
  }

  // Fall back to generic parsing for unknown channels
  return parseGenericMessage(message, debug);
}

/**
 * Parse messages from Underdog Calls Private channel
 * @param {string} message The message text
 * @param {boolean} debug If true, logs parsed result
 */
function parseUnderdogMessage(message, debug = false) {
  const result = {
    contractAddress: null,
    tradePercent: 5, // Default to 5% for Underdog calls
    stopLossPercent: null,
    takeProfitTargets: [],
    manualTakeProfit: false,
    confidence: 0,
    channelType: 'underdog'
  };

  // Underdog format typically has contract address after "CA:" or "Contract:"
  const caPatterns = [
    /(?:CA|Contract)(?:\s*)?(?::|\s)(?:\s*)([A-Za-z0-9_]{32,50})/i,
    /([A-Za-z0-9_]{32,50})(?:\s+|$)/,  // Sometimes just the address
    /Address(?:\s*)?(?::|\s)(?:\s*)([A-Za-z0-9_]{32,50})/i
  ];

  for (const pattern of caPatterns) {
    const match = message.match(pattern);
    if (match) {
      result.contractAddress = match[1];
      break;
    }
  }

  // Underdog-specific trade percentage patterns
  const apeMatch = message.match(/(?:Ape|APING|APE IN|Buy|Entry)\s*([\d.]+)%/i);
  if (apeMatch) {
    result.tradePercent = parseFloat(apeMatch[1]);
  }

  // Underdog-specific stop loss format
  const slPatterns = [
    /(?:SL|Stop Loss|Stoploss)(?:\s*)?(?::|\s)(?:\s*)-?(\d+(?:\.\d+)?)/i,
    /Stop(?:\s+)at(?:\s+)(\d+(?:\.\d+)?)/i
  ];

  for (const pattern of slPatterns) {
    const match = message.match(pattern);
    if (match) {
      result.stopLossPercent = parseFloat(match[1]);
      break;
    }
  }

  // Underdog-specific take profit targets
  const tpMatches = message.match(/TP\d*(?:\s*)?(?::|\s)(?:\s*)(\d+(?:\.\d+)?)/gi);
  if (tpMatches) {
    result.takeProfitTargets = tpMatches.map(tp => {
      const num = tp.match(/(\d+(?:\.\d+)?)/)[1];
      return parseFloat(num);
    });
  }

  // Check for "take profits along the way" instruction
  if (/take profits along the way|take profits on the way up/i.test(message) && result.takeProfitTargets.length === 0) {
    result.manualTakeProfit = true;
    // Add reasonable take-profit levels for Underdog calls
    result.takeProfitTargets = [25, 50, 100];
  }

  // Calculate confidence score
  result.confidence =
    (result.contractAddress ? 1 : 0) +
    (result.tradePercent ? 1 : 0) +
    (result.stopLossPercent ? 1 : 0);

  if (debug) {
    console.log("📝 Parsed Underdog callout:", JSON.stringify(result, null, 2));
  }

  return result;
}

/**
 * Parse messages from Degen channel
 * @param {string} message The message text
 * @param {boolean} debug If true, logs parsed result
 */
function parseDegenMessage(message, debug = false) {
  const result = {
    contractAddress: null,
    tradePercent: 3, // More conservative default for Degen channel
    stopLossPercent: null,
    takeProfitTargets: [],
    manualTakeProfit: false,
    confidence: 0,
    channelType: 'degen'
  };

  // Degen format often uses $SYMBOL format and then CA separately
  const caPatterns = [
    /CA\s*[-:=]?\s*([A-Za-z0-9_]{32,50})/i,
    /ADDRESS\s*[-:=]?\s*([A-Za-z0-9_]{32,50})/i,
    /Contract\s*[-:=]?\s*([A-Za-z0-9_]{32,50})/i,
    /([A-Za-z0-9_]{32,50})(?=\s|$)/  // Standalone address
  ];

  for (const pattern of caPatterns) {
    const match = message.match(pattern);
    if (match) {
      result.contractAddress = match[1];
      break;
    }
  }

  // Degen-specific entry patterns
  const entryPatterns = [
    /(?:Ape|APING|APE IN|Buy|Entry)\s*([\d.]+)%/i,
    /ENTRY\s*[-:=]?\s*(\d+(?:\.\d+)?)/i
  ];

  for (const pattern of entryPatterns) {
    const match = message.match(pattern);
    if (match) {
      result.tradePercent = parseFloat(match[1]);
      break;
    }
  }

  // Stop loss percentage
  const slPatterns = [
    /SL\s*[-:=]?\s*(\d+(?:\.\d+)?)/i,
    /Stop\s*Loss\s*[-:=]?\s*(\d+(?:\.\d+)?)/i
  ];

  for (const pattern of slPatterns) {
    const match = message.match(pattern);
    if (match) {
      result.stopLossPercent = parseFloat(match[1]);
      break;
    }
  }

  // Multiple TPs often labeled as TP1, TP2, etc.
  const tpMatches = message.match(/TP\d*\s*[-:=]?\s*(\d+(?:\.\d+)?)/gi);
  if (tpMatches) {
    result.takeProfitTargets = tpMatches.map(tp => {
      const num = tp.match(/(\d+(?:\.\d+)?)/)[1];
      return parseFloat(num);
    });
  }

  // Calculate confidence score
  result.confidence =
    (result.contractAddress ? 1 : 0) +
    (result.tradePercent ? 1 : 0) +
    (result.stopLossPercent ? 1 : 0);

  if (debug) {
    console.log("📝 Parsed Degen callout:", JSON.stringify(result, null, 2));
  }

  return result;
}

/**
 * Generic parsing for unknown channel formats (your original logic)
 * @param {string} message The message text
 * @param {boolean} debug If true, logs parsed result
 */
function parseGenericMessage(message, debug = false) {
  const result = {
    contractAddress: null,
    tradePercent: null,
    stopLossPercent: null,
    takeProfitTargets: [],
    manualTakeProfit: false,
    confidence: 0,
    channelType: 'generic'
  };

  // 1. Flexible contract address matching (Solana, ETH, generic)
  const caMatch = message.match(/\b(0x[a-fA-F0-9]{40}|[A-Za-z0-9_]{30,50})(?=pump|sol|erc|coin)\b/i);
  if (caMatch) {
    result.contractAddress = caMatch[1];
  }

  // 2. More variations of 'ape' terminology
  const tradeMatch = message.match(/(?:Ape|APING|APE IN|Buy)\s*([\d.]+)%/i);
  if (tradeMatch) {
    result.tradePercent = parseFloat(tradeMatch[1]);
  }

  // 3. More variations of stop loss
  const slMatch = message.match(/(?:SL|Stop Loss|Stop|Stoploss)\s*(?:at|@|:)?\s*-?([\d.]+)%/i);
  if (slMatch) {
    result.stopLossPercent = parseFloat(slMatch[1]);
  }

  // 4. Extract explicit take profit targets (TP1, TP2, TP, etc.)
  const tpMatches = message.match(/TP\d*\s*(?:at|@|:)?\s*([\d.]+)%/gi);
  if (tpMatches) {
    result.takeProfitTargets = tpMatches.map(tp => {
      const num = tp.match(/([\d.]+)%/)[1];
      return parseFloat(num);
    });
  }

  // 5. Fallback: generic "take profits" instruction
  if (/take profits on the way up/i.test(message) && result.takeProfitTargets.length === 0) {
    result.manualTakeProfit = true;
  }

  // 6. Basic validation warnings
  if (result.tradePercent !== null &&
      (result.tradePercent < 0.1 || result.tradePercent > 50)) {
    console.warn(`⚠️ Unusual trade percentage: ${result.tradePercent}%`);
  }
  if (result.stopLossPercent !== null &&
      (result.stopLossPercent < 5 || result.stopLossPercent > 90)) {
    console.warn(`⚠️ Unusual stop-loss percentage: ${result.stopLossPercent}%`);
  }

  // 7. Confidence score (0–3)
  result.confidence =
    (result.contractAddress ? 1 : 0) +
    (result.tradePercent      ? 1 : 0) +
    (result.stopLossPercent   ? 1 : 0);

  // 8. Debug logging
  if (debug) {
    console.log("📝 Parsed generic callout:", JSON.stringify(result, null, 2));
  }

  return result;
}

/**
 * Enhanced message validation with channel-specific rules
 * @param {Object} parsedSignal The parsed signal object
 * @param {string} channelId The channel ID
 * @returns {Object} Validation result with suggestions
 */
function validateParsedSignal(parsedSignal, channelId = null) {
  const validation = {
    isValid: true,
    warnings: [],
    suggestions: []
  };

  // Basic validation
  if (!parsedSignal.contractAddress) {
    validation.isValid = false;
    validation.warnings.push('No contract address found');
  }

  if (!parsedSignal.stopLossPercent) {
    validation.warnings.push('No stop loss specified - using default');
    if (channelId === PREMIUM_CHANNELS.UNDERDOG) {
      validation.suggestions.push('Underdog calls typically use 15-20% stop loss');
    } else if (channelId === PREMIUM_CHANNELS.DEGEN) {
      validation.suggestions.push('Degen calls typically use 20-25% stop loss');
    }
  }

  if (!parsedSignal.tradePercent) {
    validation.warnings.push('No trade percentage specified - using default');
  }

  // Channel-specific validation
  if (channelId === PREMIUM_CHANNELS.UNDERDOG) {
    if (parsedSignal.tradePercent && parsedSignal.tradePercent > 10) {
      validation.warnings.push('High trade percentage for Underdog call');
    }
  } else if (channelId === PREMIUM_CHANNELS.DEGEN) {
    if (parsedSignal.tradePercent && parsedSignal.tradePercent > 5) {
      validation.warnings.push('High trade percentage for Degen call');
    }
  }

  return validation;
}

module.exports = { 
  parseMemeCoinMessage,
  validateParsedSignal,
  PREMIUM_CHANNELS
};