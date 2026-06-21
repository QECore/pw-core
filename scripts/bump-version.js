const fs = require('fs');
const path = require('path');

const type = process.argv[2];
if (!['major', 'minor', 'critical'].includes(type)) {
  console.error('Usage: node bump-version.js [major|minor|critical]');
  process.exit(1);
}

// 1. Read package.json
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;

// 2. Parse and increment version
const parts = oldVersion.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Invalid version format in package.json: ${oldVersion}`);
  process.exit(1);
}

let [major, minor, patch] = parts;
if (type === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (type === 'minor') {
  minor += 1;
  patch = 0;
} else if (type === 'critical') {
  patch += 1;
}

const newVersion = `${major}.${minor}.${patch}`;
console.log(`Bumping version from ${oldVersion} to ${newVersion}...`);

// 3. Write package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// 4. Write package-lock.json if it exists
const lockPath = path.join(__dirname, '..', 'package-lock.json');
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = newVersion;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = newVersion;
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
}

// 4.1 Write create-pw-core/package.json and its lock file
const createPkgPath = path.join(__dirname, '..', 'create-pw-core', 'package.json');
if (fs.existsSync(createPkgPath)) {
  const createPkg = JSON.parse(fs.readFileSync(createPkgPath, 'utf8'));
  createPkg.version = newVersion;
  fs.writeFileSync(createPkgPath, JSON.stringify(createPkg, null, 2) + '\n', 'utf8');
  console.log(`Updated create-pw-core version to ${newVersion}`);
}

const createLockPath = path.join(__dirname, '..', 'create-pw-core', 'package-lock.json');
if (fs.existsSync(createLockPath)) {
  const createLock = JSON.parse(fs.readFileSync(createLockPath, 'utf8'));
  createLock.version = newVersion;
  if (createLock.packages && createLock.packages['']) {
    createLock.packages[''].version = newVersion;
  }
  fs.writeFileSync(createLockPath, JSON.stringify(createLock, null, 2) + '\n', 'utf8');
  console.log(`Updated create-pw-core/package-lock.json version to ${newVersion}`);
}


// 5. Handle release markdown file renaming
const releasesDir = path.join(__dirname, '..', 'releases');
const oldReleaseFile = path.join(releasesDir, `v${oldVersion}.md`);
const newReleaseFile = path.join(releasesDir, `v${newVersion}.md`);

if (fs.existsSync(oldReleaseFile)) {
  fs.renameSync(oldReleaseFile, newReleaseFile);
  console.log(`Renamed release doc: releases/v${oldVersion}.md -> releases/v${newVersion}.md`);
  
  // Update version header inside the file
  let docContent = fs.readFileSync(newReleaseFile, 'utf8');
  docContent = docContent.split(`v${oldVersion}`).join(`v${newVersion}`);
  fs.writeFileSync(newReleaseFile, docContent, 'utf8');
  console.log(`Updated version header inside releases/v${newVersion}.md`);
} else {
  // If old release doc doesn't exist, create a new one
  fs.writeFileSync(newReleaseFile, `# pw-core Documentation (v${newVersion})\n\nRelease notes for v${newVersion} go here.`, 'utf8');
  console.log(`Created new release doc: releases/v${newVersion}.md`);
}

// 6. Update references in README.md
const readmePath = path.join(__dirname, '..', 'README.md');
if (fs.existsSync(readmePath)) {
  let readme = fs.readFileSync(readmePath, 'utf8');
  const oldRef = `releases/v${oldVersion}.md`;
  const newRef = `releases/v${newVersion}.md`;
  if (readme.includes(oldRef)) {
    readme = readme.split(oldRef).join(newRef);
    fs.writeFileSync(readmePath, readme, 'utf8');
    console.log(`Updated release guide link in README.md to v${newVersion}.md`);
  }
}

console.log('Version bump completed successfully.');
