// banner.js - Improved cleaner banner display
function displayBanner(config) {
  return `
\x1b[90m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m
\x1b[90m┃\x1b[0m                                                                          \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m ██████╗██████╗ ███████╗███████╗████████╗██╗  ██╗ \x1b[0m                   \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝╚██╗██╔╝ \x1b[0m                   \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m██║     ██████╔╝█████╗  ███████╗   ██║    ╚███╔╝  \x1b[0m                   \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m██║     ██╔══██╗██╔══╝  ╚════██║   ██║    ██╔██╗  \x1b[0m                   \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m╚██████╗██║  ██║███████╗███████║   ██║   ██╔╝ ██╗ \x1b[0m                   \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m  \x1b[1m\x1b[37m ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ \x1b[0m                   \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                                          \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m┌────────────────────┐\x1b[0m                         \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[0m  \x1b[34m▲\x1b[0m    \x1b[34m▲\x1b[0m     \x1b[34m▲\x1b[0m  \x1b[1m\x1b[37m│\x1b[0m                         \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[0m \x1b[34m▲\x1b[90m█\x1b[34m▲\x1b[0m  \x1b[34m▲\x1b[90m█\x1b[34m▲\x1b[0m   \x1b[34m▲\x1b[90m█\x1b[34m▲\x1b[0m \x1b[1m\x1b[37m│\x1b[0m                         \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[90m████████████████\x1b[1m\x1b[37m│\x1b[0m                         \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[90m████████████████\x1b[1m\x1b[37m│\x1b[0m                         \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m│\x1b[90m████████████████\x1b[1m\x1b[37m│\x1b[0m                         \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                         \x1b[1m\x1b[37m└────────────────────┘\x1b[0m                         \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                                          \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                 \x1b[1m\x1b[37m[ SOLANA MEMECOIN TRADING BOT ]\x1b[0m                     \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                                          \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m               \x1b[1m\x1b[36m${config.DRY_RUN === true || config.DRY_RUN === 'true' ? '[ PAPER TRADING MODE ]' : '[ LIVE TRADING MODE ]'}\x1b[0m                 \x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m                                                                          \x1b[90m┃\x1b[0m
\x1b[90m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m
`;
}

// Add a smaller banner for use in other places
function displaySmallBanner(config) {
  return `
\x1b[90m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m
\x1b[90m┃\x1b[0m \x1b[1m\x1b[37m        CRESTX - SOLANA MEMECOIN TRADER       \x1b[0m\x1b[90m┃\x1b[0m
\x1b[90m┃\x1b[0m \x1b[1m\x1b[36m ${config.DRY_RUN === true || config.DRY_RUN === 'true' ? '[ PAPER TRADING MODE ]' : '[ LIVE TRADING MODE ]'}        \x1b[0m\x1b[90m┃\x1b[0m
\x1b[90m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m
`;
}

module.exports = { displayBanner, displaySmallBanner };