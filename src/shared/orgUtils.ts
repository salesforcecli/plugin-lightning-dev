/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import url from 'node:url';
import { Connection, Messages } from '@salesforce/core';
import { CommonUtils, Version } from '@salesforce/lwc-dev-mobile-core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');

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
 *
 * The "apiVersionMetadata" entry in this json file defines "target" and "versionToTagMappings" sections.
 *
 * "target.versionNumber" defines the API version that the local dev server supports. As we pull in new versions
 * of the lwc-dev-server we need to manually update "target.versionNumber" in package.json In order to ensure
 * that we don't forget this step, we also have "target.matchingDevServerVersion" which is used by husky during
 * the pre-commit check to ensure that we have updated the "apiVersionMetadata" section. Whenever we pull in
 * a new version of lwc-dev-server in our dependencies, we must also update "target.matchingDevServerVersion"
 * to the same version otherwise the pre-commit will fail. This means that, as the PR owner deliberately
 * updates "target.matchingDevServerVersion", they are responsible to ensuring that the rest of the data under
 * "apiVersionMetadata" is accurate.
 *
 * The "versionToTagMappings" section will provide a mapping between supported API version by the dev server
 * and the tagged version of our plugin. We use "versionToTagMappings" to convey to the user which version of
 * our plugin should they be using to match with the API version of their org (i.e which version of our plugin
 * contains the lwc-dev-server dependency that can support the API version of their org).
 */
type apiVersionMetadata = {
  target: {
    versionNumber: string;
    matchingDevServerVersion: string;
  };
  versionToTagMappings: [
    {
      versionNumber: string;
      tagName: string;
    }
  ];
};

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
   * Given a connection to an Org, it ensures that org API version matches what the local dev server expects.
   * To do this, it compares the org API version with the meta data stored in package.json under apiVersionMetadata.
   * If the API versions do not match then this method will throw an exception.
   *
   * @param connection the connection to the org
   */
  public static ensureMatchingAPIVersion(connection: Connection): void {
    const dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const packageJsonFilePath = path.resolve(dirname, '../../package.json');

    const pkg = CommonUtils.loadJsonFromFile(packageJsonFilePath) as {
      name: string;
      apiVersionMetadata: apiVersionMetadata;
    };
    const targetVersion = pkg.apiVersionMetadata.target.versionNumber;
    const orgVersion = connection.version;

    if (Version.same(orgVersion, targetVersion) === false) {
      let errorMessage = messages.getMessage('error.org.api-mismatch.message', [orgVersion, targetVersion]);
      const tagName = pkg.apiVersionMetadata.versionToTagMappings.find(
        (info) => info.versionNumber === targetVersion
      )?.tagName;
      if (tagName) {
        const remediation = messages.getMessage('error.org.api-mismatch.remediation', [`${pkg.name}@${tagName}`]);
        errorMessage = `${errorMessage} ${remediation}`;
      }

      // Examples of error messages are as below (where the tag name comes from apiVersionMetadata in package.json):
      //
      // Your org is on API version 61 but this CLI plugin supports API version 62. Please reinstall or update the plugin using @salesforce/plugin-lightning-dev@latest tag.
      //
      // Your org is on API version 62 but this CLI plugin supports API version 63. Please reinstall or update the plugin using @salesforce/plugin-lightning-dev@next tag.
      //
      // Your org is on API version 63 but this CLI plugin supports API version 62. Please reinstall or update the plugin using @salesforce/plugin-lightning-dev@latest tag.

      throw new Error(errorMessage);
    }
  }
}
