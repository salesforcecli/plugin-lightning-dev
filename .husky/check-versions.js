import fs from 'node:fs';
import semver from 'semver';

const SFDX_LOCAL_DEV_DIST_BASE = '@lwc/sfdx-local-dev-dist';
const SFDX_LOCAL_DEV_DIST_PATTERN = /^@lwc\/sfdx-local-dev-dist-([\d.]+)$/;

/**
 * This script ensures that the aliased dependencies in package.json stay in sync
 * with the versions defined in apiVersionMetadata.
 * It also ensures @lwc/sfdx-local-dev-dist matches the version of the highest-numbered
 * @lwc/sfdx-local-dev-dist-<number> alias.
 */

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const apiVersionMetadata = packageJson.apiVersionMetadata;

if (!apiVersionMetadata) {
  console.error('Error: missing apiVersionMetadata in package.json');
  process.exit(1);
}

let hasError = false;

// Check that @lwc/sfdx-local-dev-dist version matches the highest-numbered alias
const baseVersion = packageJson.dependencies[SFDX_LOCAL_DEV_DIST_BASE];
if (baseVersion) {
  const aliasedDeps = Object.keys(packageJson.dependencies).filter((key) => SFDX_LOCAL_DEV_DIST_PATTERN.test(key));
  if (aliasedDeps.length > 0) {
    const highestAlias = aliasedDeps
      .map((key) => {
        const m = key.match(SFDX_LOCAL_DEV_DIST_PATTERN);
        return { key, number: m ? parseFloat(m[1]) : -1 };
      })
      .sort((a, b) => b.number - a.number)[0];

    const highestAliasValue = packageJson.dependencies[highestAlias.key];
    const highestMatch = highestAliasValue?.match(/@([^@]+)$/);
    const highestRange = highestMatch ? highestMatch[1] : null;

    if (!highestRange) {
      console.error(`Error: Could not parse version range from '${highestAlias.key}': ${highestAliasValue}`);
      hasError = true;
    } else if (baseVersion !== highestRange) {
      console.error(
        `Error: Version of '${SFDX_LOCAL_DEV_DIST_BASE}' (${baseVersion}) must be the same as the version of the highest-numbered alias '${highestAlias.key}' (${highestRange}).`,
      );
      hasError = true;
    }
  }
}

// Iterate through each API version defined in metadata
for (const [apiVersion, metadata] of Object.entries(apiVersionMetadata)) {
  const expectedDeps = metadata.dependencies;
  if (!expectedDeps) continue;

  for (const [depName, expectedRange] of Object.entries(expectedDeps)) {
    // For each dependency in metadata, find its aliased counterpart in package.json dependencies
    // e.g. @lwc/lwc-dev-server -> @lwc/lwc-dev-server-65.0
    const aliasName = `${depName}-${apiVersion}`;
    const actualAliasValue = packageJson.dependencies[aliasName];

    if (!actualAliasValue) {
      console.error(`Error: Missing aliased dependency '${aliasName}' in package.json for API version ${apiVersion}`);
      hasError = true;
      continue;
    }

    // actualAliasValue looks like "npm:@lwc/lwc-dev-server@~13.2.x" or "npm:lwc@~8.23.x"
    // We want to extract the version range after the last @
    const match = actualAliasValue.match(/@([^@]+)$/);
    if (!match) {
      console.error(`Error: Could not parse version range from aliased dependency '${aliasName}': ${actualAliasValue}`);
      hasError = true;
      continue;
    }

    const actualRange = match[1];

    // Compare the range in metadata with the range in the aliased dependency
    if (!semver.intersects(expectedRange, actualRange)) {
      console.error(
        `Error: Version mismatch for '${aliasName}'. ` +
          `Expected ${expectedRange} in apiVersionMetadata, but found ${actualRange} in dependencies.`,
      );
      hasError = true;
    }
  }
}

if (hasError) {
  console.error(
    '\nWhen updating LWC dependencies, you must ensure that the versions in apiVersionMetadata match the aliased dependencies in package.json.',
  );
  process.exit(1);
}

process.exit(0);
