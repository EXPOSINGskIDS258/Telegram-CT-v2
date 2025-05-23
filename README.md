# 🚀 CrestX - Professional Solana Memecoin Trading Bot

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue.svg" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License" />
  <img src="https://img.shields.io/badge/Version-1.1.0-red.svg" alt="Version" />
</div>

CrestX is an advanced automated trading bot designed specifically for Solana memecoins. It monitors Telegram signals from expert traders and executes trades automatically through Jupiter DEX - the leading aggregator for Solana.

## ✨ Key Features

### 🔥 **Automated Trading**
- **Real-time Signal Processing**: Monitors Telegram channels for trading signals
- **Jupiter DEX Integration**: Uses the most liquid routes for optimal execution
- **Multi-channel Support**: Premium channels (Underdog Calls, Degen) + custom channels
- **Intelligent Parsing**: Channel-specific signal parsing for maximum accuracy

### 🛡️ **Advanced Safety Systems**
- **Multi-layer Protection**: Token age, liquidity, and price impact checks
- **Blacklist Management**: Automatic filtering of known scam tokens
- **Risk Management**: Configurable position sizing and stop losses
- **Paper Trading Mode**: Risk-free testing with virtual funds

### 📊 **Professional Interface**
- **Enhanced Menu System**: Intuitive navigation and real-time dashboards
- **Live Monitoring**: Real-time trade tracking and performance analytics
- **Channel Analytics**: Performance breakdown by signal source
- **Configuration Management**: Easy setup and customization

### 📈 **Smart Trading Logic**
- **Trailing Stop Losses**: Maximize profits while protecting downside
- **Multiple Take Profits**: Automated profit-taking at various levels
- **Channel-specific Settings**: Optimized parameters for different signal sources
- **Priority Fee Management**: Fast execution during high network congestion

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (Download from [nodejs.org](https://nodejs.org/))
- **Telegram Account** with API credentials
- **Solana Wallet** (for live trading) with USDC balance

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/crestx/crestx-trading-bot.git
   cd crestx-trading-bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Quick Setup** (Recommended for beginners)
   ```bash
   npm run quickstart
   ```

4. **Manual Setup** (Advanced users)
   ```bash
   npm run setup
   ```

5. **Start Trading**
   ```bash
   npm start
   ```

## 🔧 Configuration Guide

### Getting Telegram API Credentials

1. Visit [my.telegram.org/apps](https://my.telegram.org/apps)
2. Log in with your phone number
3. Click "Create Application"
4. Copy your **API ID** and **API Hash**

### Trading Modes

#### 🧪 **Paper Trading** (Recommended for beginners)
- **Risk-free testing** with $1,000 virtual balance
- **Full feature access** without real money
- **Perfect for learning** the system and testing strategies
- **No wallet required**

#### 💰 **Live Trading** (Advanced users only)
- **Real money trading** with actual profits/losses
- **Requires Solana wallet** with USDC balance
- **High risk** - only use funds you can afford to lose
- **Optimized for speed** and execution

### Premium Channels

CrestX includes optimized parsing for premium signal channels:

- **🔥 Underdog Calls Private**: High-quality memecoin signals
- **💎 Degen Channel**: High-risk, high-reward opportunities

Or configure your own custom channels.

## 🎛️ Using the Enhanced Menu System

### Main Commands

```bash
# Navigation
menu, m         # Show main menu
dashboard, d    # Real-time trading dashboard
help, h         # Show help system

# Trading
trades, t       # View and manage active trades
balance         # Check current balance
cancel <addr>   # Cancel specific trade

# Monitoring
channels, ch    # Channel monitoring and stats
stats           # Detailed performance statistics
history         # Trade history and analysis

# Configuration
config, cfg     # Configuration management
safety <addr>   # Check token safety

# Quick Actions
refresh, r      # Refresh all data
clear, cls      # Clear screen
exit, q         # Exit CrestX
```

### Dashboard Features

The real-time dashboard provides:
- **Live Balance Tracking**
- **Active Trades Monitor** with P/L
- **Channel Activity Feed**
- **Performance Metrics**
- **Risk Analysis**

## ⚙️ Configuration Options

### Trading Settings
```bash
MAX_TRADE_PERCENT=5           # Max % of balance per trade
USE_TRAILING_STOP=true        # Enable trailing stop losses
TRAILING_STOP_PERCENT=20      # Trailing stop distance
DEFAULT_SLIPPAGE=3            # Slippage tolerance %
```

### Safety Settings
```bash
ENABLE_SAFETY_CHECKS=true     # Enable token safety checks
MIN_LIQUIDITY_USD=5000        # Minimum liquidity requirement
MAX_PRICE_IMPACT=10           # Maximum acceptable price impact
MIN_TOKEN_AGE_SECONDS=300     # Minimum token age (5 minutes)
```

### Advanced Settings
```bash
RPC_ENDPOINT=...              # Solana RPC endpoint
PRIORITY_FEE_LAMPORTS=50000   # Transaction priority fee
MONITOR_INTERVAL_MS=10000     # Signal monitoring frequency
```

## 📊 Performance Tracking

### Statistics Available
- **Win Rate Analysis** by channel and overall
- **Profit/Loss Tracking** with detailed breakdowns
- **Risk Metrics** including maximum drawdown
- **Channel Performance** comparison
- **Safety Check Statistics**

### Export Options
- **Trade History Export** to CSV/JSON
- **Configuration Backup** and restore
- **Performance Reports** with analytics

## 🛡️ Safety Features

### Token Safety Checks
- **Liquidity Verification**: Ensures sufficient trading volume
- **Price Impact Analysis**: Prevents high-slippage trades
- **Token Age Filtering**: Avoids newly created scam tokens
- **Blacklist Management**: Automatic scam token filtering

### Risk Management
- **Position Sizing**: Configurable per-trade risk limits
- **Stop Loss Protection**: Automatic loss prevention
- **Trailing Stops**: Profit protection with upside capture
- **Emergency Exit**: Manual trade cancellation

## 🚨 Risk Disclaimer

**⚠️ IMPORTANT RISK WARNING ⚠️**

- **Cryptocurrency trading involves substantial risk**
- **Memecoin trading is EXTREMELY HIGH RISK**
- **You could lose your entire investment**
- **Only trade with money you can afford to lose**
- **Past performance does not guarantee future results**
- **This bot is provided as-is with no guarantees**

### Recommended Practices
1. **Start with Paper Trading** to learn the system
2. **Use small amounts** when switching to live trading
3. **Monitor closely** during initial live trades
4. **Set strict risk limits** and stick to them
5. **Never risk more than you can afford to lose**

## 🔧 Troubleshooting

### Common Issues

#### **Bot Not Starting**
```bash
# Check Node.js version
node --version  # Should be 18+

# Update dependencies
npm run clean
npm install
```

#### **Telegram Connection Issues**
```bash
# Clear session and reconfigure
rm session.txt
npm run setup
```

#### **Trade Execution Problems**
- Check USDC balance (live trading)
- Verify RPC endpoint connectivity
- Increase priority fee for faster execution
- Check safety settings aren't too restrictive

#### **Configuration Errors**
```bash
# Validate configuration
npm run test-config

# Reset to defaults
# Use config menu -> reset option
```

### Getting Help
1. **Check the built-in help**: Type `help` in the bot
2. **Review configuration**: Use `config` menu
3. **Check logs**: Monitor console output
4. **Test with paper trading**: Safe debugging environment

## 🛠️ Development

### Building Executables
```bash
# Windows executable
npm run build-exe

# Linux executable  
npm run build-linux

# macOS executable
npm run build-mac

# All platforms
npm run build-all
```

### Testing
```bash
# Test configuration loading
npm run test-config

# Test safety module
npm run test-safety

# Update dependencies
npm run update-deps
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more information.

## 📞 Support

For support and questions:
- **GitHub Issues**: [Report bugs or request features](https://github.com/crestx/crestx-trading-bot/issues)
- **Documentation**: Check the built-in help system
- **Community**: Join our trading community

## 🚀 What's Next?

### Upcoming Features
- **Advanced Analytics**: More detailed performance metrics
- **Portfolio Management**: Multi-token position tracking  
- **Signal Backtesting**: Historical strategy testing
- **Mobile App**: Remote monitoring and control
- **API Integration**: Third-party platform connections

---

<div align="center">
  <strong>🎯 Start your memecoin trading journey with CrestX today!</strong><br>
  <em>Remember: Always start with paper trading to learn the system risk-free.</em>
</div>