// validation-helpers.js - Input validation functions for setup

/**
 * Validate trade amount input
 * @param {string} input - User input
 * @returns {Object} - {isValid: boolean, value: number|null, error: string|null}
 */
function validateTradeAmount(input) {
  // Check if input is empty or whitespace
  if (!input || !input.trim()) {
    return {
      isValid: false,
      value: null,
      error: 'Trade amount cannot be empty! Please enter a dollar amount.'
    };
  }

  // Remove dollar sign and whitespace if present
  let cleanInput = input.trim().replace(/^\$/, '');

  // Try to parse as number
  const amount = parseFloat(cleanInput);

  // Check if it's a valid number
  if (isNaN(amount)) {
    return {
      isValid: false,
      value: null,
      error: 'Invalid input! Please enter a valid number (e.g., 0.50, 20, $100).'
    };
  }

  // Check minimum value
  if (amount <= 0) {
    return {
      isValid: false,
      value: null,
      error: 'Amount must be greater than $0! Enter a positive dollar amount.'
    };
  }

  // FIXED: Changed minimum from $1 to $0.01 (1 cent)
  if (amount < 0.01) {
    return {
      isValid: false,
      value: null,
      error: 'Minimum trade amount is $0.01! Use at least 1 cent per trade.'
    };
  }

  // Check maximum for safety
  if (amount > 10000) {
    return {
      isValid: false,
      value: null,
      error: 'Maximum trade amount is $10,000! For safety, please use a smaller amount.'
    };
  }

  // Warn about very small amounts (changed threshold from $1 to $0.10)
  if (amount < 0.10) {
    return {
      isValid: true,
      value: amount,
      warning: `$${amount} is very small. Great for testing! Consider $1+ for real trading.`
    };
  }

  // Warn about small amounts (for amounts $0.10 to $5)
  if (amount < 5) {
    return {
      isValid: true,
      value: amount,
      warning: `$${amount} is perfect for testing. Consider $10-20+ for more realistic trading results.`
    };
  }

  // Warn about large amounts
  if (amount > 1000) {
    return {
      isValid: true,
      value: amount,
      warning: `$${amount} is a large amount. Make sure you can afford to lose this per trade.`
    };
  }

  // Valid amount
  return {
    isValid: true,
    value: amount,
    error: null
  };
}

/**
 * Validate API ID input
 * @param {string} input - User input
 * @returns {Object} - {isValid: boolean, value: string|null, error: string|null}
 */
function validateApiId(input) {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      value: null,
      error: 'API ID is required! Get it from https://my.telegram.org/apps'
    };
  }

  const apiId = input.trim();

  // Check if it's numeric
  if (!/^\d+$/.test(apiId)) {
    return {
      isValid: false,
      value: null,
      error: 'API ID should be a number (e.g., 12345678).'
    };
  }

  // Check reasonable length (Telegram API IDs are typically 7-8 digits)
  if (apiId.length < 6 || apiId.length > 10) {
    return {
      isValid: false,
      value: null,
      error: 'API ID should be 6-10 digits long. Please check your API ID.'
    };
  }

  return {
    isValid: true,
    value: apiId,
    error: null
  };
}

/**
 * Validate API Hash input
 * @param {string} input - User input
 * @returns {Object} - {isValid: boolean, value: string|null, error: string|null}
 */
function validateApiHash(input) {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      value: null,
      error: 'API Hash is required! Get it from https://my.telegram.org/apps'
    };
  }

  const apiHash = input.trim();

  // Check reasonable length (Telegram API Hashes are typically 32 characters)
  if (apiHash.length < 30 || apiHash.length > 35) {
    return {
      isValid: false,
      value: null,
      error: 'API Hash should be about 32 characters long. Please check your API Hash.'
    };
  }

  // Check if it contains only valid characters (alphanumeric)
  if (!/^[a-fA-F0-9]+$/.test(apiHash)) {
    return {
      isValid: false,
      value: null,
      error: 'API Hash should contain only letters (a-f) and numbers (0-9).'
    };
  }

  return {
    isValid: true,
    value: apiHash,
    error: null
  };
}

/**
 * Validate wallet private key
 * @param {string} input - User input
 * @returns {Object} - {isValid: boolean, value: string|null, error: string|null}
 */
function validatePrivateKey(input) {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      value: null,
      error: 'Private key is required for live trading!'
    };
  }

  const privateKey = input.trim();

  // Check minimum length (should be 64+ characters for hex or base58)
  if (privateKey.length < 64) {
    return {
      isValid: false,
      value: null,
      error: 'Private key is too short. Should be 64+ characters (hex format).'
    };
  }

  // Check if it looks like hex (most common format)
  if (/^[a-fA-F0-9]+$/.test(privateKey)) {
    if (privateKey.length === 64 || privateKey.length === 128) {
      return {
        isValid: true,
        value: privateKey,
        error: null
      };
    } else {
      return {
        isValid: false,
        value: null,
        error: 'Hex private key should be 64 or 128 characters long.'
      };
    }
  }

  // Check if it could be base58 (Solana format)
  if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(privateKey) && privateKey.length >= 80) {
    return {
      isValid: true,
      value: privateKey,
      error: null
    };
  }

  // Check if it could be array format
  if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
    try {
      const parsed = JSON.parse(privateKey);
      if (Array.isArray(parsed) && parsed.length === 64) {
        return {
          isValid: true,
          value: privateKey,
          error: null
        };
      }
    } catch (e) {
      // Invalid JSON
    }
    return {
      isValid: false,
      value: null,
      error: 'Array format private key should be valid JSON with 64 numbers.'
    };
  }

  return {
    isValid: false,
    value: null,
    error: 'Invalid private key format. Use hex (64 chars), base58, or array format.'
  };
}

/**
 * Ask for input with validation and retry logic
 * @param {Function} askFunction - Function to ask the question
 * @param {Function} validateFunction - Function to validate the input
 * @param {string} question - Question to ask
 * @param {Object} options - Options {maxAttempts: number, defaultValue: string}
 */
async function askWithValidation(askFunction, validateFunction, question, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const defaultValue = options.defaultValue;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    
    const input = await askFunction(question);
    
    // If they press enter and there's a default, use it
    if (!input.trim() && defaultValue) {
      const validation = validateFunction(defaultValue);
      if (validation.isValid) {
        console.log('✅ Using default value');
        return validation.value;
      }
    }
    
    const validation = validateFunction(input);
    
    if (validation.isValid) {
      if (validation.warning) {
        console.log(`⚠️ Warning: ${validation.warning}`);
        const confirm = await askFunction('Continue with this value? (y/n): ');
        if (!confirm.toLowerCase().startsWith('y')) {
          continue;
        }
      }
      return validation.value;
    } else {
      console.log(`❌ ${validation.error}`);
      if (attempts < maxAttempts) {
        console.log(`💡 Please try again (attempt ${attempts}/${maxAttempts}):`);
      }
    }
  }

  throw new Error(`Failed to get valid input after ${maxAttempts} attempts`);
}

/**
 * Display helpful examples for common validation errors
 */
function displayValidationHelp(type) {
  switch (type) {
    case 'trade_amount':
      console.log('\n💡 Trade Amount Examples:');
      console.log('   ✅ 0.01   (minimum - 1 cent)');
      console.log('   ✅ 0.50   (50 cents - great for testing)');
      console.log('   ✅ $1     (good for small tests)');
      console.log('   ✅ 5      (good for testing)');
      console.log('   ✅ 20     (recommended for beginners)');
      console.log('   ✅ $50    (moderate risk)');
      console.log('   ✅ 100    (higher risk)');
      console.log('   ❌ 0      (must be greater than 0)');
      console.log('   ❌ abc    (not a number)');
      break;
      
    case 'api_credentials':
      console.log('\n💡 How to get Telegram API credentials:');
      console.log('   1. Go to https://my.telegram.org/apps');
      console.log('   2. Log in with your phone number');
      console.log('   3. Click "Create Application"');
      console.log('   4. Fill in app name (e.g., "My Trading Bot")');
      console.log('   5. Copy API ID (numbers) and API Hash (letters/numbers)');
      break;
      
    case 'private_key':
      console.log('\n💡 Private Key Formats:');
      console.log('   ✅ Hex: 1a2b3c4d... (64 characters)');
      console.log('   ✅ Base58: 5Kj... (80+ characters)');
      console.log('   ✅ Array: [123,45,67...] (64 numbers)');
      console.log('   ⚠️  Export from Phantom/Solflare wallet settings');
      break;
  }
}

module.exports = {
  validateTradeAmount,
  validateApiId,
  validateApiHash,
  validatePrivateKey,
  askWithValidation,
  displayValidationHelp
};