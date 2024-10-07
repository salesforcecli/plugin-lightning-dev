/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';

type LightningPreviewMetadataResponse = {
  enableLightningPreviewPref?: string;
};

export class OrgUtils {
  /**
   * Given an app name, it queries the org to find the matching app id. To do so,
   * it will first attempt at finding the app with a matching DeveloperName. If
   * no match is found, it will then attempt at finding the app with a matching
   * Label. If multiple matches are found, then the first match is returned.
   *
   * @param connection the connection to the org
   * @param appName the name of the app
   * @returns the app id or undefined if no match is found
   */
  public static async getAppId(connection: Connection, appName: string): Promise<string | undefined> {
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
}
