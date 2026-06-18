const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../../examples');
const destDir = path.join(__dirname, '../dist/templates');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  if (!exists) return;
  const stats = fs.statSync(src);
  const isDirectory = stats.isDirectory();
  const name = path.basename(src);

  // Exclude list
  if (name === 'node_modules' ||
    name === 'reports' ||
    name === 'playwright-report' ||
    name === 'test-results' ||
    name === 'package-lock.json' ||
    name === '.env.example' ||
    name === '.git') {
    return;
  }


  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    // If it's a file, copy it.
    const ext = path.extname(src);
    if (ext === '.js' || ext === '.map') {
      return;
    }

    let finalDest = dest;
    if (name === '.gitignore') {
      finalDest = path.join(path.dirname(dest), 'gitignore');
    } else if (name === '.env') {
      finalDest = path.join(path.dirname(dest), 'env');
    }

    fs.mkdirSync(path.dirname(finalDest), { recursive: true });
    fs.copyFileSync(src, finalDest);
  }
}

// Ensure clean templates directory
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

// Copy everything recursively
copyRecursiveSync(srcDir, destDir);

// Update dist/templates/package.json with correct pw-core version
const templatePkgPath = path.join(destDir, 'package.json');
if (fs.existsSync(templatePkgPath)) {
  const rootPkgPath = path.join(__dirname, '../../package.json');
  if (fs.existsSync(rootPkgPath)) {
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    const pwCoreVersion = `^${rootPkg.version}`;
    const templatePkg = JSON.parse(fs.readFileSync(templatePkgPath, 'utf8'));
    if (templatePkg.devDependencies && templatePkg.devDependencies['pw-core']) {
      templatePkg.devDependencies['pw-core'] = pwCoreVersion;
      fs.writeFileSync(templatePkgPath, JSON.stringify(templatePkg, null, 2), 'utf8');
      console.log(`Updated pw-core version in template package.json to: ${pwCoreVersion}`);
    }
  }
}

console.log('Templates successfully copied to dist/templates/');
