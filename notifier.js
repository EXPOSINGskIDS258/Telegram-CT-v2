// src/notifier.js
// Enhanced notification module with channel-aware features

require('dotenv').config();
const fetch = require('node-fetch');
const config = require('./config');

// Channel configurations for notifications
const CHANNEL_CONFIGS = {
  '-1002209371269': {
    name: 'Underdog Calls Private',
    icon: '🔥',
    emoji: '🚀'
  },
  '-1002277274250': {
    name: 'Degen',
    icon: '💎',
    emoji: '🎲'
  }
};

class Notifier {
  constructor() {
    this.enabled = config.ENABLE_NOTIFICATIONS;
    this.chatId = config.NOTIFICATION_CHAT_ID;
    this.botToken = config.TELEGRAM_BOT_TOKEN;
    this.client = null; // MTProto TelegramClient instance
    this.dailyStats = {
      trades: 0,
      profit: 0,
      byChannel: {}
    };
    
    // Reset daily stats at midnight
    this.resetDailyStatsTimer();
  }

  /**
   * Assign a TelegramClient instance for MTProto notifications
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * Internal send method: tries MTProto, else Bot API
   */
  async _send(text, options = {}) {
    if (!this.enabled || !this.chatId) return;

    // MTProto client available
    if (this.client) {
      try {
        await this.client.sendMessage(this.chatId, { 
          message: text,
          ...options
        });
        return;
      } catch (err) {
        console.error('Notifier MTProto send error:', err);
        // fallthrough to Bot API
      }
    }

    // Fallback to Bot API
    if (!this.botToken) {
      console.warn('Notifier: BOT token not configured');
      return;
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          ...options
        })
      });
      const data = await res.json();
      if (!data.ok) console.error('Notifier Bot API error:', data);
    } catch (err) {
      console.error('Notifier Bot API send error:', err);
    }
  }

  /**
   * Get channel display information
   */
  getChannelInfo(channelId) {
    return CHANNEL_CONFIGS[channelId] || {
      name: 'Custom Channel',
      icon: '📱',
      emoji: '📈'
    };
  }

  /**
   * Format price for display
   */
  formatPrice(price) {
    if (!price) return 'Unknown';
    if (price < 0.000001) return price.toExponential(2);
    if (price < 0.01) return price.toFixed(8);
    return price.toFixed(6);
  }

  /**
   * Format amount for display
   */
  formatAmount(amount) {
    if (!amount) return 'Unknown';
    if (amount < 1) return amount.toFixed(6);
    if (amount < 1000) return amount.toFixed(2);
    if (amount < 1000000) return (amount / 1000).toFixed(1) + 'K';
    return (amount / 1000000).toFixed(1) + 'M';
  }

  /**
   * Enhanced trade execution notification with channel context
   */
  async notifyTradeExecution(trade) {
    if (!this.enabled) return;
    
    const channelInfo = this.getChannelInfo(trade.sourceChannel);
    const channelDisplay = trade.channelName || channelInfo.name;
    const dryRunLabel = trade.isDryRun ? '\n🧪 *DRY RUN MODE*' : '';
    
    // Update daily stats
    this.updateDailyStats(trade.sourceChannel, 0); // 0 profit for new trade
    
    const msg = `${channelInfo.emoji} *New Trade Executed*
${channelInfo.icon} *Source:* ${channelDisplay}${dryRunLabel}

📊 *Trade Details:*
\`Token:\` ${trade.symbol || trade.contractAddress}
\`Entry:\` $${this.formatPrice(trade.entryPrice)}
\`Size:\` $${this.formatAmount(trade.amount)} ${trade.tradePercent ? `(${trade.tradePercent}%)` : ''}
\`Stop Loss:\` ${trade.stopLossPercent ? `-${trade.stopLossPercent}%` : 'None'}

${trade.takeProfitTargets && trade.takeProfitTargets.length > 0 
  ? `🎯 *Take Profits:* ${trade.takeProfitTargets.map(tp => `+${tp}%`).join(', ')}\n` 
  : ''}${trade.signalConfidence ? `📈 *Signal Confidence:* ${trade.signalConfidence}/3\n` : ''}
⏰ *Time:* ${new Date().toLocaleTimeString()}`;

    await this._send(msg);
  }

  /**
   * Enhanced trade exit notification with detailed P/L
   */
  async notifyTradeExit(trade, exitType) {
    if (!this.enabled) return;
    
    const channelInfo = this.getChannelInfo(trade.sourceChannel);
    const channelDisplay = trade.channelName || channelInfo.name;
    const typeIcon = exitType === 'stoploss' ? '🔴 Stop Loss' : '🟢 Take Profit';
    const profitText = trade.profit != null
      ? (trade.profit >= 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`)
      : 'Unknown';
    const profitEmoji = trade.profit >= 0 ? '📈' : '📉';
    
    // Calculate duration
    const durationMs = trade.exitTimestamp - trade.timestamp;
    const durSec = Math.floor(durationMs / 1000);
    const dur = durSec < 60 ? `${durSec}s` : 
                durSec < 3600 ? `${Math.floor(durSec/60)}m${durSec%60}s` :
                `${Math.floor(durSec/3600)}h${Math.floor((durSec%3600)/60)}m`;

    // Calculate percentage gain/loss
    const percentChange = trade.entryPrice && trade.exitPrice 
      ? (((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100).toFixed(2)
      : 'Unknown';

    // Update daily stats
    this.updateDailyStats(trade.sourceChannel, trade.profit || 0);

    const dryRunLabel = trade.isDryRun ? '\n🧪 *DRY RUN MODE*' : '';

    const msg = `${typeIcon} *Trade Closed*
${channelInfo.icon} *Source:* ${channelDisplay}${dryRunLabel}

📊 *Trade Summary:*
\`Token:\` ${trade.symbol || trade.contractAddress}
\`Entry:\` $${this.formatPrice(trade.entryPrice)}
\`Exit:\` $${this.formatPrice(trade.exitPrice)}
\`Change:\` ${percentChange}%

${profitEmoji} *P/L:* ${profitText}
⏱️ *Duration:* ${dur}
📅 *Today's Performance:* $${this.dailyStats.profit.toFixed(2)} (${this.dailyStats.trades} trades)`;

    await this._send(msg);
  }

  /**
   * Enhanced safety warning with channel context
   */
  async notifySafetyWarning(token, issues, channelId = null) {
    if (!this.enabled) return;
    
    const channelInfo = channelId ? this.getChannelInfo(channelId) : null;
    const channelDisplay = channelInfo ? `\n${channelInfo.icon} *Channel:* ${channelInfo.name}` : '';
    
    const msg = `⚠️ *Token Safety Warning*${channelDisplay}

🔍 *Token:* \`${token.name || token.address}\`

❌ *Issues Detected:*
${issues.map(i => `• ${i}`).join('\n')}

🛡️ *Action:* Trade cancelled for safety`;

    await this._send(msg);
  }

  /**
   * Send daily performance summary
   */
  async notifyDailySummary() {
    if (!this.enabled) return;
    
    const totalTrades = this.dailyStats.trades;
    const totalProfit = this.dailyStats.profit;
    const profitEmoji = totalProfit >= 0 ? '📈' : '📉';
    
    if (totalTrades === 0) return; // Don't send summary if no trades
    
    let channelBreakdown = '';
    Object.entries(this.dailyStats.byChannel).forEach(([channelId, stats]) => {
      const channelInfo = this.getChannelInfo(channelId);
      if (stats.trades > 0) {
        channelBreakdown += `\n${channelInfo.icon} ${channelInfo.name}: ${stats.trades} trades, $${stats.profit.toFixed(2)}`;
      }
    });

    const msg = `📊 *Daily Trading Summary*
📅 *Date:* ${new Date().toLocaleDateString()}

${profitEmoji} *Total P/L:* $${totalProfit.toFixed(2)}
📈 *Total Trades:* ${totalTrades}
💰 *Avg Per Trade:* $${(totalProfit / totalTrades).toFixed(2)}

📋 *By Channel:*${channelBreakdown}

${config.DRY_RUN ? '\n🧪 *Note: Running in DRY RUN mode*' : ''}`;

    await this._send(msg);
    
    // Reset daily stats
    this.resetDailyStats();
  }

  /**
   * Send channel performance comparison
   */
  async notifyChannelPerformance(channelStats) {
    if (!this.enabled) return;
    
    let performance = '📊 *Channel Performance Comparison*\n\n';
    
    Object.entries(channelStats).forEach(([channelId, stats]) => {
      const channelInfo = this.getChannelInfo(channelId);
      const profitEmoji = stats.totalProfit >= 0 ? '📈' : '📉';
      
      performance += `${channelInfo.icon} *${channelInfo.name}*\n`;
      performance += `• Trades: ${stats.totalTrades}\n`;
      performance += `• Win Rate: ${stats.winRate}%\n`;
      performance += `• P/L: ${profitEmoji} $${stats.totalProfit.toFixed(2)}\n`;
      performance += `• W/L: ${stats.wins}/${stats.losses}\n\n`;
    });

    await this._send(performance);
  }

  /**
   * Send system status notification
   */
  async notifySystemStatus(status, details = '') {
    if (!this.enabled) return;
    
    const statusEmoji = {
      'online': '🟢',
      'offline': '🔴', 
      'warning': '🟡',
      'error': '❌',
      'maintenance': '🔧'
    };
    
    const msg = `${statusEmoji[status] || '🔵'} *CrestX Status: ${status.toUpperCase()}*

⏰ *Time:* ${new Date().toLocaleString()}
${details ? `📝 *Details:* ${details}` : ''}

${config.DRY_RUN ? '🧪 *Mode:* DRY RUN' : '💰 *Mode:* LIVE TRADING'}`;

    await this._send(msg);
  }

  /**
   * Send high-profit trade alert
   */
  async notifyHighProfitTrade(trade, profitThreshold = 100) {
    if (!this.enabled || !trade.profit || trade.profit < profitThreshold) return;
    
    const channelInfo = this.getChannelInfo(trade.sourceChannel);
    const percentGain = trade.entryPrice && trade.exitPrice 
      ? (((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100).toFixed(1)
      : 'Unknown';

    const msg = `🎉 *HIGH PROFIT ALERT!*
${channelInfo.icon} *Source:* ${trade.channelName || channelInfo.name}

💰 *Profit:* +$${trade.profit.toFixed(2)}
📈 *Gain:* +${percentGain}%
🎯 *Token:* ${trade.symbol || trade.contractAddress}

🔥 *Great signal from ${channelInfo.name}!*`;

    await this._send(msg);
  }

  /**
   * Update daily statistics
   */
  updateDailyStats(channelId, profit) {
    this.dailyStats.trades++;
    this.dailyStats.profit += profit;
    
    if (channelId) {
      if (!this.dailyStats.byChannel[channelId]) {
        this.dailyStats.byChannel[channelId] = { trades: 0, profit: 0 };
      }
      this.dailyStats.byChannel[channelId].trades++;
      this.dailyStats.byChannel[channelId].profit += profit;
    }
  }

  /**
   * Reset daily statistics
   */
  resetDailyStats() {
    this.dailyStats = {
      trades: 0,
      profit: 0,
      byChannel: {}
    };
  }

  /**
   * Set up timer to reset daily stats and send summary
   */
  resetDailyStatsTimer() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.notifyDailySummary();
      // Set up daily interval
      setInterval(() => {
        this.notifyDailySummary();
      }, 24 * 60 * 60 * 1000); // Every 24 hours
    }, msUntilMidnight);
  }

  /**
   * Send test notification
   */
  async sendTestNotification() {
    const msg = `🧪 *CrestX Test Notification*

✅ Notifications are working correctly!
⏰ Time: ${new Date().toLocaleString()}
🤖 Bot Status: Online

${config.DRY_RUN ? '🧪 Mode: DRY RUN' : '💰 Mode: LIVE TRADING'}`;

    await this._send(msg);
  }

  /**
   * Get notification statistics
   */
  getNotificationStats() {
    return {
      enabled: this.enabled,
      hasClient: !!this.client,
      hasBotToken: !!this.botToken,
      hasChatId: !!this.chatId,
      dailyStats: this.dailyStats
    };
  }
}

module.exports = new Notifier();