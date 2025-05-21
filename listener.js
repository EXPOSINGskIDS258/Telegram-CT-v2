const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const path = require("path");
const config = require("./config");

let client;

const TEMP_SESSION_FILE = path.join(__dirname, "../session.txt");

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

  await client.sendMessage("me", { message: "✅ Copy Trader bot is live." });

  client.addEventHandler(async (update) => {
    const msg = update.message?.message;
    const chatId = update.message?.peerId?.channelId || update.message?.peerId?.chatId;

    if (!msg || !chatId) return;
    if (!config.TELEGRAM_CHANNEL_IDS.includes(String(chatId))) return;

    console.log(`📩 [${chatId}] ${msg}`);
    callback(msg, chatId);
  });

  await client.run();
}

// Error Handling
process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled promise rejection:", error);
});

// Clean Shutdown
process.on("SIGINT", async () => {
  console.log("\n👋 Gracefully shutting down Telegram client...");
  try {
    await client?.disconnect();
    console.log("🔌 Disconnected.");
  } catch (err) {
    console.error("⚠️ Shutdown error:", err);
  }
  process.exit(0);
});

module.exports = { startListener };
