#!/usr/bin/env node
// browse-channels.js - Standalone tool to browse and select Telegram channels

const { TelegramChannelBrowser } = require('./telegram-channel-browser');
const readline = require('readline');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function main() {
  console.clear();
  console.log(`
${colors.bright}${colors.cyan}
   ██████╗██████╗ ███████╗███████╗████████╗██╗  ██╗
  ██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝╚██╗██╔╝
  ██║     ██████╔╝█████╗  ███████╗   ██║    ╚███╔╝ 
  ██║     ██╔══██╗██╔══╝  ╚════██║   ██║    ██╔██╗ 
  ╚██████╗██║  ██║███████╗███████║   ██║   ██╔╝ ██╗
   ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝
${colors.reset}

  ${colors.bright}${colors.cyan}Telegram Channel Browser${colors.reset}
  ${colors.yellow}Browse and select your Telegram channels for trading signals${colors.reset}
`);

  try {
    // Get API credentials
    console.log(`${colors.cyan}📱 Telegram API Setup${colors.reset}`);
    console.log('Get your credentials from: https://my.telegram.org/apps\n');
    
    const apiId = await askQuestion('🔑 Enter your Telegram API ID: ');
    const apiHash = await askQuestion('🔐 Enter your Telegram API Hash: ');
    
    if (!apiId || !apiHash) {
      console.log(`${colors.red}❌ API credentials are required${colors.reset}`);
      process.exit(1);
    }

    // Initialize browser
    console.log(`\n${colors.cyan}🔄 Initializing Telegram connection...${colors.reset}`);
    const browser = new TelegramChannelBrowser();
    
    const connected = await browser.initialize(parseInt(apiId), apiHash);
    
    if (!connected) {
      console.log(`${colors.red}❌ Failed to connect to Telegram${colors.reset}`);
      process.exit(1);
    }

    // Main menu
    let continueRunning = true;
    
    while (continueRunning) {
      console.log(`\n${colors.bright}${colors.cyan}📋 CHANNEL BROWSER MENU${colors.reset}`);
      console.log('═'.repeat(50));
      console.log('1. 🔍 Browse All Your Channels');
      console.log('2. 🎯 Select Channels for Trading');
      console.log('3. 🔥 Show Premium Channels');
      console.log('4. 🧪 Test Channel Access');
      console.log('5. 👁️  Preview Channel Messages');
      console.log('6. 💾 Export Channel List');
      console.log('7. ❌ Exit');

      const choice = await askQuestion(`\n${colors.cyan}Choose option (1-7): ${colors.reset}`);

      switch (choice) {
        case '1':
          await browseChaneis(browser);
          break;
        case '2':
          await selectChannels(browser);
          break;
        case '3':
          showPremiumChannels();
          break;
        case '4':
          await testChannelAccess(browser);
          break;
        case '5':
          await previewChannelMessages(browser);
          break;
        case '6':
          await exportChannelList(browser);
          break;
        case '7':
          continueRunning = false;
          break;
        default:
          console.log(`${colors.red}❌ Invalid choice${colors.reset}`);
      }

      if (continueRunning) {
        await askQuestion('\nPress Enter to continue...');
      }
    }

    await browser.disconnect();
    console.log(`\n${colors.green}👋 Goodbye!${colors.reset}`);
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Error: ${error.message}${colors.reset}`);
  } finally {
    rl.close();
  }
}

async function browseChaneis(browser) {
  console.log(`\n${colors.cyan}🔍 Loading your Telegram channels...${colors.reset}`);
  
  try {
    const channels = await browser.getUserChannels();
    
    if (channels.length === 0) {
      console.log(`${colors.yellow}📭 No suitable trading channels found${colors.reset}`);
      console.log('💡 Join some crypto/trading channels and try again');
      return;
    }

    browser.displayChannelMenu();
    
    console.log(`\n${colors.green}✅ Found ${channels.length} potential trading channels${colors.reset}`);
    
  } catch (error) {
    console.log(`${colors.red}❌ Error loading channels: ${error.message}${colors.reset}`);
  }
}

async function selectChannels(browser) {
  console.log(`\n${colors.cyan}🎯 Interactive Channel Selection${colors.reset}`);
  
  try {
    const selectedChannels = await browser.selectChannels();
    
    if (selectedChannels.length > 0) {
      const channelIds = browser.getChannelIds(selectedChannels);
      
      console.log(`\n${colors.green}✅ Selected ${selectedChannels.length} channels:${colors.reset}`);
      selectedChannels.forEach((ch, i) => {
        console.log(`   ${i + 1}. ${ch.title} (${ch.botChannelId})`);
      });
      
      console.log(`\n${colors.bright}📋 Channel IDs for .env file:${colors.reset}`);
      console.log(`${colors.yellow}TELEGRAM_CHANNEL_IDS=${channelIds}${colors.reset}`);
      
      // Ask if they want to update .env file
      const updateEnv = await askQuestion(`\n${colors.cyan}Update your .env file with these channels? (y/n): ${colors.reset}`);
      
      if (updateEnv.toLowerCase().startsWith('y')) {
        await updateEnvFile(channelIds);
      }
      
    } else {
      console.log(`${colors.yellow}⚠️ No channels selected${colors.reset}`);
    }
    
  } catch (error) {
    console.log(`${colors.red}❌ Error selecting channels: ${error.message}${colors.reset}`);
  }
}

function showPremiumChannels() {
  console.log(`\n${colors.bright}${colors.cyan}🔥 PREMIUM TRADING CHANNELS${colors.reset}`);
  console.log('═'.repeat(50));
  
  const premiumChannels = [
    {
      name: 'Underdog Calls Private',
      id: '-1002209371269',
      description: 'High-quality memecoin signals with excellent track record',
      icon: '🔥'
    },
    {
      name: 'Degen',
      id: '-1002277274250', 
      description: 'High-risk, high-reward calls for experienced traders',
      icon: '💎'
    }
  ];
  
  premiumChannels.forEach((ch, i) => {
    console.log(`\n${i + 1}. ${ch.icon} ${colors.bright}${ch.name}${colors.reset}`);
    console.log(`   ID: ${ch.id}`);
    console.log(`   ${ch.description}`);
  });
  
  const channelIds = premiumChannels.map(ch => ch.id).join(',');
  console.log(`\n${colors.bright}📋 Premium Channel IDs:${colors.reset}`);
  console.log(`${colors.yellow}TELEGRAM_CHANNEL_IDS=${channelIds}${colors.reset}`);
}

async function testChannelAccess(browser) {
  console.log(`\n${colors.cyan}🧪 Test Channel Access${colors.reset}`);
  
  const channelId = await askQuestion('Enter channel ID to test: ');
  
  if (!channelId) {
    console.log(`${colors.red}❌ Channel ID required${colors.reset}`);
    return;
  }
  
  try {
    console.log(`${colors.cyan}🔍 Testing access to ${channelId}...${colors.reset}`);
    
    const result = await browser.testChannelAccess(channelId);
    
    if (result.canAccess) {
      console.log(`${colors.green}✅ Access: SUCCESS${colors.reset}`);
      console.log(`${colors.green}📨 Has Messages: ${result.hasMessages ? 'YES' : 'NO'}${colors.reset}`);
      
      if (result.lastMessage) {
        console.log(`${colors.blue}📝 Last Message Preview:${colors.reset}`);
        const preview = result.lastMessage.length > 100 
          ? result.lastMessage.substring(0, 100) + '...'
          : result.lastMessage;
        console.log(`   "${preview}"`);
      }
    } else {
      console.log(`${colors.red}❌ Access: FAILED${colors.reset}`);
      console.log(`${colors.red}Error: ${result.error}${colors.reset}`);
      console.log(`\n${colors.yellow}💡 Possible reasons:${colors.reset}`);
      console.log('   • Channel is private and you\'re not a member');
      console.log('   • Channel ID is incorrect');
      console.log('   • Channel doesn\'t exist');
    }
    
  } catch (error) {
    console.log(`${colors.red}❌ Test failed: ${error.message}${colors.reset}`);
  }
}

async function previewChannelMessages(browser) {
  console.log(`\n${colors.cyan}👁️ Preview Channel Messages${colors.reset}`);
  
  const channelId = await askQuestion('Enter channel ID to preview: ');
  
  if (!channelId) {
    console.log(`${colors.red}❌ Channel ID required${colors.reset}`);
    return;
  }
  
  try {
    await browser.previewChannel(channelId, 5);
  } catch (error) {
    console.log(`${colors.red}❌ Preview failed: ${error.message}${colors.reset}`);
  }
}

async function exportChannelList(browser) {
  console.log(`\n${colors.cyan}💾 Export Channel List${colors.reset}`);
  
  try {
    const channels = await browser.getUserChannels();
    
    if (channels.length === 0) {
      console.log(`${colors.yellow}📭 No channels to export${colors.reset}`);
      return;
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalChannels: channels.length,
      channels: channels.map(ch => ({
        title: ch.title,
        id: ch.botChannelId,
        type: ch.type,
        memberCount: ch.memberCount,
        username: ch.username
      }))
    };
    
    const filename = `telegram-channels-${new Date().toISOString().split('T')[0]}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
    
    console.log(`${colors.green}✅ Exported ${channels.length} channels to: ${filename}${colors.reset}`);
    
    // Also create a simple .env format
    const envFormat = channels.map(ch => ch.botChannelId).join(',');
    const envFilename = `channels-for-env-${new Date().toISOString().split('T')[0]}.txt`;
    
    fs.writeFileSync(envFilename, `TELEGRAM_CHANNEL_IDS=${envFormat}`);
    
    console.log(`${colors.green}✅ Created .env format file: ${envFilename}${colors.reset}`);
    
  } catch (error) {
    console.log(`${colors.red}❌ Export failed: ${error.message}${colors.reset}`);
  }
}

async function updateEnvFile(channelIds) {
  try {
    if (!fs.existsSync('.env')) {
      console.log(`${colors.yellow}⚠️ No .env file found${colors.reset}`);
      console.log('💡 Run the setup wizard first: node setup.js');
      return;
    }
    
    let envContent = fs.readFileSync('.env', 'utf8');
    
    // Update or add TELEGRAM_CHANNEL_IDS
    if (envContent.includes('TELEGRAM_CHANNEL_IDS=')) {
      envContent = envContent.replace(
        /TELEGRAM_CHANNEL_IDS=.*/,
        `TELEGRAM_CHANNEL_IDS=${channelIds}`
      );
    } else {
      envContent += `\nTELEGRAM_CHANNEL_IDS=${channelIds}\n`;
    }
    
    // Backup original
    fs.writeFileSync('.env.backup', fs.readFileSync('.env'));
    
    // Write updated content
    fs.writeFileSync('.env', envContent);
    
    console.log(`${colors.green}✅ Updated .env file with selected channels${colors.reset}`);
    console.log(`${colors.blue}📋 Backup saved as: .env.backup${colors.reset}`);
    
  } catch (error) {
    console.log(`${colors.red}❌ Failed to update .env file: ${error.message}${colors.reset}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(`\n${colors.red}❌ Application error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { main };