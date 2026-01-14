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

import packageJson from '../../package.json' with { type: 'json' };
import { objectEntries, objectKeys } from './typeUtils.js';

/**
 * Resolves org API version to appropriate dependency channel
 */
export type VersionChannel = keyof typeof packageJson.apiVersionMetadata.channels;

/**
 * Extracts major.minor from a version string (e.g., "65.0" from "65.0.1")
 */
function getMajorMinor(version: string): string {
  const parts = version.split('.');
  return `${parts[0]}.${parts[1]}`;
}

/**
 * Returns a formatted list of all supported API versions
 */
export function getSupportedVersionsList(): string {
  const channels = packageJson.apiVersionMetadata.channels;
  const allVersions: string[] = [];

  for (const config of Object.values(channels)) {
    allVersions.push(...config.supportedApiVersions);
  }

  return allVersions.join(', ');
}

/**
 * Given an org API version, returns the appropriate channel
 *
 * @param orgApiVersion - The API version from the org (e.g., "65.0")
 * @returns The channel to use ('latest' or 'prerelease')
 * @throws Error if the API version is not supported by any channel
 */
export function resolveChannel(orgApiVersion: string): VersionChannel {
  const channels = packageJson.apiVersionMetadata.channels;

  for (const [channel, config] of objectEntries(channels)) {
    if (config.supportedApiVersions.includes(orgApiVersion)) {
      return channel;
    }
  }

  // If no exact match, try to find by major.minor comparison
  const orgMajorMinor = getMajorMinor(orgApiVersion);
  for (const [channel, config] of objectEntries(channels)) {
    for (const supportedVersion of config.supportedApiVersions) {
      if (getMajorMinor(supportedVersion) === orgMajorMinor) {
        return channel;
      }
    }
  }

  throw new Error(`Unsupported org API version: ${orgApiVersion}. This plugin supports: ${getSupportedVersionsList()}`);
}

/**
 * Returns the default channel from package.json
 */
export function getDefaultChannel(): VersionChannel {
  return packageJson.apiVersionMetadata.defaultChannel as VersionChannel;
}

/**
 * Returns a list of all valid version channels
 */
export function getAllChannels(): VersionChannel[] {
  return objectKeys(packageJson.apiVersionMetadata.channels);
}
