#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\x1b[36mRunning: ${command} ${args.join(' ')}\x1b[0m`);
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'inherit', 'inherit'], shell: true });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

function copyRecursiveSync(src: string, dest: string) {
  const exists = fs.existsSync(src);
  if (!exists) return;
  const stats = fs.statSync(src);
  const isDirectory = stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    const ext = path.extname(src);
    const filename = path.basename(src);
    if (filename === 'package.json' || filename === 'package-lock.json') {
      return;
    }
    if (ext === '.js' || ext === '.map') {
      return;
    }
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
  let templatesDir = path.join(__dirname, 'templates');
  
  // If we are in dev repo, read templates directly from examples/ to get the latest files immediately
  const devRepoPath = path.resolve(__dirname, '../..');
  const devRepoPkgPath = path.join(devRepoPath, 'package.json');
  let isDevRepo = false;
  if (fs.existsSync(devRepoPkgPath)) {
    try {
      const devRepoPkg = JSON.parse(fs.readFileSync(devRepoPkgPath, 'utf8'));
      if (devRepoPkg.name === 'pw-core') {
        isDevRepo = true;
      }
    } catch (e) {}
  }

  // Look for local pw-core/examples on the user's machine
  let localExamplesDir: string | null = null;
  if (!isDevRepo) {
    let current = targetDir;
    while (true) {
      const candidate = path.join(current, 'pw-core', 'examples');
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        localExamplesDir = candidate;
        break;
      }
      const siblingCandidate = path.join(current, '..', 'pw-core', 'examples');
      if (fs.existsSync(siblingCandidate) && fs.statSync(siblingCandidate).isDirectory()) {
        localExamplesDir = siblingCandidate;
        break;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }

    if (!localExamplesDir) {
      const hardcodedPaths = [
        'z:/QECore/pw-core/examples',
        'Z:/QECore/pw-core/examples'
      ];
      for (const p of hardcodedPaths) {
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
          localExamplesDir = p;
          break;
        }
      }
    }
  }

  if (isDevRepo || localExamplesDir) {
    const srcDir = isDevRepo ? path.join(devRepoPath, 'examples') : localExamplesDir!;
    console.log(`\x1b[33mLocal pw-core repository found. Copying templates directly from: ${srcDir}\x1b[0m`);
    // Copy pages -> src/pages
    copyRecursiveSync(path.join(srcDir, 'pages'), path.join(targetDir, 'src/pages'));
    // Copy tests -> src/tests
    copyRecursiveSync(path.join(srcDir, 'tests'), path.join(targetDir, 'src/tests'));
    // Copy config files
    copyRecursiveSync(path.join(srcDir, 'playwright.config.ts'), path.join(targetDir, 'playwright.config.ts'));
    copyRecursiveSync(path.join(srcDir, 'tsconfig.json'), path.join(targetDir, 'tsconfig.json'));
  } else {
    if (!fs.existsSync(templatesDir)) {
      console.error(`\x1b[31mError: Templates directory not found at ${templatesDir}\x1b[0m`);
      rl.close();
      process.exit(1);
    }
    copyRecursiveSync(templatesDir, targetDir);
  }
  console.log('\x1b[32mSuccessfully copied template files.\x1b[0m');

  // 4. Update target package.json with dependencies and scripts
  console.log('\nUpdating package.json...');
  const targetPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  targetPkg.scripts = targetPkg.scripts || {};
  targetPkg.scripts['test'] = 'playwright test';

  targetPkg.devDependencies = targetPkg.devDependencies || {};
  
  // Check if we are testing locally or installing published package
  let pwCoreInstallSource = '^1.0.0';
  const envInstallLocal = process.env.PW_CORE_INSTALL_LOCAL;

  if (envInstallLocal) {
    // If running in development/local test, use the absolute path to pw-core directory
    pwCoreInstallSource = `file:${envInstallLocal}`;
  } else {
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
      } catch (e) {
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
    } else if (fs.existsSync(path.join(targetDir, 'yarn.lock'))) {
      pkgManager = 'yarn';
    }

    try {
      await runCommand(pkgManager, installArgs, targetDir);
      console.log('\x1b[32mPackages installed successfully.\x1b[0m');
    } catch (err) {
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
    } catch (err) {
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
