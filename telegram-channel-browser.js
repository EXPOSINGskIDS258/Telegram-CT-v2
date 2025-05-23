// telegram-channel-browser.js - Browse and select user's Telegram channels
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const path = require("path");

class TelegramChannelBrowser {
  constructor() {
    this.client = null;
    this.sessionString = "";
    this.userChannels = [];
  }

  /**
   * Initialize Telegram client and connect
   */
  async initialize(apiId, apiHash, sessionString = "") {
    this.sessionString = sessionString;
    const stringSession = new StringSession(sessionString);
    
    this.client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    try {
      if (!sessionString) {
        console.log('🔑 Connecting to Telegram...');
        await this.client.start({
          phoneNumber: async () => await input.text("📱 Enter your phone number: "),
          password: async () => await input.text("🔐 Enter your 2FA password (if set): "),
          phoneCode: async () => await input.text("📲 Enter the verification code: "),
          onError: (err) => console.error("❌ Login error:", err),
        });

        // Save session for future use
        this.sessionString = this.client.session.save();
        console.log('✅ Successfully connected to Telegram!');
      } else {
        await this.client.connect();
        console.log('✅ Connected using saved session');
      }

      const me = await this.client.getMe();
      console.log(`👤 Logged in as: ${me.username || me.firstName}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Telegram:', error.message);
      return false;
    }
  }

  /**
   * Get all user's channels and groups
   */
  async getUserChannels() {
    if (!this.client) {
      throw new Error('Telegram client not initialized');
    }

    try {
      console.log('\n🔍 Scanning your Telegram channels and groups...');
      
      // Get all dialogs (chats, channels, groups)
      const dialogs = await this.client.getDialogs({ limit: 500 });
      
      this.userChannels = [];
      
      for (const dialog of dialogs) {
        const entity = dialog.entity;
        
        // Filter for channels and supergroups (where trading signals are usually posted)
        if (entity.className === 'Channel' || entity.className === 'Chat') {
          let channelInfo = {
            id: entity.id.toString(),
            title: entity.title || 'Unknown',
            type: this.getChannelType(entity),
            memberCount: entity.participantsCount || 0,
            username: entity.username || null,
            isChannel: entity.broadcast || false,
            isGroup: !entity.broadcast && entity.megagroup,
            isSupergroup: entity.megagroup || false,
            accessHash: entity.accessHash,
            // Convert to the format needed for bot (-100 prefix for supergroups/channels)
            botChannelId: entity.megagroup || entity.broadcast 
              ? `-100${Math.abs(entity.id)}` 
              : entity.id.toString()
          };

          // Only include channels/groups that could have trading signals
          if (this.isLikelyTradingChannel(channelInfo)) {
            this.userChannels.push(channelInfo);
          }
        }
      }

      // Sort by member count (bigger channels first) and then by name
      this.userChannels.sort((a, b) => {
        if (b.memberCount !== a.memberCount) {
          return b.memberCount - a.memberCount;
        }
        return a.title.localeCompare(b.title);
      });

      console.log(`📊 Found ${this.userChannels.length} potential trading channels/groups`);
      return this.userChannels;

    } catch (error) {
      console.error('❌ Error getting channels:', error.message);
      throw error;
    }
  }

  /**
   * Determine if a channel is likely to have trading signals
   */
  isLikelyTradingChannel(channelInfo) {
    const title = channelInfo.title.toLowerCase();
    const tradingKeywords = [
      'trading', 'crypto', 'signals', 'calls', 'pump', 'gem', 'altcoin',
      'defi', 'nft', 'memecoin', 'solana', 'ethereum', 'bitcoin', 'degen',
      'alpha', 'ape', 'moonshot', 'coin', 'token', 'finance', 'investment'
    ];

    // Include if title contains trading keywords
    const hasKeywords = tradingKeywords.some(keyword => title.includes(keyword));
    
    // Include if it's a larger channel/group (more likely to be active)
    const isLargeEnough = channelInfo.memberCount > 10;
    
    // Include channels and supergroups, but skip small private chats
    const isRightType = channelInfo.isChannel || channelInfo.isSupergroup || 
                       (channelInfo.isGroup && channelInfo.memberCount > 50);

    return (hasKeywords || isLargeEnough) && isRightType;
  }

  /**
   * Get channel type description
   */
  getChannelType(entity) {
    if (entity.broadcast) return 'Channel';
    if (entity.megagroup) return 'Supergroup';
    if (entity.className === 'Chat') return 'Group';
    return 'Unknown';
  }

  /**
   * Display channels in a user-friendly menu
   */
  displayChannelMenu(channels = null) {
    const channelsToShow = channels || this.userChannels;
    
    console.log('\n📋 Your Telegram Channels & Groups:');
    console.log('═'.repeat(80));
    
    if (channelsToShow.length === 0) {
      console.log('❌ No suitable channels found.');
      console.log('💡 Make sure you\'re in some crypto/trading channels or groups.');
      return;
    }

    channelsToShow.forEach((channel, index) => {
      const typeIcon = this.getTypeIcon(channel);
      const memberText = channel.memberCount > 0 
        ? `${this.formatNumber(channel.memberCount)} members` 
        : 'Unknown size';
      
      console.log(`${String(index + 1).padStart(3)}. ${typeIcon} ${channel.title}`);
      console.log(`     ${channel.type} • ${memberText} • ID: ${channel.botChannelId}`);
      
      if (channel.username) {
        console.log(`     @${channel.username}`);
      }
      console.log('');
    });

    console.log('💡 Tips:');
    console.log('   • Look for channels with "signals", "calls", "trading" in the name');
    console.log('   • Larger channels often have more active trading signals');
    console.log('   • Premium channels usually have better quality signals');
  }

  /**
   * Get icon for channel type
   */
  getTypeIcon(channel) {
    if (channel.isChannel) return '📢';
    if (channel.isSupergroup) return '👥';
    if (channel.isGroup) return '💬';
    return '❓';
  }

  /**
   * Format member count
   */
  formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  /**
   * Interactive channel selection
   */
  async selectChannels() {
    await this.getUserChannels();
    
    if (this.userChannels.length === 0) {
      console.log('❌ No suitable channels found in your Telegram account.');
      console.log('💡 Join some crypto/trading channels first and try again.');
      return [];
    }

    const selectedChannels = [];
    let continue_selection = true;

    while (continue_selection) {
      console.clear();
      console.log('🎯 SELECT TRADING CHANNELS');
      console.log('═'.repeat(50));
      
      if (selectedChannels.length > 0) {
        console.log(`\n✅ Currently selected (${selectedChannels.length}):`);
        selectedChannels.forEach((ch, i) => {
          console.log(`   ${i + 1}. ${this.getTypeIcon(ch)} ${ch.title}`);
        });
        console.log('');
      }

      this.displayChannelMenu();
      
      console.log('📝 Commands:');
      console.log('   • Enter channel number (1-' + this.userChannels.length + ') to add/remove');
      console.log('   • Type "done" when finished');
      console.log('   • Type "clear" to clear all selections');
      console.log('   • Type "filter" to search by keyword');
      console.log('   • Type "premium" to add recommended premium channels');

      const input_text = await input.text('\n🎯 Your choice: ');
      const choice = input_text.toLowerCase().trim();

      if (choice === 'done') {
        break;
      } else if (choice === 'clear') {
        selectedChannels.length = 0;
        console.log('🗑️ Cleared all selections');
        await this.pause();
      } else if (choice === 'filter') {
        await this.filterChannels();
      } else if (choice === 'premium') {
        return this.getPremiumChannels();
      } else {
        const channelIndex = parseInt(choice) - 1;
        if (channelIndex >= 0 && channelIndex < this.userChannels.length) {
          const channel = this.userChannels[channelIndex];
          
          // Check if already selected
          const existingIndex = selectedChannels.findIndex(ch => ch.id === channel.id);
          
          if (existingIndex >= 0) {
            selectedChannels.splice(existingIndex, 1);
            console.log(`➖ Removed: ${channel.title}`);
          } else {
            selectedChannels.push(channel);
            console.log(`➕ Added: ${channel.title}`);
          }
          await this.pause();
        } else {
          console.log('❌ Invalid choice. Please try again.');
          await this.pause();
        }
      }
    }

    return selectedChannels;
  }

  /**
   * Filter channels by keyword
   */
  async filterChannels() {
    const keyword = await input.text('🔍 Enter keyword to filter channels: ');
    const filtered = this.userChannels.filter(ch => 
      ch.title.toLowerCase().includes(keyword.toLowerCase())
    );

    console.log(`\n🔍 Found ${filtered.length} channels matching "${keyword}":`);
    this.displayChannelMenu(filtered);
    await this.pause();
  }

  /**
   * Get premium channels (fallback)
   */
  getPremiumChannels() {
    return [
      {
        id: '-1002209371269',
        title: 'Underdog Calls Private',
        type: 'Premium Channel',
        botChannelId: '-1002209371269',
        isPremium: true
      },
      {
        id: '-1002277274250', 
        title: 'Degen',
        type: 'Premium Channel',
        botChannelId: '-1002277274250',
        isPremium: true
      }
    ];
  }

  /**
   * Get selected channel IDs for bot configuration
   */
  getChannelIds(selectedChannels) {
    return selectedChannels.map(ch => ch.botChannelId).join(',');
  }

  /**
   * Pause for user input
   */
  async pause() {
    await input.text('Press Enter to continue...');
  }

  /**
   * Get saved session string
   */
  getSessionString() {
    return this.sessionString;
  }

  /**
   * Disconnect client
   */
  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
    }
  }

  /**
   * Test channel access (check if bot can read messages)
   */
  async testChannelAccess(channelId) {
    try {
      const entity = await this.client.getEntity(channelId);
      const messages = await this.client.getMessages(entity, { limit: 1 });
      return {
        canAccess: true,
        hasMessages: messages.length > 0,
        lastMessage: messages[0]?.message || null
      };
    } catch (error) {
      return {
        canAccess: false,
        error: error.message
      };
    }
  }

  /**
   * Preview channel messages
   */
  async previewChannel(channelId, limit = 3) {
    try {
      console.log(`\n🔍 Previewing recent messages from channel...`);
      
      const entity = await this.client.getEntity(channelId);
      const messages = await this.client.getMessages(entity, { limit });
      
      if (messages.length === 0) {
        console.log('📭 No recent messages found');
        return;
      }

      console.log(`📨 Last ${messages.length} messages:`);
      console.log('─'.repeat(60));
      
      messages.forEach((msg, i) => {
        if (msg.message) {
          const preview = msg.message.length > 100 
            ? msg.message.substring(0, 100) + '...' 
            : msg.message;
          console.log(`${i + 1}. ${preview}`);
          console.log('');
        }
      });
      
    } catch (error) {
      console.log(`❌ Could not preview channel: ${error.message}`);
    }
  }
}

module.exports = { TelegramChannelBrowser };