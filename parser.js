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
 */
function parseMemeCoinMessage(message, debug = false) {
  const result = {
    contractAddress: null,
    tradePercent: null,
    stopLossPercent: null,
    takeProfitTargets: [],
    manualTakeProfit: false,
    confidence: 0,
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
    console.log("📝 Parsed callout:", JSON.stringify(result, null, 2));
  }

  return result;
}

module.exports = { parseMemeCoinMessage };
