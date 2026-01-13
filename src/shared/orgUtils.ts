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

import { Connection } from '@salesforce/core';
import { VersionChannel, VersionResolver } from './versionResolver.js';

type LightningPreviewMetadataResponse = {
  enableLightningPreviewPref?: string;
};

export type AppDefinition = {
  DeveloperName: string;
  Label: string;
  Description: string;
  DurableId: string;
};

/**
 * As we go through different phases of release cycles, in order to ensure that the API version supported by
 * the local dev server matches with Org API versions, we rely on defining a metadata section in package.json
 */
export class OrgUtils {
  /**
   * Given an app name, it queries the AppDefinition table in the org to find
   * the DurableId for the app. To do so, it will first attempt at finding the
   * app with a matching DeveloperName. If no match is found, it will then
   * attempt at finding the app with a matching Label. If multiple matches are
   * found, then the first match is returned.
   *
   * @param connection the connection to the org
   * @param appName the name of the app
   * @returns the DurableId for the app as found in the AppDefinition table or undefined if no match is found
   */
  public static async getAppDefinitionDurableId(connection: Connection, appName: string): Promise<string | undefined> {
    // NOTE: We have to break up the query and run against different columns separately instead
    // of using OR statement, otherwise we'll get the error 'Disjunctions not supported'
    const devNameQuery = `SELECT DurableId FROM AppDefinition WHERE DeveloperName LIKE '${appName}'`;
    const labelQuery = `SELECT DurableId FROM AppDefinition WHERE Label LIKE '${appName}'`;

    // First attempt to resolve using DeveloperName
    let result = await connection.query<{ DurableId: string }>(devNameQuery);
    if (result.totalSize > 0) {
      return result.records[0].DurableId;
    }

    // If no matches, then resolve using Label
    result = await connection.query<{ DurableId: string }>(labelQuery);
    if (result.totalSize > 0) {
      return result.records[0].DurableId;
    }

    return undefined;
  }

  /**
   * Queries the org and returns a list of the lightning experience apps in the org that are visible to and accessible by the user.
   *
   * @param connection the connection to the org
   * @returns a list of the lightning experience apps in the org that are visible to and accessible by the user.
   */
  public static async getLightningExperienceAppList(connection: Connection): Promise<AppDefinition[]> {
    const results: AppDefinition[] = [];

    const appMenuItemsQuery =
      'SELECT Label,Description,Name FROM AppMenuItem WHERE IsAccessible=true AND IsVisible=true';
    const appMenuItems = await connection.query<{ Label: string; Description: string; Name: string }>(
      appMenuItemsQuery
    );

    const appDefinitionsQuery = "SELECT DeveloperName,DurableId FROM AppDefinition WHERE UiType='Lightning'";
    const appDefinitions = await connection.query<{ DeveloperName: string; DurableId: string }>(appDefinitionsQuery);

    appMenuItems.records.forEach((item) => {
      const match = appDefinitions.records.find((definition) => definition.DeveloperName === item.Name);
      if (match) {
        results.push({
          DeveloperName: match.DeveloperName,
          Label: item.Label,
          Description: item.Description,
          DurableId: match.DurableId,
        });
      }
    });

    return results;
  }

  /**
   * Checks to see if Local Dev is enabled for the org.
   *
   * @param connection the connection to the org
   * @returns boolean indicating whether Local Dev is enabled for the org.
   */
  public static async isLocalDevEnabled(connection: Connection): Promise<boolean> {
    const metadata = await connection.metadata.read('LightningExperienceSettings', 'enableLightningPreviewPref');
    const flagValue = (metadata as LightningPreviewMetadataResponse).enableLightningPreviewPref ?? 'false';
    const localDevEnabled = flagValue.toLowerCase().trim() === 'true';
    return localDevEnabled;
  }

  /**
   * Saves an app server identity token to the UserLocalWebServerIdentity sObject in the org.
   *
   * @param connection the connection to the org
   * @param token the token value to be saved
   * @returns the id of the saved record
   */
  public static async saveAppServerIdentityToken(connection: Connection, token: string): Promise<string> {
    const sobject = connection.sobject('UserLocalWebServerIdentity');
    const result = await sobject.insert({ LocalWebServerIdentityToken: token });
    if (result.success) {
      return result.id;
    }
    throw new Error('Could not save the app server identity token to the org.');
  }

  /**
   * Determines the version channel for the connected org
   *
   * @param connection - The connection to the org
   * @param overrideChannel - Optional manual override from flag or env var
   * @returns The version channel to use for dependencies
   * @throws Error if the org version is not supported or invalid override provided
   */
  public static getVersionChannel(connection: Connection, overrideChannel?: VersionChannel): VersionChannel {
    // Priority 1: Explicit override parameter (from --version-channel flag)
    if (overrideChannel) {
      return overrideChannel;
    }

    // Priority 2: Environment variable override
    const envOverride = process.env.FORCE_VERSION_CHANNEL;
    if (envOverride) {
      const validChannels: VersionChannel[] = ['latest', 'prerelease', 'next'];
      if (validChannels.includes(envOverride as VersionChannel)) {
        return envOverride as VersionChannel;
      } else {
        throw new Error(
          `Invalid FORCE_VERSION_CHANNEL value: "${envOverride}". ` + `Valid values are: ${validChannels.join(', ')}`
        );
      }
    }

    // Priority 3: Skip check for testing (legacy compatibility)
    if (process.env.SKIP_API_VERSION_CHECK === 'true') {
      return VersionResolver.getDefaultChannel();
    }

    // Priority 4: Automatic detection based on org version
    const orgVersion = connection.version;

    try {
      const orgId = connection.getAuthInfoFields().orgId;
      if (!orgId) {
        throw new Error('Could not determine org ID from connection.');
      }
      return VersionResolver.resolveChannelWithCache(orgId, orgVersion);
    } catch (error) {
      // Enhance error with helpful message
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\n` +
          `Your org is on API version ${orgVersion}. ` +
          'Please ensure you are using the correct version of the CLI and this plugin.'
      );
    }
  }

  /**
   * Given a connection to an Org, it ensures that org API version matches what the local dev server expects.
   * To do this, it compares the org API version with the meta data stored in package.json under apiVersionMetadata.
   * If the API versions do not match then this method will throw an exception.
   *
   * @param connection the connection to the org
   * @deprecated Use getVersionChannel instead
   */
  public static ensureMatchingAPIVersion(connection: Connection): void {
    this.getVersionChannel(connection);
  }
}
