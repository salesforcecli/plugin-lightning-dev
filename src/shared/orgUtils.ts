/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection, SfError } from '@salesforce/core';

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

  public static async retrieveSites(conn: Connection): Promise<string[]> {
    const result = await conn.query<{ Name: string; UrlPathPrefix: string; SiteType: string; Status: string }>(
      'SELECT Name, UrlPathPrefix, SiteType, Status FROM Site'
    );
    if (!result.records.length) {
      throw new SfError('No sites found.');
    }
    const siteNames = result.records.map((record) => record.Name).sort();
    return siteNames;
  }

  /**
   * Given a site name, it queries the org to find the matching site.
   *
   * @param connection the connection to the org
   * @param siteName the name of the app
   * @returns the site prefix or empty string if no match is found
   */
  public static async getSitePathPrefix(connection: Connection, siteName: string): Promise<string> {
    // TODO seems like there are 2 copies of each site? ask about this - as the #1 is apended to our site type
    const devNameQuery = `SELECT Id, Name, SiteType, UrlPathPrefix FROM Site WHERE Name LIKE '${siteName}1'`;
    const result = await connection.query<{ UrlPathPrefix: string }>(devNameQuery);
    if (result.totalSize > 0) {
      return '/' + result.records[0].UrlPathPrefix;
    }
    return '';
  }

  public static async getDomains(connection: Connection): Promise<string[]> {
    const devNameQuery = 'SELECT Id, Domain, LastModifiedDate FROM Domain';
    const results = await connection.query<{ Domain: string }>(devNameQuery);
    return results.records.map((result) => result.Domain);
  }
}
