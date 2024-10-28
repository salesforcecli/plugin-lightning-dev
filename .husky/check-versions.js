import fs from 'node:fs';

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
    `Error: @lwc/lwc-dev-server versions do not match between 'dependencies' and 'apiVersionMetadata' in package.json. Expected ${devServerDependencyVersion} in apiVersionMetadata > target > matchingDevServerVersion. Got ${devServerTargetVersion} instead. When updating the @lwc/lwc-dev-server dependency, you must ensure that it is compatible with the supported API version in this branch, then update apiVersionMetadata > target > matchingDevServerVersion to match, in order to "sign off" on this dependency change.`
  );
  process.exit(1); // Fail the check
}
