// src/notifier.js
// Notification module: supports MTProto client or Bot API fall-back

require('dotenv').config();
const fetch = require('node-fetch');
const config = require('./config');

class Notifier {
  constructor() {
    this.enabled = config.ENABLE_NOTIFICATIONS;
    this.chatId = config.NOTIFICATION_CHAT_ID;
    this.botToken = config.TELEGRAM_BOT_TOKEN;
    this.client = null; // MTProto TelegramClient instance
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
  async _send(text) {
    if (!this.enabled || !this.chatId) return;

    // MTProto client available
    if (this.client) {
      try {
        await this.client.sendMessage(this.chatId, { message: text });
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
          parse_mode: 'Markdown'
        })
      });
      const data = await res.json();
      if (!data.ok) console.error('Notifier Bot API error:', data);
    } catch (err) {
      console.error('Notifier Bot API send error:', err);
    }
  }

  /**
   * Notify when a trade is executed
   */
  async notifyTradeExecution(trade) {
    if (!this.enabled) return;
    const msg = `🟢 *New Trade Executed*

` +
      `Token: \`${trade.symbol || trade.contractAddress}\`
` +
      `Entry Price: \`${trade.entryPrice?.toFixed(8) || 'Unknown'}\`
` +
      `Amount: \`${trade.amount?.toFixed(8) || 'Unknown'}\`
` +
      `Stop Loss: \`${trade.stopLossPercent ? `-${trade.stopLossPercent}%` : 'None'}\``;
    await this._send(msg);
  }

  /**
   * Notify when a trade exits (TP or SL)
   */
  async notifyTradeExit(trade, exitType) {
    if (!this.enabled) return;
    const typeIcon = exitType === 'stoploss' ? '🔴 Stop Loss' : '🟢 Take Profit';
    const profitText = trade.profit != null
      ? (trade.profit >= 0 ? `+${trade.profit.toFixed(8)}` : `${trade.profit.toFixed(8)}`)
      : 'Unknown';
    const durationMs = trade.exitTimestamp - trade.timestamp;
    const durSec = Math.floor(durationMs / 1000);
    const dur = durSec < 60 ? `${durSec}s` : `${Math.floor(durSec/60)}m${durSec%60}s`;

    const msg = `*${typeIcon} Triggered*

` +
      `Token: \`${trade.symbol || trade.contractAddress}\`
` +
      `Exit Price: \`${trade.exitPrice?.toFixed(8) || 'Unknown'}\`
` +
      `P/L: \`${profitText}\`
` +
      `Duration: \`${dur}\``;
    await this._send(msg);
  }

  /**
   * Notify safety warnings before trade
   */
  async notifySafetyWarning(token, issues) {
    if (!this.enabled) return;
    const msg = `⚠️ *Token Safety Warning*

` +
      `Token: \`${token.name || token.address}\`
` +
      `Issues:
${issues.map(i => `- ${i}`).join('\n')}`;
    await this._send(msg);
  }
}

module.exports = new Notifier();