// banner.js - Enhanced banner display with channel-aware features

// Premium channel configurations for display
const CHANNEL_CONFIGS = {
  '-1002209371269': {
    name: 'Underdog Calls Private',
    icon: '🔥',
    shortName: 'UNDERDOG'
  },
  '-1002277274250': {
    name: 'Degen',
    icon: '💎', 
    shortName: 'DEGEN'
  }
};

/**
 * Main startup banner with enhanced channel information
 */
function displayBanner(config) {
  const channelStatus = getChannelStatus(config);
  const tradingMode = config.DRY_RUN === true || config.DRY_RUN === 'true' ? 'PAPER TRADING' : 'LIVE TRADING';
  const modeColor = config.DRY_RUN === true || config.DRY_RUN === 'true' ? '\x1b[33m' : '\x1b[32m'; // Yellow for paper, green for live
  
  return `
\x1b[90m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m
\x1b[90m┃\x1b[0m                                                                              \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m ██████╗██████╗ ███████╗███████╗████████╗██╗  ██╗ \x1b[0m                       \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝╚██╗██╔╝ \x1b[0m                       \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m██║     ██████╔╝█████╗  ███████╗   ██║    ╚███╔╝  \x1b[0m                       \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m██║     ██╔══██╗██╔══╝  ╚════██║   ██║    ██╔██╗  \x1b[0m                       \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m╚██████╗██║  ██║███████╗███████║   ██║   ██╔╝ ██╗ \x1b[0m                       \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ \x1b[0m                       \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                                              \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m┌────────────────────┐\x1b[0m                             \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[0m  \x1b[34m▲\x1b[0m    \x1b[34m▲\x1b[0m     \x1b[34m▲\x1b[0m  \x1b[1m\x1b[37m│\x1b[0m                             \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[0m \x1b[34m▲\x1b[90m█\x1b[34m▲\x1b[0m  \x1b[34m▲\x1b[90m█\x1b[34m▲\x1b[0m   \x1b[34m▲\x1b[90m█\x1b[34m▲\x1b[0m \x1b[1m\x1b[37m│\x1b[0m                             \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[90m████████████████\x1b[1m\x1b[37m│\x1b[0m                             \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[90m████████████████\x1b[1m\x1b[37m│\x1b[0m                             \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[90m████████████████\x1b[1m\x1b[37m│\x1b[0m                             \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m└────────────────────┘\x1b[0m                             \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                                              \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                     \x1b[1m\x1b[37m[ SOLANA MEMECOIN TRADING BOT ]\x1b[0m                         \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                                              \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                       ${modeColor}\x1b[1m[ ${tradingMode} MODE ]\x1b[0m                           \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                                              \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m${channelStatus}\x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                                              \x1b[90m┃\x1b[0m
\x1b[90m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m
`;
}

/**
 * Enhanced small banner with channel indicators
 */
function displaySmallBanner(config) {
  const tradingMode = config.DRY_RUN === true || config.DRY_RUN === 'true' ? 'PAPER TRADING' : 'LIVE TRADING';
  const modeColor = config.DRY_RUN === true || config.DRY_RUN === 'true' ? '\x1b[33m' : '\x1b[32m';
  const channelIcons = getActiveChannelIcons(config);
  
  return `
\x1b[90m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m
\x1b[90m┃\x1b[0m \x1b[1m\x1b[37m            CRESTX - SOLANA MEMECOIN TRADER               \x1b[0m\x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m ${modeColor}\x1b[1m                   [ ${tradingMode} ]                    \x1b[0m\x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m \x1b[37m                    ${channelIcons}                     \x1b[0m\x1b[90m┃\x1b[0m
\x1b[90m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m
`;
}

/**
 * Compact banner for frequent use
 */
function displayCompactBanner(config) {
  const tradingMode = config.DRY_RUN === true || config.DRY_RUN === 'true' ? 'DRY RUN' : 'LIVE';
  const modeColor = config.DRY_RUN === true || config.DRY_RUN === 'true' ? '\x1b[33m' : '\x1b[32m';
  const channelIcons = getActiveChannelIcons(config);
  
  return `\x1b[90m┌─ \x1b[1m\x1b[37mCRESTX\x1b[0m ${modeColor}[${tradingMode}]\x1b[0m ${channelIcons} \x1b[90m─┐\x1b[0m`;
}

/**
 * Statistics banner for performance display
 */
function displayStatsBanner(config, stats = null) {
  const tradingMode = config.DRY_RUN === true || config.DRY_RUN === 'true' ? 'PAPER' : 'LIVE';
  const modeColor = config.DRY_RUN === true || config.DRY_RUN === 'true' ? '\x1b[33m' : '\x1b[32m';
  
  let statsLine = '';
  if (stats) {
    const profit = stats.totalProfit || 0;
    const trades = stats.totalTrades || 0;
    const profitColor = profit >= 0 ? '\x1b[32m' : '\x1b[31m';
    const profitSign = profit >= 0 ? '+' : '';
    
    statsLine = `\x1b[90m┃\x1b[0m \x1b[37m              ${profitColor}P/L: ${profitSign}$${profit.toFixed(2)}\x1b[0m \x1b[37m| Trades: ${trades}\x1b[0m \x1b[37m| WR: ${stats.winRate || '0.0'}%\x1b[0m              \x1b[90m┃\x1b[0m\n`;
  }
  
  return `
\x1b[90m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m
\x1b[90m┃\x1b[0m \x1b[1m\x1b[37m               CRESTX TRADING STATISTICS                  \x1b[0m\x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m ${modeColor}\x1b[1m                      ${tradingMode} MODE                        \x1b[0m\x1b[90m┃\x1b[0m
${statsLine}\x1b[90m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m
`;
}

/**
 * Channel selection banner for setup
 */
function displayChannelBanner() {
  return `
\x1b[90m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m
\x1b[90m┃\x1b[0m \x1b[1m\x1b[37m                 PREMIUM TRADING CHANNELS                   \x1b[0m\x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                          \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[31m🔥 UNDERDOG CALLS PRIVATE\x1b[0m \x1b[90m- Premium memecoin signals   \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[35m💎 DEGEN CHANNEL\x1b[0m          \x1b[90m- High-risk, high-reward     \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                          \x1b[90m┃\x1b[0m
\x1b[90m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m
`;
}

/**
 * Error banner for displaying errors
 */
function displayErrorBanner(errorMessage) {
  return `
\x1b[90m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m
\x1b[90m┃\x1b[0m \x1b[1m\x1b[31m                       ⚠️  ERROR  ⚠️                        \x1b[0m\x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                          \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m \x1b[37m ${errorMessage.padEnd(54)}\x1b[0m \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                          \x1b[90m┃\x1b[0m
\x1b[90m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m
`;
}

/**
 * Success banner for displaying success messages
 */
function displaySuccessBanner(successMessage) {
  return `
\x1b[90m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m
\x1b[90m┃\x1b[0m \x1b[1m\x1b[32m                       ✅  SUCCESS  ✅                       \x1b[0m\x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                          \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m \x1b[37m ${successMessage.padEnd(54)}\x1b[0m \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                          \x1b[90m┃\x1b[0m
\x1b[90m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m
`;
}

/**
 * Get channel status display for main banner
 */
function getChannelStatus(config) {
  const channels = config.TELEGRAM_CHANNEL_IDS || [];
  let premiumChannels = [];
  let customChannels = 0;
  
  channels.forEach(channelId => {
    if (CHANNEL_CONFIGS[channelId]) {
      premiumChannels.push(CHANNEL_CONFIGS[channelId]);
    } else {
      customChannels++;
    }
  });
  
  if (premiumChannels.length === 0 && customChannels === 0) {
    return '                        \x1b[31m⚠️  NO CHANNELS CONFIGURED  ⚠️\x1b[0m                        ';
  }
  
  let statusLine = '';
  
  if (premiumChannels.length > 0) {
    const premiumDisplay = premiumChannels.map(ch => `${ch.icon} ${ch.shortName}`).join(' ');
    statusLine += `                          \x1b[32m✅ PREMIUM: ${premiumDisplay}\x1b[0m`;
    
    if (customChannels > 0) {
      statusLine += `\n\x1b[90m┃\x1b[0m                            \x1b[37m+ ${customChannels} Custom Channel${customChannels > 1 ? 's' : ''}\x1b[0m                            `;
    } else {
      statusLine += '                          ';
    }
  } else {
    statusLine = `                            \x1b[37m📱 ${customChannels} Custom Channel${customChannels > 1 ? 's' : ''}\x1b[0m                            `;
  }
  
  return statusLine;
}

/**
 * Get active channel icons for compact display
 */
function getActiveChannelIcons(config) {
  const channels = config.TELEGRAM_CHANNEL_IDS || [];
  let icons = [];
  let customCount = 0;
  
  channels.forEach(channelId => {
    if (CHANNEL_CONFIGS[channelId]) {
      icons.push(CHANNEL_CONFIGS[channelId].icon);
    } else {
      customCount++;
    }
  });
  
  let display = icons.join(' ');
  if (customCount > 0) {
    display += (display ? ' ' : '') + `📱×${customCount}`;
  }
  
  return display || '❌ No Channels';
}

/**
 * Get channel configuration for display
 */
function getChannelDisplayInfo(channelId) {
  return CHANNEL_CONFIGS[channelId] || {
    name: 'Custom Channel',
    icon: '📱',
    shortName: 'CUSTOM'
  };
}

/**
 * Generate a live status line for dynamic updates
 */
function generateStatusLine(config, stats = {}) {
  const time = new Date().toLocaleTimeString();
  const mode = config.DRY_RUN ? 'DRY' : 'LIVE';
  const modeColor = config.DRY_RUN ? '\x1b[33m' : '\x1b[32m';
  const balance = stats.balance || 0;
  const activeTrades = stats.activeTrades || 0;
  
  return `${modeColor}[${mode}]\x1b[0m 💰$${balance.toFixed(0)} 📊${activeTrades} trades 🕒${time}`;
}

/**
 * Create a progress bar for various operations
 */
function createProgressBar(percentage, width = 20) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const bar = '\x1b[32m' + '█'.repeat(filled) + '\x1b[90m' + '░'.repeat(empty) + '\x1b[0m';
  return `[${bar}] ${percentage.toFixed(1)}%`;
}

/**
 * Display loading animation
 */
function displayLoading(message = 'Loading') {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  return setInterval(() => {
    process.stdout.write(`\r\x1b[36m${frames[i]} ${message}...\x1b[0m`);
    i = (i + 1) % frames.length;
  }, 100);
}

module.exports = { 
  displayBanner, 
  displaySmallBanner,
  displayCompactBanner,
  displayStatsBanner,
  displayChannelBanner,
  displayErrorBanner,
  displaySuccessBanner,
  generateStatusLine,
  createProgressBar,
  displayLoading,
  getChannelDisplayInfo
};