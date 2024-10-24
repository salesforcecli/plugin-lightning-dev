const fs = require('fs');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Extract versions
const devServerDependencyVersion = packageJson.dependencies['@lwc/lwc-dev-server'];
const devServerTargetVersion = packageJson.apiVersionMetadata?.target?.matchingDevServerVersion;

if (!devServerDependencyVersion || !devServerTargetVersion) {
  console.error('Error: missing @lwc/lwc-dev-server or matchingDevServerVersion');
  process.exit(1); // Fail the check
}

// Compare versions
if (devServerDependencyVersion === devServerTargetVersion) {
  process.exit(0); // Pass the check
} else {
  console.error(
    `Error: Versions do not match. @lwc/lwc-dev-server: ${devServerDependencyVersion}, matchingDevServerVersion: ${devServerTargetVersion}`
  );
  process.exit(1); // Fail the check
}
