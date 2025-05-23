#!/usr/bin/env node
// startup.js - Simple startup script that handles different scenarios

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function displayWelcome() {
  console.clear();
  log(`
${colors.bright}${colors.cyan}   ██████╗██████╗ ███████╗███████╗████████╗██╗  ██╗
  ██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝╚██╗██╔╝
  ██║     ██████╔╝█████╗  ███████╗   ██║    ╚███╔╝ 
  ██║     ██╔══██╗██╔══╝  ╚════██║   ██║    ██╔██╗ 
  ╚██████╗██║  ██║███████╗███████║   ██║   ██╔╝ ██╗
   ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝${colors.reset}

  ${colors.bright}Welcome to CrestX - Solana Memecoin Trading Bot${colors.reset}
`);
}

async function checkPrerequisites() {
  const issues = [];
  
  // Check Node.js version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.split('.')[0].substring(1));
  if (major < 18) {
    issues.push(`Node.js 18+ required (found ${nodeVersion})`);
  } else {
    log(`${colors.green}✓${colors.reset} Node.js ${nodeVersion}`, colors.green);
  }
  
  // Check if dependencies are installed
  if (!fs.existsSync('node_modules')) {
    issues.push('Dependencies not installed. Run: npm install');
  } else {
    log(`${colors.green}✓${colors.reset} Dependencies installed`, colors.green);
  }
  
  return issues;
}

function getStartupOption() {
  const configExists = fs.existsSync('.env');
  
  if (!configExists) {
    return 'setup';
  }
  
  // Check if config seems valid
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const hasApiId = envContent.includes('API_ID=') && !envContent.includes('API_ID=');
    const hasApiHash = envContent.includes('API_HASH=') && !envContent.includes('API_HASH=');
    
    if (!hasApiId || !hasApiHash) {
      return 'setup';
    }
    
    return 'start';
  } catch (err) {
    return 'setup';
  }
}

async function runSetup() {
  log('\n🔧 Starting interactive setup...', colors.yellow);
  
  try {
    const { InteractiveSetup } = require('./setup');
    const setup = new InteractiveSetup();
    await setup.start();
    return true;
  } catch (err) {
    log(`\n❌ Setup failed: ${err.message}`, colors.red);
    
    // Fallback to quickstart
    log('\n🔄 Trying quickstart wizard...', colors.yellow);
    try {
      const { main } = require('./quickstart');
      await main();
      return true;
    } catch (quickErr) {
      log(`\n❌ Quickstart also failed: ${quickErr.message}`, colors.red);
      return false;
    }
  }
}

async function startBot() {
  log('\n🚀 Starting CrestX trading bot...', colors.green);
  
  try {
    // Load the main bot
    require('./index');
    return true;
  } catch (err) {
    log(`\n❌ Failed to start bot: ${err.message}`, colors.red);
    log('\nTroubleshooting:', colors.yellow);
    log('1. Check your .env configuration');
    log('2. Verify Telegram API credentials');
    log('3. Ensure all dependencies are installed');
    log('4. Try running setup again');
    return false;
  }
}

async function main() {
  displayWelcome();
  
  // Check prerequisites
  log('Checking prerequisites...', colors.cyan);
  const issues = await checkPrerequisites();
  
  if (issues.length > 0) {
    log('\n❌ Prerequisites check failed:', colors.red);
    issues.forEach(issue => log(`   - ${issue}`, colors.red));
    process.exit(1);
  }
  
  // Determine what to do
  const action = getStartupOption();
  
  if (action === 'setup') {
    log('\n📋 Configuration needed...', colors.yellow);
    const setupSuccess = await runSetup();
    
    if (!setupSuccess) {
      log('\n❌ Setup failed. Please check the errors above and try again.', colors.red);
      process.exit(1);
    }
    
    // After successful setup, start the bot
    log('\n⏳ Configuration complete. Starting bot...', colors.green);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause
  }
  
  const botStarted = await startBot();
  
  if (!botStarted) {
    process.exit(1);
  }
}

// Handle different ways this script might be called
if (require.main === module) {
  main().catch(err => {
    log(`\n❌ Startup failed: ${err.message}`, colors.red);
    process.exit(1);
  });
}

module.exports = { main };