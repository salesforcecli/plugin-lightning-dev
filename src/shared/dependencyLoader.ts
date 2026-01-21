/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Logger } from '@salesforce/core';
import packageJsonImport from '../../package.json' with { type: 'json' };

type PackageJson = {
  apiVersionMetadata: Record<string, unknown>;
};

const packageJson = packageJsonImport as unknown as PackageJson;

/**
 * Type for dynamically loaded LWC module from @lwc/sfdx-local-dev-dist
 */
export type LwcModule = {
  [key: string]: unknown;
  startLwcDevServer: (config: unknown, logger: Logger) => Promise<unknown>;
  LWCServer: unknown;
  Workspace: unknown;
};

/**
 * Returns a formatted list of all supported API versions
 */
function getSupportedVersionsList(): string {
  return Object.keys(packageJson.apiVersionMetadata).sort().join(', ');
}

/**
 * Given an org API version, returns the matched supported version string
 *
 * @param orgApiVersion - The API version from the org (e.g., "65.0")
 * @returns The matched version string (e.g., "65.0")
 * @throws Error if the API version is not supported
 */
function resolveApiVersion(orgApiVersion: string): string {
  const metadata = packageJson.apiVersionMetadata;

  // Exact match
  if (metadata[orgApiVersion]) {
    return orgApiVersion;
  }

  throw new Error(`Unsupported org API version: ${orgApiVersion}. This plugin supports: ${getSupportedVersionsList()}`);
}

/**
 * Loads the LWC module for the specified org API version
 * Uses dynamic import to load the aliased package at runtime
 *
 * @param orgApiVersion - The API version from the org (e.g., '65.0.1')
 * @returns The loaded module from @lwc/sfdx-local-dev-dist
 */
export async function loadLwcModule(orgApiVersion: string): Promise<LwcModule> {
  const version = resolveApiVersion(orgApiVersion);
  const packageName = `@lwc/sfdx-local-dev-dist-${version}`;

  try {
    return (await import(packageName)) as LwcModule;
  } catch (error) {
    throw new Error(
      `Failed to load LWC module for version '${version}'. ` +
        `Package '${packageName}' could not be imported. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
