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

import path from 'node:path';
import url from 'node:url';
import { CommonUtils } from '@salesforce/lwc-dev-mobile-core';

/**
 * Resolves org API version to appropriate dependency channel
 */
export type VersionChannel = 'latest' | 'prerelease' | 'next';

export type ChannelConfig = {
  supportedApiVersions: string[];
  dependencies: {
    [key: string]: string;
  };
};

type CacheEntry = {
  apiVersion: string;
  channel: VersionChannel;
  timestamp: number;
};

type PackageJson = {
  apiVersionMetadata: {
    channels: {
      [key in VersionChannel]: ChannelConfig;
    };
    defaultChannel: string;
  };
};

export class VersionResolver {
  private static channelMetadata: Map<VersionChannel, ChannelConfig> | null = null;
  private static versionCache: Map<string, CacheEntry> = new Map();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
      `Unsupported org API version: ${orgApiVersion}. This plugin supports: ${this.getSupportedVersionsList()}`
    );
  }

  /**
   * Resolves channel with caching support
   *
   * @param orgId - Unique identifier for the org
   * @param orgApiVersion - The API version from the org
   * @returns The channel to use
   */
  public static resolveChannelWithCache(orgId: string, orgApiVersion: string): VersionChannel {
    // Check cache first
    const cached = this.versionCache.get(orgId);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.CACHE_TTL_MS && cached.apiVersion === orgApiVersion) {
        return cached.channel;
      }
      // Cache expired or version changed, remove it
      this.versionCache.delete(orgId);
    }

    // Resolve and cache
    const channel = this.resolveChannel(orgApiVersion);
    this.versionCache.set(orgId, {
      apiVersion: orgApiVersion,
      channel,
      timestamp: Date.now(),
    });

    return channel;
  }

  /**
   * Returns the default channel from package.json
   */
  public static getDefaultChannel(): VersionChannel {
    const packageJson = this.getPackageJson();
    return packageJson.apiVersionMetadata.defaultChannel as VersionChannel;
  }

  /**
   * Clears the version cache (useful for testing or when orgs are upgraded)
   */
  public static clearCache(): void {
    this.versionCache.clear();
    this.channelMetadata = null;
  }

  /**
   * Removes a specific org from the cache
   */
  public static removeCacheEntry(orgId: string): void {
    this.versionCache.delete(orgId);
  }

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
      this.channelMetadata.set(channel as VersionChannel, config);
    }

    return this.channelMetadata;
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

  private static getPackageJson(): PackageJson {
    const dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const packageJsonFilePath = path.resolve(dirname, '../../package.json');
    return CommonUtils.loadJsonFromFile(packageJsonFilePath) as unknown as PackageJson;
  }
}
