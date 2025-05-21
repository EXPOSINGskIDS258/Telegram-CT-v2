// src/tokenSafety.js
// Enhanced token safety checks with caching and age verification
const { Connection, PublicKey } = require('@solana/web3.js');
const config = require('./config');
const exchangeClient = require('./exchangeClient');

// Cache results to avoid repeated API calls
const safetyCache = new Map();

/**
 * Comprehensive token safety verification
 * @param {string} mintAddress Token mint address
 * @returns {Promise<Object>} Safety check results
 */
async function checkToken(mintAddress) {
  // Check cache first (valid for 5 minutes)
  const now = Date.now();
  if (safetyCache.has(mintAddress)) {
    const cached = safetyCache.get(mintAddress);
    if (now - cached.timestamp < 300000) { // 5 minutes
      return cached.result;
    }
  }

  const warnings = [];
  let name = null;
  let liquidity = null;
  let priceImpact = null;

  try {
    // 1) Blacklist check
    if (config.BLACKLISTED_TOKENS.includes(mintAddress)) {
      warnings.push("Token is blacklisted");
    }

    // 2) Token age verification
    if (config.MIN_TOKEN_AGE_SECONDS) {
      try {
        const tokenAge = await getTokenAge(mintAddress);
        if (tokenAge < config.MIN_TOKEN_AGE_SECONDS) {
          const minutes = Math.floor(tokenAge / 60);
          warnings.push(`Token is too new (${minutes} minutes old)`);
        }
      } catch (err) {
        console.error(`Error checking token age: ${err.message}`);
      }
    }

    // 3) On-chain liquidity and metadata from exchangeClient
    try {
      const safety = await exchangeClient.checkTokenSafety(mintAddress);
      
      if (!safety.safe) {
        warnings.push(safety.reason || "No liquidity or metadata");
      }
      
      // Store metadata if available
      name = safety.name;
      liquidity = safety.liquidity;
      priceImpact = safety.priceImpact;
      
      // 4) Price impact threshold
      if (priceImpact != null && priceImpact * 100 > config.MAX_PRICE_IMPACT) {
        warnings.push(
          `High price impact: ${(priceImpact * 100).toFixed(2)}% > ${config.MAX_PRICE_IMPACT}%`
        );
      }
      
      // 5) Liquidity threshold
      if (config.MIN_LIQUIDITY_USD && liquidity != null) {
        if (liquidity < config.MIN_LIQUIDITY_USD) {
          warnings.push(
            `Low liquidity: $${liquidity.toFixed(2)} < $${config.MIN_LIQUIDITY_USD}`
          );
        }
      }
    } catch (err) {
      warnings.push(`Exchange safety check error: ${err.message}`);
    }

    // Final safety determination
    const result = {
      isSafe: warnings.length === 0,
      warnings,
      name,
      liquidity,
      priceImpact,
    };

    // Cache the result
    safetyCache.set(mintAddress, {
      timestamp: now,
      result
    });

    return result;
  } catch (err) {
    console.error(`Token safety check error: ${err.message}`);
    return {
      isSafe: false,
      warnings: [`Safety check error: ${err.message}`],
      name,
      liquidity,
      priceImpact
    };
  }
}

/**
 * Determine token age by finding the oldest transaction
 * @param {string} mintAddress Token mint address
 * @returns {Promise<number>} Age in seconds
 */
async function getTokenAge(mintAddress) {
  try {
    const connection = new Connection(config.RPC_ENDPOINT);
    const tokenKey = new PublicKey(mintAddress);
    
    // Get the most recent signature (limit to 1)
    const signatures = await connection.getSignaturesForAddress(
      tokenKey,
      { limit: 1 },
      'finalized'
    );
    
    if (signatures.length === 0) {
      return 0; // No transactions found
    }
    
    // Get all signatures (up to 1000) to find the oldest one
    const allSignatures = await connection.getSignaturesForAddress(
      tokenKey,
      { until: signatures[0].signature },
      'finalized'
    );
    
    if (allSignatures.length === 0) {
      return 0;
    }
    
    // Get the oldest signature's block time
    const oldestTx = allSignatures[allSignatures.length - 1];
    const txTime = oldestTx.blockTime || 0;
    const now = Math.floor(Date.now() / 1000);
    
    return now - txTime; // Age in seconds
  } catch (err) {
    console.error(`Error getting token age: ${err.message}`);
    throw err;
  }
}

// Clear cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of safetyCache.entries()) {
    if (now - value.timestamp > 600000) { // 10 minutes
      safetyCache.delete(key);
    }
  }
}, 60000); // Check every minute

module.exports = { checkToken };