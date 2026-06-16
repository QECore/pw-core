#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const readline = __importStar(require("readline"));
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => {
    return new Promise((resolve) => rl.question(query, resolve));
};
async function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        console.log(`\x1b[36mRunning: ${command} ${args.join(' ')}\x1b[0m`);
        const child = (0, child_process_1.spawn)(command, args, { cwd, stdio: ['ignore', 'inherit', 'inherit'], shell: true });
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });
    });
}
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    if (!exists)
        return;
    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    }
    else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
}
async function main() {
    console.log('\n\x1b[35m============================================\x1b[0m');
    console.log('\x1b[35m      Initializing pw-core Test Suite      \x1b[0m');
    console.log('\x1b[35m============================================\n\x1b[0m');
    const targetDir = process.cwd();
    const isYes = process.argv.includes('-y') || process.argv.includes('--yes');
    // 1. Ask for confirmation
    if (!isYes) {
        const confirm = await question('This will initialize a pw-core test suite in the current directory. Continue? (Y/n): ');
        if (confirm.trim().toLowerCase() === 'n') {
            console.log('Initialization cancelled.');
            rl.close();
            process.exit(0);
        }
    }
    // 2. Ensure package.json exists in the target directory
    const packageJsonPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        console.log('\nNo package.json found. Initializing a new package...');
        fs.writeFileSync(packageJsonPath, JSON.stringify({
            name: path.basename(targetDir),
            version: "1.0.0",
            description: "pw-core test suite",
            main: "index.js",
            scripts: {},
            keywords: [],
            author: "",
            license: "ISC"
        }, null, 2), 'utf8');
    }
    // 3. Copy templates from create-pw-core package to target directory
    console.log('\nCopying template files...');
    const templatesDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templatesDir)) {
        console.error(`\x1b[31mError: Templates directory not found at ${templatesDir}\x1b[0m`);
        rl.close();
        process.exit(1);
    }
    copyRecursiveSync(templatesDir, targetDir);
    console.log('\x1b[32mSuccessfully copied template files.\x1b[0m');
    // 4. Update target package.json with dependencies and scripts
    console.log('\nUpdating package.json...');
    const targetPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    targetPkg.scripts = targetPkg.scripts || {};
    targetPkg.scripts['test'] = 'playwright test';
    targetPkg.devDependencies = targetPkg.devDependencies || {};
    // Check if we are testing locally or installing published package
    let pwCoreInstallSource = '^0.0.1';
    const envInstallLocal = process.env.PW_CORE_INSTALL_LOCAL;
    if (envInstallLocal) {
        // If running in development/local test, use the absolute path to pw-core directory
        pwCoreInstallSource = `file:${envInstallLocal}`;
    }
    else {
        // Check if running in the development repository
        const devRepoPath = path.resolve(__dirname, '../..');
        const devRepoPkgPath = path.join(devRepoPath, 'package.json');
        if (fs.existsSync(devRepoPkgPath)) {
            try {
                const devRepoPkg = JSON.parse(fs.readFileSync(devRepoPkgPath, 'utf8'));
                if (devRepoPkg.name === 'pw-core') {
                    pwCoreInstallSource = `file:${devRepoPath}`;
                    console.log(`\n\x1b[33mDev repository detected. Installing pw-core from local path: ${devRepoPath}\x1b[0m`);
                }
            }
            catch (e) {
                // Ignore parsing errors
            }
        }
    }
    targetPkg.devDependencies['pw-core'] = pwCoreInstallSource;
    targetPkg.devDependencies['@playwright/test'] = '^1.61.0';
    targetPkg.devDependencies['typescript'] = '^5.3.3';
    fs.writeFileSync(packageJsonPath, JSON.stringify(targetPkg, null, 2), 'utf8');
    console.log('\x1b[32mpackage.json updated.\x1b[0m');
    // 5. Install NPM Packages
    let shouldInstallDeps = true;
    if (!isYes) {
        const installDeps = await question('\nWould you like to install the required packages (pw-core, Playwright, TypeScript)? (Y/n): ');
        if (installDeps.trim().toLowerCase() === 'n') {
            shouldInstallDeps = false;
        }
    }
    if (shouldInstallDeps) {
        // Determine package manager (npm, yarn, pnpm)
        let pkgManager = 'npm';
        let installArgs = ['install'];
        if (fs.existsSync(path.join(targetDir, 'pnpm-lock.yaml'))) {
            pkgManager = 'pnpm';
        }
        else if (fs.existsSync(path.join(targetDir, 'yarn.lock'))) {
            pkgManager = 'yarn';
        }
        try {
            await runCommand(pkgManager, installArgs, targetDir);
            console.log('\x1b[32mPackages installed successfully.\x1b[0m');
        }
        catch (err) {
            console.error('\x1b[31mFailed to install packages. Please run npm install manually.\x1b[0m');
        }
    }
    // 6. Install Playwright Browsers
    let shouldInstallBrowsers = true;
    if (!isYes) {
        const installBrowsers = await question('\nWould you like to install the Playwright browsers? (Y/n): ');
        if (installBrowsers.trim().toLowerCase() === 'n') {
            shouldInstallBrowsers = false;
        }
    }
    if (shouldInstallBrowsers) {
        try {
            await runCommand('npx', ['playwright', 'install'], targetDir);
            console.log('\x1b[32mPlaywright browsers installed successfully.\x1b[0m');
        }
        catch (err) {
            console.error('\x1b[31mFailed to install browsers. Please run npx playwright install manually.\x1b[0m');
        }
    }
    console.log('\n\x1b[32;1m============================================\x1b[0m');
    console.log('\x1b[32;1m      Initialization Completed!             \x1b[0m');
    console.log('\x1b[32;1m============================================\x1b[0m');
    console.log('\nTo run your tests, execute:');
    console.log('\x1b[36m  npm run test\x1b[0m\n');
    rl.close();
}
main().catch((err) => {
    console.error('\nAn error occurred during initialization:', err);
    rl.close();
    process.exit(1);
});
