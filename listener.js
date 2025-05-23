const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const input = require("input");
const fs = require("fs");
const path = require("path");
const config = require("./config");

let client;

const TEMP_SESSION_FILE = path.join(__dirname, "../session.txt");

// Premium channel information for better logging
const PREMIUM_CHANNELS = {
  '-1002209371269': {
    name: 'Underdog Calls Private',
    icon: '🔥',
    description: 'Premium memecoin signals'
  },
  '-1002277274250': {
    name: 'Degen',
    icon: '💎',
    description: 'High-risk high-reward calls'
  }
};

// Message statistics for monitoring
const messageStats = {
  totalMessages: 0,
  messagesByChannel: {},
  lastMessageTime: null,
  startTime: Date.now()
};

async function startListener(callback) {
  let sessionString = config.SESSION_NAME;

  // If no session in .env, check if we saved one locally
  if (!sessionString && fs.existsSync(TEMP_SESSION_FILE)) {
    sessionString = fs.readFileSync(TEMP_SESSION_FILE, "utf8").trim();
    console.log("🔄 Loaded session from file.");
  }

  const stringSession = new StringSession(sessionString || "");

  client = new TelegramClient(stringSession, config.API_ID, config.API_HASH, {
    connectionRetries: 5,
  });

  if (!sessionString) {
    console.log("🔑 No session found. Logging in interactively...");
    await client.start({
      phoneNumber: async () => await input.text("Enter your phone number: "),
      password: async () => await input.text("Enter your 2FA password (if set): "),
      phoneCode: async () => await input.text("Enter the code you received: "),
      onError: (err) => console.error("Login error:", err),
    });

    const newSession = client.session.save();
    fs.writeFileSync(TEMP_SESSION_FILE, newSession);
    console.log("\n🔐 SESSION generated and saved to session.txt.");
    console.log("📌 Paste this into your .env as:");
    console.log(`SESSION_NAME=${newSession}`);
  } else {
    await client.connect();
    console.log("✅ Logged in with session.");
  }

  const me = await client.getMe();
  console.log("👤 Logged in as", me.username || me.firstName);

  // Enhanced startup message with channel info
  const channelInfo = getChannelInfo();
  await client.sendMessage("me", { 
    message: `✅ CrestX Trading Bot is live!\n\n📊 Monitoring ${config.TELEGRAM_CHANNEL_IDS.length} channels:\n${channelInfo}` 
  });

  // Display channel monitoring status
  displayChannelStatus();

  // Add event handler for new messages
  client.addEventHandler(async (update) => {
    try {
      const msg = update.message?.message;
      const chatId = update.message?.peerId?.channelId || update.message?.peerId?.chatId;

      if (!msg || !chatId) return;
      
      // Convert chatId to string for comparison
      const chatIdStr = String(-Math.abs(chatId)); // Ensure negative for channels
      
      // Check if this channel is in our monitoring list
      if (!config.TELEGRAM_CHANNEL_IDS.some(id => String(id) === chatIdStr)) {
        return;
      }

      // Update message statistics
      updateMessageStats(chatIdStr);

      // Get channel info for enhanced logging
      const channelInfo = PREMIUM_CHANNELS[chatIdStr];
      const channelDisplay = channelInfo 
        ? `${channelInfo.icon} ${channelInfo.name}` 
        : `📱 Channel ${chatIdStr}`;

      // Enhanced logging with channel context
      console.log(`\n📩 [${new Date().toLocaleTimeString()}] ${channelDisplay}`);
      console.log(`💬 Message: ${msg.slice(0, 150)}${msg.length > 150 ? '...' : ''}`);

      // Check for potential signals in the message
      const hasSignalKeywords = containsSignalKeywords(msg);
      if (hasSignalKeywords) {
        console.log(`🎯 Potential signal detected in ${channelDisplay}`);
      }

      // Call the callback with enhanced parameters
      callback(msg, chatIdStr, {
        channelInfo: channelInfo || null,
        timestamp: Date.now(),
        hasSignalKeywords
      });

    } catch (err) {
      console.error(`❌ Error processing message from channel ${chatId}: ${err.message}`);
    }
  }, new NewMessage({}));

  // Set up periodic stats logging
  startStatsLogger();

  // Keep the client running
  console.log("🔄 Bot is now listening for messages...");
  
  return client;
}

/**
 * Get formatted channel information for startup message
 */
function getChannelInfo() {
  return config.TELEGRAM_CHANNEL_IDS.map(channelId => {
    const info = PREMIUM_CHANNELS[channelId];
    return info 
      ? `${info.icon} ${info.name} (${channelId})`
      : `📱 Custom Channel (${channelId})`;
  }).join('\n');
}

/**
 * Display channel monitoring status at startup
 */
function displayChannelStatus() {
  console.log('\n🔍 Channel Monitoring Status:');
  config.TELEGRAM_CHANNEL_IDS.forEach(channelId => {
    const info = PREMIUM_CHANNELS[channelId];
    if (info) {
      console.log(`   ${info.icon} ${info.name} - ${info.description}`);
    } else {
      console.log(`   📱 Custom Channel ${channelId}`);
    }
  });
  console.log('');
}

/**
 * Update message statistics
 */
function updateMessageStats(channelId) {
  messageStats.totalMessages++;
  messageStats.lastMessageTime = Date.now();
  
  if (!messageStats.messagesByChannel[channelId]) {
    messageStats.messagesByChannel[channelId] = 0;
  }
  messageStats.messagesByChannel[channelId]++;
}

/**
 * Check if message contains potential signal keywords
 */
function containsSignalKeywords(message) {
  const signalKeywords = [
    /\b(ape|aping|buy|entry)\b/i,
    /\b(ca|contract|address)\b/i,
    /\b(sl|stop.?loss)\b/i,
    /\btp\d*\b/i,
    /\$[A-Z]{2,10}\b/i,
    /[A-Za-z0-9_]{32,50}/,  // Potential contract address
    /pump|moon|gem|signal/i
  ];
  
  return signalKeywords.some(pattern => pattern.test(message));
}

/**
 * Start periodic statistics logging
 */
function startStatsLogger() {
  setInterval(() => {
    if (messageStats.totalMessages > 0) {
      const uptimeHours = ((Date.now() - messageStats.startTime) / (1000 * 60 * 60)).toFixed(1);
      const messagesPerHour = (messageStats.totalMessages / parseFloat(uptimeHours)).toFixed(1);
      
      console.log(`\n📊 Message Stats (${uptimeHours}h uptime):`);
      console.log(`   Total messages: ${messageStats.totalMessages} (${messagesPerHour}/hour)`);
      
      // Show per-channel breakdown
      Object.entries(messageStats.messagesByChannel).forEach(([channelId, count]) => {
        const info = PREMIUM_CHANNELS[channelId];
        const channelName = info ? info.name : `Channel ${channelId}`;
        console.log(`   ${channelName}: ${count} messages`);
      });
      console.log('');
    }
  }, 30 * 60 * 1000); // Every 30 minutes
}

/**
 * Get current message statistics
 */
function getMessageStats() {
  return {
    ...messageStats,
    uptimeMs: Date.now() - messageStats.startTime
  };
}

/**
 * Add a new channel to monitor (runtime)
 */
async function addChannelToMonitor(channelId, channelName = null) {
  try {
    // Validate channel ID format
    if (!channelId || typeof channelId !== 'string') {
      throw new Error('Invalid channel ID');
    }

    // Check if already monitoring
    if (config.TELEGRAM_CHANNEL_IDS.includes(channelId)) {
      console.log(`⚠️ Already monitoring channel ${channelId}`);
      return false;
    }

    // Add to config (this will also update the .env file if using the enhanced config)
    if (config.addChannel) {
      const success = config.addChannel(channelId);
      if (success) {
        console.log(`✅ Added channel ${channelId} to monitoring list`);
        
        // Optionally add to premium channels if name provided
        if (channelName) {
          PREMIUM_CHANNELS[channelId] = {
            name: channelName,
            icon: '📱',
            description: 'Custom channel'
          };
        }
        
        return true;
      }
    } else {
      console.log(`⚠️ Config doesn't support runtime channel addition`);
    }
    
    return false;
  } catch (err) {
    console.error(`❌ Error adding channel: ${err.message}`);
    return false;
  }
}

/**
 * Remove a channel from monitoring (runtime)
 */
async function removeChannelFromMonitor(channelId) {
  try {
    if (config.removeChannel) {
      const success = config.removeChannel(channelId);
      if (success) {
        console.log(`✅ Removed channel ${channelId} from monitoring list`);
        
        // Remove from premium channels if it exists
        delete PREMIUM_CHANNELS[channelId];
        
        return true;
      }
    } else {
      console.log(`⚠️ Config doesn't support runtime channel removal`);
    }
    
    return false;
  } catch (err) {
    console.error(`❌ Error removing channel: ${err.message}`);
    return false;
  }
}

// Error Handling
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

// Clean Shutdown
process.on("SIGINT", async () => {
  console.log("\n👋 Gracefully shutting down Telegram client...");
  try {
    if (client) {
      // Send shutdown notification
      await client.sendMessage("me", { 
        message: "🔴 CrestX Trading Bot shutting down..." 
      });
      await client.disconnect();
      console.log("🔌 Disconnected.");
    }
  } catch (err) {
    console.error("⚠️ Shutdown error:", err);
  }
  process.exit(0);
});

module.exports = { 
  startListener,
  getMessageStats,
  addChannelToMonitor,
  removeChannelFromMonitor,
  PREMIUM_CHANNELS
};