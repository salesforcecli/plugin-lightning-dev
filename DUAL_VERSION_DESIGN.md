# Design Proposal: Dual Version Support via NPM Aliasing

## Problem Statement

Currently, users must install the specific version of `@salesforce/plugin-lightning-dev` that matches their org's API version. This is because the plugin depends on specific versions of:

- `@lwc/lwc-dev-server`
- `@lwc/sfdc-lwc-compiler`
- `lwc`

These dependencies must match (at least in major/minor versions) the LWC runtime version running in the user's org. Since only 2 Salesforce org versions exist at any given time (Latest and Prerelease), we can support both simultaneously in a single plugin installation using NPM aliasing.

## Goals

1. **Eliminate version switching**: Users should be able to use a single plugin installation for both Latest and Prerelease orgs
2. **Automatic version detection**: Plugin should automatically determine which org version is being connected to
3. **Transparent operation**: User should not need to know or care about which dependency version is being used
4. **Maintainable**: Solution should be easy to update as new versions are released

## Proposed Solution: NPM Aliasing with Runtime Branching

### Overview

Use NPM package aliasing to install two versions of each critical dependency side-by-side, then dynamically import the correct version at runtime based on the detected org API version.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Command                          │
│                  sf lightning dev component                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Org Connection Established                 │
│              OrgUtils.getOrgAPIVersion(connection)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Version Resolution (NEW)                        │
│    VersionResolver.resolveVersionChannel(apiVersion)         │
│         Returns: 'latest' | 'prerelease'                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          Dynamic Dependency Loading (NEW)                    │
│     DependencyLoader.loadLwcServer(channel)                  │
│  Imports from: @lwc/lwc-dev-server-{channel}                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 LWC Server Started                           │
│           Using correct version for org                      │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. NPM Aliasing in package.json

Update the dependencies section to include aliased versions:

```json
{
  "dependencies": {
    // Latest release versions (e.g., API 64.0)
    "@lwc/lwc-dev-server-latest": "npm:@lwc/lwc-dev-server@~13.1.x",
    "@lwc/sfdc-lwc-compiler-latest": "npm:@lwc/sfdc-lwc-compiler@~13.1.x",
    "lwc-latest": "npm:lwc@~8.22.x",

    // Prerelease versions (e.g., API 65.0)
    "@lwc/lwc-dev-server-prerelease": "npm:@lwc/lwc-dev-server@~13.2.x",
    "@lwc/sfdc-lwc-compiler-prerelease": "npm:@lwc/sfdc-lwc-compiler@~13.2.x",
    "lwc-prerelease": "npm:lwc@~8.23.x",

    // Other dependencies remain unchanged
    "@inquirer/prompts": "^5.3.8"
    // ... etc
  }
}
```

**Key Points:**

- Package aliases use a `-latest` and `-prerelease` suffix
- The actual package versions are specified after `npm:`
- Both versions are always installed in `node_modules`

### 2. Enhanced API Version Metadata

Expand the `apiVersionMetadata` in `package.json` to include channel information:

```json
{
  "apiVersionMetadata": {
    "channels": {
      "latest": {
        "supportedApiVersions": ["64.0"],
        "dependencies": {
          "@lwc/lwc-dev-server": "~13.1.x",
          "@lwc/sfdc-lwc-compiler": "~13.1.x",
          "lwc": "~8.22.x"
        }
      },
      "prerelease": {
        "supportedApiVersions": ["65.0", "66.0"],
        "dependencies": {
          "@lwc/lwc-dev-server": "~13.2.x",
          "@lwc/sfdc-lwc-compiler": "~13.2.x",
          "lwc": "~8.23.x"
        }
      }
    },
    "defaultChannel": "latest",
    "versionToTagMappings": [
      // Keep existing mappings for backward compatibility docs
    ]
  }
}
```

### 3. New Module: VersionResolver

Create `src/shared/versionResolver.ts`:

```typescript
/**
 * Resolves org API version to appropriate dependency channel
 */
export type VersionChannel = 'latest' | 'prerelease';

export interface ChannelConfig {
  supportedApiVersions: string[];
  dependencies: {
    [key: string]: string;
  };
}

export class VersionResolver {
  private static channelMetadata: Map<VersionChannel, ChannelConfig> | null = null;

  /**
   * Loads channel metadata from package.json
   */
  private static loadChannelMetadata(): Map<VersionChannel, ChannelConfig> {
    if (this.channelMetadata) {
      return this.channelMetadata;
    }

    const packageJson = this.getPackageJson();
    const channels = packageJson.apiVersionMetadata.channels;

    this.channelMetadata = new Map();
    for (const [channel, config] of Object.entries(channels)) {
      this.channelMetadata.set(channel as VersionChannel, config as ChannelConfig);
    }

    return this.channelMetadata;
  }

  /**
   * Given an org API version, returns the appropriate channel
   *
   * @param orgApiVersion - The API version from the org (e.g., "65.0")
   * @returns The channel to use ('latest' or 'prerelease')
   * @throws Error if the API version is not supported by any channel
   */
  public static resolveChannel(orgApiVersion: string): VersionChannel {
    const channels = this.loadChannelMetadata();

    for (const [channel, config] of channels.entries()) {
      if (config.supportedApiVersions.includes(orgApiVersion)) {
        return channel;
      }
    }

    // If no exact match, try to find by major.minor comparison
    const orgMajorMinor = this.getMajorMinor(orgApiVersion);
    for (const [channel, config] of channels.entries()) {
      for (const supportedVersion of config.supportedApiVersions) {
        if (this.getMajorMinor(supportedVersion) === orgMajorMinor) {
          return channel;
        }
      }
    }

    throw new Error(
      `Unsupported org API version: ${orgApiVersion}. ` + `This plugin supports: ${this.getSupportedVersionsList()}`
    );
  }

  /**
   * Extracts major.minor from a version string (e.g., "65.0" from "65.0.1")
   */
  private static getMajorMinor(version: string): string {
    const parts = version.split('.');
    return `${parts[0]}.${parts[1]}`;
  }

  /**
   * Returns a formatted list of all supported API versions
   */
  private static getSupportedVersionsList(): string {
    const channels = this.loadChannelMetadata();
    const allVersions: string[] = [];

    for (const config of channels.values()) {
      allVersions.push(...config.supportedApiVersions);
    }

    return allVersions.join(', ');
  }

  /**
   * Returns the default channel from package.json
   */
  public static getDefaultChannel(): VersionChannel {
    const packageJson = this.getPackageJson();
    return packageJson.apiVersionMetadata.defaultChannel as VersionChannel;
  }

  private static getPackageJson(): any {
    // Implementation similar to OrgUtils.ensureMatchingAPIVersion
    const dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const packageJsonFilePath = path.resolve(dirname, '../../package.json');
    return CommonUtils.loadJsonFromFile(packageJsonFilePath);
  }
}
```

### 4. New Module: DependencyLoader

Create `src/shared/dependencyLoader.ts`:

```typescript
import type { LWCServer, ServerConfig, Workspace } from '@lwc/lwc-dev-server';
import type { VersionChannel } from './versionResolver.js';

/**
 * Interface for dynamically loaded LWC server module
 */
interface LwcDevServerModule {
  startLwcDevServer: (config: ServerConfig, logger: any) => Promise<LWCServer>;
  LWCServer: typeof LWCServer;
  ServerConfig: typeof ServerConfig;
  Workspace: typeof Workspace;
}

/**
 * Dynamically loads LWC dependencies based on version channel
 */
export class DependencyLoader {
  private static loadedModules: Map<VersionChannel, LwcDevServerModule> = new Map();

  /**
   * Loads the LWC dev server module for the specified channel
   * Uses dynamic import to load the aliased package at runtime
   *
   * @param channel - The version channel ('latest' or 'prerelease')
   * @returns The loaded module
   */
  public static async loadLwcDevServer(channel: VersionChannel): Promise<LwcDevServerModule> {
    // Check cache first
    if (this.loadedModules.has(channel)) {
      return this.loadedModules.get(channel)!;
    }

    // Construct the aliased package name
    const packageName = `@lwc/lwc-dev-server-${channel}`;

    try {
      // Dynamic import of the aliased package
      const module = (await import(packageName)) as LwcDevServerModule;
      this.loadedModules.set(channel, module);
      return module;
    } catch (error) {
      throw new Error(
        `Failed to load LWC dev server for channel '${channel}'. ` +
          `Package '${packageName}' could not be imported. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Loads the LWC compiler module for the specified channel
   *
   * @param channel - The version channel ('latest' or 'prerelease')
   * @returns The loaded compiler module
   */
  public static async loadLwcCompiler(channel: VersionChannel): Promise<any> {
    const packageName = `@lwc/sfdc-lwc-compiler-${channel}`;

    try {
      return await import(packageName);
    } catch (error) {
      throw new Error(
        `Failed to load LWC compiler for channel '${channel}'. ` +
          `Package '${packageName}' could not be imported. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Loads the base LWC module for the specified channel
   *
   * @param channel - The version channel ('latest' or 'prerelease')
   * @returns The loaded LWC module
   */
  public static async loadLwc(channel: VersionChannel): Promise<any> {
    const packageName = `lwc-${channel}`;

    try {
      return await import(packageName);
    } catch (error) {
      throw new Error(
        `Failed to load LWC for channel '${channel}'. ` +
          `Package '${packageName}' could not be imported. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Clears the module cache (useful for testing)
   */
  public static clearCache(): void {
    this.loadedModules.clear();
  }
}
```

### 5. Updated OrgUtils

Modify `src/shared/orgUtils.ts` to replace `ensureMatchingAPIVersion`:

```typescript
/**
 * Determines the version channel for the connected org
 *
 * @param connection - The connection to the org
 * @returns The version channel to use for dependencies
 * @throws Error if the org version is not supported
 */
public static getVersionChannel(connection: Connection): VersionChannel {
  // Testing purposes only - using this flag will return default channel
  if (process.env.SKIP_API_VERSION_CHECK === 'true') {
    return VersionResolver.getDefaultChannel();
  }

  const orgVersion = connection.version;

  try {
    return VersionResolver.resolveChannel(orgVersion);
  } catch (error) {
    // Enhance error with helpful message
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n` +
      `Your org is on API version ${orgVersion}. ` +
      `Please ensure you are using the correct version of the CLI and this plugin.`
    );
  }
}

// Keep the old method but mark as deprecated for now
/** @deprecated Use getVersionChannel instead */
public static ensureMatchingAPIVersion(connection: Connection): void {
  // Implementation can call getVersionChannel and throw if it fails
  this.getVersionChannel(connection);
}
```

### 6. Updated LWC Server Initialization

Modify `src/lwc-dev-server/index.ts`:

```typescript
import { Connection } from '@salesforce/core';
import { OrgUtils } from '../shared/orgUtils.js';
import { DependencyLoader } from '../shared/dependencyLoader.js';
import type { VersionChannel } from '../shared/versionResolver.js';

export async function startLWCServer(
  logger: Logger,
  connection: Connection, // NEW: pass connection to determine version
  rootDir: string,
  token: string,
  clientType: string,
  serverPorts?: { httpPort: number; httpsPort: number },
  certData?: SSLCertificateData,
  workspace?: Workspace
): Promise<LWCServer> {
  // NEW: Determine which version channel to use
  const channel: VersionChannel = OrgUtils.getVersionChannel(connection);
  logger.trace(`Using version channel: ${channel}`);

  // NEW: Load the appropriate version of the dev server
  const lwcDevServerModule = await DependencyLoader.loadLwcDevServer(channel);

  const config = await createLWCServerConfig(rootDir, token, clientType, serverPorts, certData, workspace);

  logger.trace(`Starting LWC Dev Server with config: ${JSON.stringify(config)}`);

  // Use the dynamically loaded startLwcDevServer function
  let lwcDevServer: LWCServer | null = await lwcDevServerModule.startLwcDevServer(config, logger);

  const cleanup = (): void => {
    if (lwcDevServer) {
      logger.trace('Stopping LWC Dev Server');
      lwcDevServer.stopServer();
      lwcDevServer = null;
    }
  };

  // ... rest of the function remains the same
}
```

### 7. Update Command Files

Each command (app.ts, component.ts, site.ts) needs to pass the connection to startLWCServer:

```typescript
// In src/commands/lightning/dev/component.ts (and similar for app.ts, site.ts)

public async run(): Promise<void> {
  const { flags } = await this.parse(Component);

  // ... existing code to get connection
  const conn = flags['target-org'].getConnection();

  // Remove or comment out the old API version check
  // OrgUtils.ensureMatchingAPIVersion(conn);

  // ... existing code

  // Pass connection to startLWCServer (it will determine version internally)
  const server = await startLWCServer(
    this.logger,
    conn, // NEW: pass connection
    projectDir,
    identityToken,
    'sfdx-component',
    // ... rest of parameters
  );
}
```

## TypeScript Considerations

### Type Definitions

Since we're using aliased packages, TypeScript needs to know about them:

**Option A: Use `declare module` (Simpler)**

Create `src/types/aliased-deps.d.ts`:

```typescript
// Declare aliased LWC dev server packages as having same types as base package
declare module '@lwc/lwc-dev-server-latest' {
  export * from '@lwc/lwc-dev-server';
}

declare module '@lwc/lwc-dev-server-prerelease' {
  export * from '@lwc/lwc-dev-server';
}

declare module '@lwc/sfdc-lwc-compiler-latest' {
  export * from '@lwc/sfdc-lwc-compiler';
}

declare module '@lwc/sfdc-lwc-compiler-prerelease' {
  export * from '@lwc/sfdc-lwc-compiler';
}

declare module 'lwc-latest' {
  export * from 'lwc';
}

declare module 'lwc-prerelease' {
  export * from 'lwc';
}
```

**Option B: Use TypeScript Path Mapping (More explicit)**

In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@lwc/lwc-dev-server-latest": ["./node_modules/@lwc/lwc-dev-server"],
      "@lwc/lwc-dev-server-prerelease": ["./node_modules/@lwc/lwc-dev-server"],
      "@lwc/sfdc-lwc-compiler-latest": ["./node_modules/@lwc/sfdc-lwc-compiler"],
      "@lwc/sfdc-lwc-compiler-prerelease": ["./node_modules/@lwc/sfdc-lwc-compiler"],
      "lwc-latest": ["./node_modules/lwc"],
      "lwc-prerelease": ["./node_modules/lwc"]
    }
  }
}
```

**Recommendation**: Use Option A (declare module) as it's simpler and doesn't affect the build output.

## Testing Strategy

### Unit Tests

1. **VersionResolver Tests** (`test/shared/versionResolver.test.ts`):

   - Test channel resolution for each supported API version
   - Test error handling for unsupported versions
   - Test major.minor version matching
   - Test default channel retrieval

2. **DependencyLoader Tests** (`test/shared/dependencyLoader.test.ts`):

   - Test loading each channel's dependencies
   - Test caching behavior
   - Test error handling for missing packages
   - Mock dynamic imports to avoid actual package loading

3. **OrgUtils Tests** (update existing):
   - Test `getVersionChannel` with various API versions
   - Test with `SKIP_API_VERSION_CHECK` env var

### Integration Tests (NUTs)

1. **Dual Version Tests** (`test/commands/lightning/dev/dualVersion.nut.ts`):

   - Test against an org with API version 64.0 (should use 'latest')
   - Test against an org with API version 65.0 (should use 'prerelease')
   - Verify correct dependencies are loaded
   - Verify dev server starts successfully with each version

2. **Update Existing NUTs**:
   - Ensure existing NUTs work without modification
   - Add assertions to verify correct channel is being used

### Manual Testing Checklist

- [ ] Install plugin with both dependency versions
- [ ] Connect to a Latest org (e.g., API 64.0) and verify dev server starts
- [ ] Connect to a Prerelease org (e.g., API 65.0) and verify dev server starts
- [ ] Verify hot reload works with both versions
- [ ] Test component preview with both versions
- [ ] Test app preview with both versions
- [ ] Test site preview with both versions

## Migration Strategy

### Phase 1: Implementation (1-2 weeks)

1. Add aliased dependencies to package.json
2. Implement VersionResolver and DependencyLoader modules
3. Update OrgUtils with new getVersionChannel method
4. Update lwc-dev-server/index.ts to use dynamic loading
5. Update command files to pass connection to startLWCServer
6. Add TypeScript type declarations for aliased packages
7. Write comprehensive unit tests

### Phase 2: Integration & Testing (1 week)

1. Write integration tests (NUTs)
2. Manual testing with both Latest and Prerelease orgs
3. Test edge cases and error scenarios
4. Performance testing to ensure no significant overhead

### Phase 3: Documentation & Release (1 week)

1. Update README with new capabilities
2. Update user-facing documentation
3. Update error messages to be more helpful
4. Create migration guide for users
5. Release as major version (breaking change in how versions are handled)

### Phase 4: Cleanup (future release)

1. Remove deprecated `ensureMatchingAPIVersion` method
2. Remove old version-specific error messages
3. Update `versionToTagMappings` metadata (may no longer be needed)

## Rollout Plan

### Option A: Big Bang (Recommended)

- Release as a new major version (e.g., v6.0.0)
- Announce that users no longer need to switch plugin versions
- Provide clear upgrade instructions
- Keep v5.x as fallback for any issues

### Option B: Gradual

- Release as opt-in feature with flag (e.g., `--use-dual-version`)
- Gather feedback for 1-2 releases
- Make it default behavior in next major version

**Recommendation**: Option A - The change is transparent to users and provides immediate value.

## Maintenance Considerations

### Updating Versions

When a new Salesforce release comes out:

1. **Update package.json dependencies**:

   ```json
   {
     "dependencies": {
       // Shift prerelease to latest
       "@lwc/lwc-dev-server-latest": "npm:@lwc/lwc-dev-server@~13.2.x",

       // Update prerelease to new version
       "@lwc/lwc-dev-server-prerelease": "npm:@lwc/lwc-dev-server@~13.3.x"
     }
   }
   ```

2. **Update apiVersionMetadata**:

   ```json
   {
     "apiVersionMetadata": {
       "channels": {
         "latest": {
           "supportedApiVersions": ["65.0"] // Previous prerelease becomes latest
         },
         "prerelease": {
           "supportedApiVersions": ["66.0"] // New prerelease version
         }
       }
     }
   }
   ```

3. **Run tests** against both versions
4. **Release** new version of plugin

### Automation Opportunities

- Create a script to update versions in package.json
- Automate the shifting of prerelease → latest
- Set up CI/CD to test against both org types
- Create alerts when new LWC package versions are published

## Potential Issues & Mitigations

### Issue 1: Type Compatibility

**Problem**: Different versions might have incompatible TypeScript types

**Mitigation**:

- Use interface abstraction layer if needed
- Test compilation with both versions during CI
- Create adapter classes if APIs diverge significantly

### Issue 2: Bundle Size

**Problem**: Installing two versions doubles the size of LWC dependencies

**Mitigation**:

- These are dev dependencies, size is less critical
- Consider optional peer dependencies in future
- Monitor and document bundle size impact

### Issue 3: Breaking Changes Between Versions

**Problem**: Major version differences might require different code paths

**Mitigation**:

- Create version-specific adapters in DependencyLoader
- Use feature detection rather than version detection where possible
- Maintain compatibility layer

### Issue 4: Debugging Complexity

**Problem**: Bug reports might not specify which version was used

**Mitigation**:

- Log the channel being used in debug output
- Include channel in error messages
- Add channel info to telemetry (if applicable)

### Issue 5: Development Environment

**Problem**: Developers might need to test against specific versions

**Mitigation**:

- Add environment variable to force a specific channel (e.g., `FORCE_VERSION_CHANNEL=latest`)
- Add flag to command for testing (e.g., `--version-channel=prerelease`)
- Document development workflow

## Alternative Approaches Considered

### Alternative 1: Peer Dependencies

Install dependencies as peer dependencies and let users install the correct version.

**Pros**: Smaller plugin size, user has more control
**Cons**: Worse UX, users still need to know which version to install, defeats the purpose

### Alternative 2: Separate Plugin Packages

Create two separate plugins: `plugin-lightning-dev` and `plugin-lightning-dev-prerelease`

**Pros**: Cleaner separation, no complexity in code
**Cons**: Terrible UX, users need to know which to install, doubles maintenance

### Alternative 3: Lazy Installation

Detect version and install correct dependencies at runtime via npm/yarn

**Pros**: Only installs what's needed
**Cons**: Requires write access to node_modules, slow first run, complex error handling, security concerns

### Alternative 4: Build-time Multiple Distributions

Build two separate distributions of the plugin, one for each version

**Pros**: No runtime overhead
**Cons**: Complex build process, doubles CI time, users still need to know which to install

**Selected Approach**: NPM Aliasing with Runtime Branching (described above)

- Best balance of UX and maintainability
- Transparent to users
- Manageable complexity
- Industry-standard approach

## Success Metrics

1. **User Experience**: Users can connect to any supported org without plugin version switching
2. **Performance**: < 100ms overhead for version resolution and dynamic loading
3. **Reliability**: No increase in error rates for dev server startup
4. **Maintenance**: Version updates can be done in < 30 minutes
5. **Adoption**: 90%+ of users upgrade to new version within 3 months

## Open Questions

1. **Should we support more than 2 versions?**

   - Currently assuming Latest + Prerelease is sufficient
   - Could extend to support 3-4 versions if needed
   - Trade-off: bundle size vs. compatibility window

2. **How do we handle version deprecation?**

   - When should we drop support for older versions?
   - Proposal: Keep 2 most recent, drop older versions

3. **Should we cache the version resolution per org?**

   - Could store in `.sf/` config to avoid querying every time
   - Trade-off: speed vs. staleness if org is upgraded

4. **Do we need a manual override flag?**

   - Allow users to force a specific channel for testing
   - e.g., `sf lightning dev component --version-channel=prerelease`

5. **What about @lwrjs/api dependency?**
   - Currently pinned to specific version (0.18.3)
   - Does this also need dual versions?
   - Need to investigate LWR versioning strategy

## Next Steps

1. **Review and iterate on this design**

   - Get feedback from team
   - Address any concerns or questions
   - Finalize approach

2. **Create prototype**

   - Implement core VersionResolver and DependencyLoader
   - Test dynamic loading with aliased packages
   - Validate TypeScript compilation

3. **Full implementation**

   - Follow migration strategy outlined above
   - Comprehensive testing
   - Documentation updates

4. **Release and monitor**
   - Release as new major version
   - Monitor for issues
   - Gather user feedback

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-05  
**Author**: Design Proposal  
**Status**: Draft - Awaiting Review
