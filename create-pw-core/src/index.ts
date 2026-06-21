#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';
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

const ignoreList = [
  'node_modules',
  'reports',
  'playwright-report',
  'test-results',
  'package-lock.json',
  '.env.example',
  '.git'
];

function copyRecursiveSync(src: string, dest: string) {
  const exists = fs.existsSync(src);
  if (!exists) return;
  const stats = fs.statSync(src);
  const isDirectory = stats.isDirectory();
  const name = path.basename(src);

  if (ignoreList.includes(name)) {
    return;
  }

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
    if (name === 'package.json') {
      return;
    }
    let finalDest = dest;
    if (name === 'gitignore' || name === '.gitignore') {
      finalDest = path.join(path.dirname(dest), '.gitignore');
    } else if (name === 'env' || name === '.env') {
      finalDest = path.join(path.dirname(dest), '.env');
    }
    fs.mkdirSync(path.dirname(finalDest), { recursive: true });
    fs.copyFileSync(src, finalDest);
  }
}

async function main() {
  console.log('\n\x1b[35m============================================\x1b[0m');
  console.log('\x1b[35m      Initializing pw-core Test Suite      \x1b[0m');
  console.log('\x1b[35m============================================\n\x1b[0m');

  const projectPathInput = await question('Project path (default: current directory): ');
  const targetDir = projectPathInput.trim()
    ? path.resolve(process.cwd(), projectPathInput.trim())
    : process.cwd();

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Detect paths and find templates
  const devRepoPath = path.resolve(__dirname, '../..');
  const devRepoPkgPath = path.join(devRepoPath, 'package.json');
  let isDevRepo = false;
  if (fs.existsSync(devRepoPkgPath)) {
    try {
      const devRepoPkg = JSON.parse(fs.readFileSync(devRepoPkgPath, 'utf8'));
      if (devRepoPkg.name === 'pw-core') {
        isDevRepo = true;
      }
    } catch (e) { }
  }

  // Check for latest version on registry to bypass npx cache issues
  const pkgJsonPath = path.join(__dirname, '../package.json');
  if (fs.existsSync(pkgJsonPath) && !isDevRepo) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const currentVersion = pkg.version;
      
      const latestVersion = execSync('npm view create-pw-core version', {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000
      }).toString().trim();

      if (latestVersion && currentVersion !== latestVersion) {
        console.log(`\n\x1b[33mNewer version of create-pw-core found (${latestVersion}). Current: ${currentVersion}\x1b[0m`);
        console.log('\x1b[36mRunning create-pw-core@latest to ensure you have the latest features...\n\x1b[0m');
        
        const args = process.argv.slice(2);
        const child = spawn('npx', ['create-pw-core@latest', ...args], {
          stdio: 'inherit',
          shell: true
        });
        
        await new Promise<void>((resolve) => {
          child.on('close', (code) => {
            rl.close();
            process.exit(code ?? 0);
          });
        });
        return;
      }
    } catch (err) {
      // Offline or network error: continue with the cached version
    }
  }


  let templatesDir = path.join(__dirname, 'templates');
  let templatePkgPath = path.join(templatesDir, 'package.json');
  if (isDevRepo) {
    const srcDir = path.join(devRepoPath, 'examples');
    templatePkgPath = path.join(srcDir, 'package.json');
  }

  let templatePkg: any = {};
  if (fs.existsSync(templatePkgPath)) {
    try {
      templatePkg = JSON.parse(fs.readFileSync(templatePkgPath, 'utf8'));
    } catch (e) {
      console.warn(`Warning: Could not parse template package.json: ${e}`);
    }
  }

  // Ensure package.json exists in the target directory
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log('\nNo package.json found. Initializing a new package...');
    const newPkg = {
      ...templatePkg,
      name: path.basename(targetDir)
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(newPkg, null, 2), 'utf8');
  }

  // Copy templates from create-pw-core package to target directory
  console.log('\nCopying template files...');
  if (isDevRepo) {
    const srcDir = path.join(devRepoPath, 'examples');
    console.log(`\x1b[33mLocal pw-core repository found. Copying templates directly from: ${srcDir}\x1b[0m`);
    copyRecursiveSync(srcDir, targetDir);
  } else {
    if (!fs.existsSync(templatesDir)) {
      console.error(`\x1b[31mError: Templates directory not found at ${templatesDir}\x1b[0m`);
      rl.close();
      process.exit(1);
    }
    copyRecursiveSync(templatesDir, targetDir);
  }
  console.log('\x1b[32mSuccessfully copied template files.\x1b[0m');

  // Update target package.json with dependencies and scripts
  console.log('\nUpdating package.json...');
  const targetPkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Merge description, author, license if target has empty or default ones
  if (!targetPkg.description || targetPkg.description === 'pw-core test suite') {
    targetPkg.description = templatePkg.description || "pw-core test suite";
  }
  if (!targetPkg.author && templatePkg.author) {
    targetPkg.author = templatePkg.author;
  }
  if (!targetPkg.license || targetPkg.license === 'ISC') {
    targetPkg.license = templatePkg.license || "ISC";
  }

  // Merge scripts from template
  targetPkg.scripts = targetPkg.scripts || {};
  if (templatePkg.scripts) {
    for (const [key, val] of Object.entries(templatePkg.scripts)) {
      targetPkg.scripts[key] = val;
    }
  } else {
    targetPkg.scripts['test'] = 'playwright test';
  }

  // Merge dependencies
  targetPkg.dependencies = targetPkg.dependencies || {};
  if (templatePkg.dependencies) {
    for (const [key, val] of Object.entries(templatePkg.dependencies)) {
      targetPkg.dependencies[key] = 'latest';
    }
  }

  // Merge devDependencies
  targetPkg.devDependencies = targetPkg.devDependencies || {};
  if (templatePkg.devDependencies) {
    for (const [key, val] of Object.entries(templatePkg.devDependencies)) {
      if (key !== 'pw-core') {
        targetPkg.devDependencies[key] = 'latest';
      }
    }
  }

  // Check if we are testing locally or installing published package
  let pwCoreInstallSource = 'latest';
  const envInstallLocal = process.env.PW_CORE_INSTALL_LOCAL;

  if (envInstallLocal) {
    // If running in development/local test, use the absolute path to pw-core directory
    pwCoreInstallSource = `file:${envInstallLocal}`;
  } else if (isDevRepo) {
    // Check if running in the development repository
    pwCoreInstallSource = `file:${devRepoPath}`;
  }

  targetPkg.devDependencies['pw-core'] = pwCoreInstallSource;

  fs.writeFileSync(packageJsonPath, JSON.stringify(targetPkg, null, 2), 'utf8');
  console.log('\x1b[32mpackage.json updated.\x1b[0m');

  // Install NPM Packages (automatically accepted, no questions)
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

  // Install Playwright Browsers (automatically accepted, no questions)
  try {
    await runCommand('npx', ['playwright', 'install'], targetDir);
    console.log('\x1b[32mPlaywright browsers installed successfully.\x1b[0m');
  } catch (err) {
    console.error('\x1b[31mFailed to install browsers. Please run npx playwright install manually.\x1b[0m');
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
