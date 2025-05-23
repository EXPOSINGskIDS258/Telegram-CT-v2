#!/usr/bin/env node
// start.js - Enhanced startup script with system checks and menu integration

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class CrestXLauncher {
  constructor() {
    this.systemChecks = {
      node: false,
      dependencies: false,
      config: false,
      permissions: false
    };
  }

  displayBanner() {
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
  ${colors.bright}${colors.white}CrestX Trading Bot v1.1.0${colors.reset}
  ${colors.yellow}Professional Solana Memecoin Trading${colors.reset}
`);
  }

  async performSystemChecks() {
    console.log(`${colors.cyan}🔍 Performing system checks...${colors.reset}\n`);

    // Check Node.js version
    await this.checkNodeVersion();
    
    // Check dependencies
    await this.checkDependencies();
    
    // Check configuration
    await this.checkConfiguration();
    
    // Check file permissions
    await this.checkPermissions();
    
    // Summary
    this.displayCheckSummary();
    
    return Object.values(this.systemChecks).every(check => check);
  }

  async checkNodeVersion() {
    try {
      const version = process.version;
      const major = parseInt(version.split('.')[0].substring(1));
      
      if (major >= 18) {
        this.systemChecks.node = true;
        console.log(`${colors.green}✓${colors.reset} Node.js ${version} (Compatible)`);
      } else {
        console.log(`${colors.red}✗${colors.reset} Node.js ${version} (Requires 18+)`);
        console.log(`  ${colors.yellow}Please upgrade Node.js: https://nodejs.org/${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} Node.js check failed: ${error.message}`);
    }
  }

  async checkDependencies() {
    try {
      // Check if node_modules exists
      if (!fs.existsSync('node_modules')) {
        console.log(`${colors.red}✗${colors.reset} Dependencies not installed`);
        console.log(`  ${colors.yellow}Run: npm install${colors.reset}`);
        return;
      }

      // Check critical dependencies
      const criticalDeps = [
        '@solana/web3.js',
        'telegram',
        'dotenv',
        'readline'
      ];

      let allDepsExist = true;
      for (const dep of criticalDeps) {
        const depPath = path.join('node_modules', dep);
        if (!fs.existsSync(depPath)) {
          console.log(`${colors.red}✗${colors.reset} Missing dependency: ${dep}`);
          allDepsExist = false;
        }
      }

      if (allDepsExist) {
        this.systemChecks.dependencies = true;
        console.log(`${colors.green}✓${colors.reset} All dependencies installed`);
      } else {
        console.log(`  ${colors.yellow}Run: npm install${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} Dependency check failed: ${error.message}`);
    }
  }

  async checkConfiguration() {
    try {
      if (fs.existsSync('.env')) {
        // Try to load and validate config
        require('dotenv').config();
        const config = require('./config');
        
        // Basic validation
        const requiredFields = ['API_ID', 'API_HASH', 'TELEGRAM_CHANNEL_IDS'];
        const missingFields = requiredFields.filter(field => !config[field]);
        
        if (missingFields.length === 0) {
          this.systemChecks.config = true;
          console.log(`${colors.green}✓${colors.reset} Configuration valid`);
          
          // Show mode
          const mode = config.DRY_RUN ? 'Paper Trading' : 'Live Trading';
          const modeColor = config.DRY_RUN ? colors.yellow : colors.red;
          console.log(`  Mode: ${modeColor}${mode}${colors.reset}`);
        } else {
          console.log(`${colors.red}✗${colors.reset} Configuration incomplete`);
          console.log(`  Missing: ${missingFields.join(', ')}`);
          console.log(`  ${colors.yellow}Run setup to configure${colors.reset}`);
        }
      } else {
        console.log(`${colors.red}✗${colors.reset} No configuration found`);
        console.log(`  ${colors.yellow}Run setup to create configuration${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} Configuration check failed: ${error.message}`);
    }
  }

  async checkPermissions() {
    try {
      // Check write permissions
      const testFile = '.permission_test';
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      // Check data directory
      const dataDir = 'data';
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      this.systemChecks.permissions = true;
      console.log(`${colors.green}✓${colors.reset} File permissions OK`);
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} Permission check failed: ${error.message}`);
      console.log(`  ${colors.yellow}Check file system permissions${colors.reset}`);
    }
  }

  displayCheckSummary() {
    const passed = Object.values(this.systemChecks).filter(check => check).length;
    const total = Object.keys(this.systemChecks).length;
    
    console.log(`\n${colors.cyan}📊 System Check Results: ${passed}/${total} passed${colors.reset}`);
    
    if (passed === total) {
      console.log(`${colors.green}✅ All systems ready!${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Some checks failed - please resolve issues above${colors.reset}`);
    }
  }

  async promptUserAction() {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = (question) => {
      return new Promise(resolve => {
        rl.question(question, resolve);
      });
    };

    try {
      console.log(`\n${colors.bright}🚀 What would you like to do?${colors.reset}`);
      console.log(`${colors.white}1.${colors.reset} Start CrestX (if configured)`);
      console.log(`${colors.white}2.${colors.reset} Run Interactive Setup`);
      console.log(`${colors.white}3.${colors.reset} Quick Setup (Recommended for beginners)`);
      console.log(`${colors.white}4.${colors.reset} Install/Update Dependencies`);
      console.log(`${colors.white}5.${colors.reset} System Diagnostics`);
      console.log(`${colors.white}6.${colors.reset} Exit`);

      const choice = await askQuestion(`\n${colors.cyan}Enter your choice (1-6): ${colors.reset}`);
      
      switch (choice.trim()) {
        case '1':
          await this.startCrestX();
          break;
        case '2':
          await this.runSetup();
          break;
        case '3':
          await this.runQuickStart();
          break;
        case '4':
          await this.installDependencies();
          break;
        case '5':
          await this.runDiagnostics();
          break;
        case '6':
          console.log(`${colors.yellow}👋 Goodbye!${colors.reset}`);
          process.exit(0);
          break;
        default:
          console.log(`${colors.red}Invalid choice. Please try again.${colors.reset}`);
          await this.promptUserAction();
      }
    } finally {
      rl.close();
    }
  }

  async startCrestX() {
    if (!this.systemChecks.config) {
      console.log(`${colors.red}❌ Configuration required before starting${colors.reset}`);
      console.log(`${colors.yellow}Please run setup first${colors.reset}`);
      return;
    }

    console.log(`${colors.green}🚀 Starting CrestX...${colors.reset}\n`);
    
    // Start the main application
    const child = spawn('node', ['index.js'], {
      stdio: 'inherit',
      shell: true
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        console.log(`${colors.red}❌ CrestX exited with code ${code}${colors.reset}`);
      }
    });
  }

  async runSetup() {
    console.log(`${colors.cyan}🔧 Starting Interactive Setup...${colors.reset}\n`);
    
    const child = spawn('node', ['setup.js'], {
      stdio: 'inherit',
      shell: true
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`${colors.green}✅ Setup completed successfully!${colors.reset}`);
        setTimeout(() => this.startCrestX(), 2000);
      } else {
        console.log(`${colors.red}❌ Setup failed${colors.reset}`);
      }
    });
  }

  async runQuickStart() {
    console.log(`${colors.cyan}⚡ Starting Quick Setup...${colors.reset}\n`);
    
    const child = spawn('node', ['quickstart.js'], {
      stdio: 'inherit',
      shell: true
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`${colors.green}✅ Quick setup completed!${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ Quick setup failed${colors.reset}`);
      }
    });
  }

  async installDependencies() {
    console.log(`${colors.cyan}📦 Installing/Updating Dependencies...${colors.reset}\n`);
    
    const child = spawn('npm', ['install'], {
      stdio: 'inherit',
      shell: true
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`${colors.green}✅ Dependencies installed successfully!${colors.reset}`);
        this.systemChecks.dependencies = true;
      } else {
        console.log(`${colors.red}❌ Dependency installation failed${colors.reset}`);
      }
    });
  }

  async runDiagnostics() {
    console.log(`${colors.cyan}🔬 Running System Diagnostics...${colors.reset}\n`);
    
    // Extended diagnostics
    await this.performSystemChecks();
    
    // Network connectivity test
    console.log(`\n${colors.cyan}🌐 Testing Network Connectivity...${colors.reset}`);
    await this.testNetworkConnectivity();
    
    // File system test
    console.log(`\n${colors.cyan}💾 Testing File System...${colors.reset}`);
    await this.testFileSystem();
    
    // Memory and system info
    console.log(`\n${colors.cyan}🖥️  System Information:${colors.reset}`);
    this.displaySystemInfo();
  }

  async testNetworkConnectivity() {
    const testUrls = [
      'https://api.mainnet-beta.solana.com',
      'https://api.telegram.org',
      'https://registry.npmjs.org'
    ];

    for (const url of testUrls) {
      try {
        const https = require('https');
        const start = Date.now();
        
        await new Promise((resolve, reject) => {
          const req = https.get(url, (res) => {
            const time = Date.now() - start;
            console.log(`${colors.green}✓${colors.reset} ${url} (${time}ms)`);
            resolve();
          });
          
          req.on('error', reject);
          req.setTimeout(5000, () => reject(new Error('Timeout')));
        });
      } catch (error) {
        console.log(`${colors.red}✗${colors.reset} ${url} (${error.message})`);
      }
    }
  }

  async testFileSystem() {
    const testOperations = [
      { name: 'Create directory', fn: () => {
        if (!fs.existsSync('test_dir')) fs.mkdirSync('test_dir');
      }},
      { name: 'Write file', fn: () => {
        fs.writeFileSync('test_dir/test.txt', 'test');
      }},
      { name: 'Read file', fn: () => {
        fs.readFileSync('test_dir/test.txt', 'utf8');
      }},
      { name: 'Delete file', fn: () => {
        fs.unlinkSync('test_dir/test.txt');
      }},
      { name: 'Remove directory', fn: () => {
        fs.rmdirSync('test_dir');
      }}
    ];

    for (const operation of testOperations) {
      try {
        operation.fn();
        console.log(`${colors.green}✓${colors.reset} ${operation.name}`);
      } catch (error) {
        console.log(`${colors.red}✗${colors.reset} ${operation.name}: ${error.message}`);
      }
    }
  }

  displaySystemInfo() {
    const os = require('os');
    
    console.log(`Platform: ${os.platform()} ${os.arch()}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`);
    console.log(`Free Memory: ${Math.round(os.freemem() / 1024 / 1024)}MB`);
    console.log(`CPU Cores: ${os.cpus().length}`);
    console.log(`Uptime: ${Math.round(os.uptime() / 60)} minutes`);
  }

  async handleErrors() {
    process.on('uncaughtException', (error) => {
      console.error(`${colors.red}❌ Uncaught Exception:${colors.reset}`, error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error(`${colors.red}❌ Unhandled Rejection:${colors.reset}`, reason);
      process.exit(1);
    });

    process.on('SIGINT', () => {
      console.log(`\n${colors.yellow}👋 Shutting down gracefully...${colors.reset}`);
      process.exit(0);
    });
  }

  async start() {
    this.handleErrors();
    this.displayBanner();
    
    const allChecksPass = await this.performSystemChecks();
    
    if (allChecksPass && this.systemChecks.config) {
      // Auto-start if everything is ready
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const askQuestion = (question) => {
        return new Promise(resolve => {
          rl.question(question, resolve);
        });
      };

      try {
        const autoStart = await askQuestion(`\n${colors.green}🚀 All systems ready! Start CrestX now? [Y/n]: ${colors.reset}`);
        
        if (!autoStart.trim() || autoStart.toLowerCase().startsWith('y')) {
          rl.close();
          await this.startCrestX();
          return;
        }
      } finally {
        rl.close();
      }
    }
    
    await this.promptUserAction();
  }
}

// Main execution
if (require.main === module) {
  const launcher = new CrestXLauncher();
  launcher.start().catch(console.error);
}

module.exports = { CrestXLauncher };