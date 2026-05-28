const fs = require('fs');
const { execSync } = require('child_process');

const validBumps = ['patch', 'minor', 'major'];
const bump = process.argv[2];

if (!validBumps.includes(bump)) {
  console.error(`Usage: node scripts/version-bump.js <${validBumps.join('|')}>`);
  process.exit(1);
}

// Read current version from package.json
const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);

// Calculate new version
let newVersion;
switch (bump) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

console.log(`Bumping version: ${pkg.version} → ${newVersion} (${bump})`);

// Update package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ Updated package.json`);

// Update app.json
const appPath = './app.json';
const appJson = JSON.parse(fs.readFileSync(appPath, 'utf8'));
appJson.expo.version = newVersion;
fs.writeFileSync(appPath, JSON.stringify(appJson, null, 2) + '\n');
console.log(`✅ Updated app.json`);

// Git commit and tag
execSync(`git add package.json app.json`, { stdio: 'inherit' });
execSync(`git commit -m "chore: bump version to v${newVersion}"`, { stdio: 'inherit' });
execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });
console.log(`✅ Created git tag v${newVersion}`);
console.log(`\nRun 'git push && git push --tags' to publish the release.`);
