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
import type { VersionChannel } from './versionResolver.js';

/**
 * Type for dynamically loaded LWC server module
 */
export type LwcDevServerModule = {
  startLwcDevServer: (config: unknown, logger: Logger) => Promise<unknown>;
  LWCServer: unknown;
  Workspace: unknown;
};

/**
 * Loads the LWC dev server module for the specified channel
 * Uses dynamic import to load the aliased package at runtime
 *
 * @param channel - The version channel ('latest', 'prerelease', or 'next')
 * @returns The loaded module
 */
export async function loadLwcDevServer(channel: VersionChannel): Promise<LwcDevServerModule> {
  const packageName = `@lwc/lwc-dev-server-${channel}`;

  try {
    return (await import(packageName)) as LwcDevServerModule;
  } catch (error) {
    throw new Error(
      `Failed to load LWC dev server for channel '${channel}'. ` +
        `Package '${packageName}' could not be imported. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Loads the LWC compiler module for the specified channel
 *
 * @param channel - The version channel ('latest', 'prerelease', or 'next')
 * @returns The loaded compiler module
 */
export async function loadLwcCompiler(channel: VersionChannel): Promise<unknown> {
  const packageName = `@lwc/sfdc-lwc-compiler-${channel}`;

  try {
    return (await import(packageName)) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to load LWC compiler for channel '${channel}'. ` +
        `Package '${packageName}' could not be imported. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Loads the base LWC module for the specified channel
 *
 * @param channel - The version channel ('latest', 'prerelease', or 'next')
 * @returns The loaded LWC module
 */
export async function loadLwc(channel: VersionChannel): Promise<unknown> {
  const packageName = `lwc-${channel}`;

  try {
    return (await import(packageName)) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to load LWC for channel '${channel}'. ` +
        `Package '${packageName}' could not be imported. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
