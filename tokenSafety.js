// tokenSafety.js - Enhanced token safety checks with proper integration
const { Connection, PublicKey } = require('@solana/web3.js');
const config = require('./config');
const exchangeClient = require('./exchangeClient');

// Cache results to avoid repeated API calls
const safetyCache = new Map();

// Known scam patterns
const SCAM_PATTERNS = [
  /pump\.fun/i,  // Common pump and dump suffix
  /moon/i,       // Often used in scam tokens
  /elon/i,       // Impersonation tokens
  /safe/i,       // Ironically often unsafe
];

/**
 * Comprehensive token safety verification
 * @param {string} mintAddress Token mint address
 * @returns {Promise<Object>} Safety check results
 */
async function checkToken(mintAddress) {
  // Validate mint address format
  try {
    new PublicKey(mintAddress);
  } catch (err) {
    return {
      isSafe: false,
      warnings: ['Invalid mint address format'],
      name: null,
      liquidity: null,
      priceImpact: null
    };
  }

  // Check cache first (valid for 5 minutes)
  const now = Date.now();
  if (safetyCache.has(mintAddress)) {
    const cached = safetyCache.get(mintAddress);
    if (now - cached.timestamp < 300000) { // 5 minutes
      console.log(`📋 Using cached safety check for ${mintAddress}`);
      return cached.result;
    }
  }

  const warnings = [];
  let name = null;
  let liquidity = null;
  let priceImpact = null;
  let tokenAge = null;

  try {
    // 1) Blacklist check
    if (config.BLACKLISTED_TOKENS && config.BLACKLISTED_TOKENS.includes(mintAddress)) {
      warnings.push("Token is blacklisted");
    }

    // 2) Token age verification
    if (config.MIN_TOKEN_AGE_SECONDS) {
      try {
        tokenAge = await getTokenAge(mintAddress);
        if (tokenAge < config.MIN_TOKEN_AGE_SECONDS) {
          const minutes = Math.floor(tokenAge / 60);
          warnings.push(`Token is too new (${minutes} minutes old, minimum: ${Math.floor(config.MIN_TOKEN_AGE_SECONDS / 60)} minutes)`);
        }
      } catch (err) {
        console.error(`⚠️ Error checking token age: ${err.message}`);
        warnings.push("Could not verify token age");
      }
    }

    // 3) Exchange client safety check (liquidity, price impact, etc.)
    try {
      const safety = await exchangeClient.checkTokenSafety(mintAddress);
      
      if (!safety.safe) {
        warnings.push(safety.reason || "Failed exchange safety check");
      }
      
      // Store metadata
      name = safety.name;
      liquidity = safety.liquidity;
      priceImpact = safety.priceImpact;
      
      // 4) Price impact threshold
      if (priceImpact != null && priceImpact * 100 > config.MAX_PRICE_IMPACT) {
        warnings.push(
          `High price impact: ${(priceImpact * 100).toFixed(2)}% (max allowed: ${config.MAX_PRICE_IMPACT}%)`
        );
      }
      
      // 5) Liquidity threshold
      if (config.MIN_LIQUIDITY_USD && liquidity != null) {
        if (liquidity < config.MIN_LIQUIDITY_USD) {
          warnings.push(
            `Low liquidity: $${liquidity.toFixed(0)} (minimum: $${config.MIN_LIQUIDITY_USD})`
          );
        }
      }
    } catch (err) {
      console.error(`⚠️ Exchange safety check error: ${err.message}`);
      warnings.push(`Exchange safety check failed: ${err.message}`);
    }

    // 6) Name pattern check (if we have a name)
    if (name) {
      for (const pattern of SCAM_PATTERNS) {
        if (pattern.test(name)) {
          warnings.push(`Token name contains suspicious pattern: ${pattern.source}`);
          break;
        }
      }
    }

    // 7) Additional on-chain verification
    try {
      const connection = new Connection(config.RPC_ENDPOINT);
      const mintPubkey = new PublicKey(mintAddress);
      const accountInfo = await connection.getAccountInfo(mintPubkey);
      
      if (!accountInfo) {
        warnings.push("Token mint account not found on-chain");
      } else if (!accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        warnings.push("Invalid token program owner");
      }
    } catch (err) {
      console.error(`⚠️ On-chain verification error: ${err.message}`);
      warnings.push("Could not verify token on-chain");
    }

    // Final safety determination
    const result = {
      isSafe: warnings.length === 0,
      warnings,
      name,
      liquidity,
      priceImpact,
      tokenAge: tokenAge ? Math.floor(tokenAge / 60) : null, // in minutes
      checkedAt: new Date().toISOString()
    };

    // Cache the result
    safetyCache.set(mintAddress, {
      timestamp: now,
      result
    });

    // Log safety check result
    if (result.isSafe) {
      console.log(`✅ Token ${mintAddress} passed all safety checks`);
    } else {
      console.log(`⚠️ Token ${mintAddress} has ${warnings.length} safety warnings`);
    }

    return result;
  } catch (err) {
    console.error(`❌ Token safety check critical error: ${err.message}`);
    return {
      isSafe: false,
      warnings: [`Safety check critical error: ${err.message}`],
      name,
      liquidity,
      priceImpact,
      tokenAge
    };
  }
}

/**
 * Determine token age by finding the first transaction
 * @param {string} mintAddress Token mint address
 * @returns {Promise<number>} Age in seconds
 */
async function getTokenAge(mintAddress) {
  try {
    const connection = new Connection(config.RPC_ENDPOINT, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000
    });
    
    const tokenKey = new PublicKey(mintAddress);
    
    // Get signatures with limit to find oldest
    let oldestSignature = null;
    let oldestTime = null;
    let before = null;
    
    // Search in batches to find the oldest transaction
    for (let i = 0; i < 5; i++) { // Max 5 iterations to prevent infinite loop
      const options = { limit: 1000 };
      if (before) options.before = before;
      
      const signatures = await connection.getSignaturesForAddress(
        tokenKey,
        options,
        'confirmed'
      );
      
      if (signatures.length === 0) break;
      
      // Check each signature's timestamp
      for (const sig of signatures) {
        if (sig.blockTime && (!oldestTime || sig.blockTime < oldestTime)) {
          oldestTime = sig.blockTime;
          oldestSignature = sig.signature;
        }
      }
      
      // If we got less than limit, we've reached the end
      if (signatures.length < 1000) break;
      
      // Set before to the last signature for next iteration
      before = signatures[signatures.length - 1].signature;
    }
    
    if (!oldestTime) {
      console.warn(`Could not determine age for token ${mintAddress}`);
      return 0;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const age = now - oldestTime;
    
    console.log(`Token ${mintAddress} is ${Math.floor(age / 60)} minutes old`);
    return age; // Age in seconds
  } catch (err) {
    console.error(`Error getting token age: ${err.message}`);
    throw err;
  }
}

/**
 * Clear expired cache entries
 */
function clearExpiredCache() {
  const now = Date.now();
  let cleared = 0;
  
  for (const [key, value] of safetyCache.entries()) {
    if (now - value.timestamp > 600000) { // 10 minutes
      safetyCache.delete(key);
      cleared++;
    }
  }
  
  if (cleared > 0) {
    console.log(`🗑️ Cleared ${cleared} expired safety cache entries`);
  }
}

// Clear cache periodically
setInterval(clearExpiredCache, 60000); // Check every minute

/**
 * Get safety statistics
 */
function getSafetyStats() {
  let totalChecks = 0;
  let safeTokens = 0;
  let recentWarnings = [];
  
  for (const [mintAddress, cached] of safetyCache.entries()) {
    totalChecks++;
    if (cached.result.isSafe) safeTokens++;
    
    if (cached.result.warnings.length > 0) {
      recentWarnings.push({
        token: mintAddress,
        warnings: cached.result.warnings,
        timestamp: cached.timestamp
      });
    }
  }
  
  return {
    totalChecks,
    safeTokens,
    unsafeTokens: totalChecks - safeTokens,
    safetyRate: totalChecks > 0 ? ((safeTokens / totalChecks) * 100).toFixed(1) : 0,
    recentWarnings: recentWarnings.slice(-5), // Last 5 warnings
    cacheSize: safetyCache.size
  };
}

/**
 * Manually blacklist a token
 */
function blacklistToken(mintAddress) {
  if (!config.BLACKLISTED_TOKENS) {
    config.BLACKLISTED_TOKENS = [];
  }
  
  if (!config.BLACKLISTED_TOKENS.includes(mintAddress)) {
    config.BLACKLISTED_TOKENS.push(mintAddress);
    
    // Clear from cache
    safetyCache.delete(mintAddress);
    
    console.log(`🚫 Token ${mintAddress} has been blacklisted`);
    return true;
  }
  
  return false;
}

// Export token program ID for validation
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');

module.exports = { 
  checkToken,
  getSafetyStats,
  blacklistToken,
  clearExpiredCache
};