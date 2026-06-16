const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../../examples');
const destDir = path.join(__dirname, '../dist/templates');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
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
    const filename = path.basename(src);
    if (filename === 'package.json' || filename === 'package-lock.json') {
      return;
    }
    if (ext === '.js' || ext === '.map') {
      return;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    
    if (filename === 'playwright.config.ts') {
      let content = fs.readFileSync(src, 'utf8');
      // Update testDir: './tests' to testDir: './src/tests'
      content = content.replace("testDir: './tests'", "testDir: './src/tests'");
      fs.writeFileSync(dest, content, 'utf8');
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

// Ensure clean templates directory
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

// Copy pages to templates/src/pages
copyRecursiveSync(path.join(srcDir, 'pages'), path.join(destDir, 'src/pages'));

// Copy tests to templates/src/tests
copyRecursiveSync(path.join(srcDir, 'tests'), path.join(destDir, 'src/tests'));

// Copy config files
copyRecursiveSync(path.join(srcDir, 'playwright.config.ts'), path.join(destDir, 'playwright.config.ts'));
copyRecursiveSync(path.join(srcDir, 'tsconfig.json'), path.join(destDir, 'tsconfig.json'));

console.log('Templates successfully copied to dist/templates/');
