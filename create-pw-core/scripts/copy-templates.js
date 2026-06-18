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

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// Ensure clean templates directory
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

// Copy everything recursively
copyRecursiveSync(srcDir, destDir);

console.log('Templates successfully copied to dist/templates/');
