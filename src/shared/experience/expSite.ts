/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import path from 'node:path';
import { Connection, Org, SfError } from '@salesforce/core';

/**
 * Experience Site class.
 *
 * @param {string} siteName - The name of the experience site.
 * @param {string} status - The status of the experience site.
 * @param {string} bundleName - The static resource bundle name.
 * @param {string} bundleLastModified - The lastModifiedDate of the static resource.
 */
export class ExperienceSite {
  public siteDisplayName: string;
  public siteName: string;
  public status: string;

  private org: Org;
  private bundleName: string;
  private bundleLastModified: string;

  public constructor(org: Org, siteName: string, status?: string, bundleName?: string, bundleLastModified?: string) {
    this.org = org;
    this.siteDisplayName = siteName.trim();
    this.siteName = this.siteDisplayName.replace(' ', '_');
    this.status = status ?? '';
    this.bundleName = bundleName ?? '';
    this.bundleLastModified = bundleLastModified ?? '';
  }

  /**
   * Get an experience site bundle by site name.
   * 
   * @param conn - Salesforce connection object.
   * @param siteName - The name of the experience site.
   * @returns - The experience site.
   
   * @param siteName 
   * @returns 
   */
  public static getLocalExpSite(siteName: string): ExperienceSite {
    // TODO cleanup
    const siteJsonPath = path.join('__local_dev__', siteName.trim().replace(' ', '_'), 'site.json');
    const siteJson = fs.readFileSync(siteJsonPath, 'utf8');
    const site = JSON.parse(siteJson) as ExperienceSite;
    return site;
  }

  /**
   * Fetches all experience site bundles that are published to MRT.
   *
   * @param {Connection} conn - Salesforce connection object.
   * @returns {Promise<ExperienceSite[]>} - List of experience sites.
   */
  public static async getAllPublishedExpSites(org: Org): Promise<ExperienceSite[]> {
    const result = await org
      .getConnection()
      .query<{ Id: string; Name: string; LastModifiedDate: string }>(
        "SELECT Id, Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT%_'"
      );

    // Example of creating ExperienceSite instances
    const experienceSites: ExperienceSite[] = result.records.map(
      (record) =>
        new ExperienceSite(
          org,
          getSiteNameFromStaticResource(record.Name),
          'live',
          record.Name,
          record.LastModifiedDate
        )
    );

    return experienceSites;
  }

  /**
   * Fetches all current experience sites
   *
   * @param {Connection} conn - Salesforce connection object.
   * @returns {Promise<string[]>} - List of experience sites.
   */
  public static async getAllExpSites(conn: Connection): Promise<string[]> {
    const result = await conn.query<{
      Id: string;
      Name: string;
      LastModifiedDate: string;
      UrlPathPrefix: string;
      Status: string;
    }>('SELECT Id, Name, LastModifiedDate, UrlPathPrefix, Status FROM Network');
    const experienceSites: string[] = result.records.map((record) => record.Name);
    return experienceSites;
  }

  public isSiteSetup(): boolean {
    return fs.existsSync(path.join(this.getSiteDirectory(), 'ssr.js'));
  }

  public isSitePublished(): boolean {
    // TODO
    return fs.existsSync(path.join(this.getSiteDirectory(), 'ssr.js'));
  }

  public async getBundleName(): Promise<string> {
    if (!this.bundleName) {
      await this.initBundle();
    }

    return this.bundleName;
  }

  public async getBundleLastModified(): Promise<string> {
    if (!this.bundleLastModified) {
      await this.initBundle();
    }
    return this.bundleLastModified;
  }

  /**
   * Save the site metadata to the file system.
   */
  public save(): void {
    const siteJsonPath = path.join(this.getSiteDirectory(), 'site.json');
    const siteJson = JSON.stringify(this, null, 4);

    // write out the site metadata
    fs.mkdirSync(this.getSiteDirectory(), { recursive: true });
    fs.writeFileSync(siteJsonPath, siteJson);
  }

  /**
   * Get the local site directory path
   *
   * @returns the path to the site
   */
  public getSiteDirectory(): string {
    return path.join('__local_dev__', this.siteName);
  }

  public getExtractDirectory(): string {
    return path.join('__local_dev__', this.siteName, 'app');
  }

  /**
   * Download and return the site resource bundle
   *
   * @returns path of downloaded site zip
   */
  public async downloadSite(): Promise<string> {
    // 3a. Locate the site bundle
    const bundleName = await this.getBundleName();

    // 3b. Download the site from static resources
    const resourcePath = path.join(this.getSiteDirectory(), `${bundleName}.gz`);

    // TODO configure redownloading
    if (!fs.existsSync(resourcePath)) {
      const staticresource = await this.org.getConnection().metadata.read('StaticResource', bundleName);
      if (staticresource?.content) {
        fs.mkdirSync(this.getSiteDirectory(), { recursive: true });
        // Save the static resource
        const buffer = Buffer.from(staticresource.content, 'base64');
        // this.log(`Writing file to path: ${resourcePath}`);
        fs.writeFileSync(resourcePath, buffer);
      } else {
        throw new SfError(`Error occured downloading your site: ${this.siteDisplayName}`);
      }
    }
    return resourcePath;
  }

  private async initBundle(): Promise<void> {
    const result = await this.org
      .getConnection()
      .query<{ Id: string; Name: string; LastModifiedDate: string }>(
        "SELECT Id, Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT_experience_%_" + this.siteName + "'"
      );
    if (result.records.length === 0) {
      throw new Error(`No experience site found for siteName: ${this.siteDisplayName}`);
    }

    const staticResource = result.records[0];
    this.bundleName = staticResource.Name;
    this.bundleLastModified = staticResource.LastModifiedDate;
  }
}

/**
 * Return the site name given the name of its static resource bundle
 *
 * @param staticResourceName the static resource bundle name
 * @returns the name of the site
 */
function getSiteNameFromStaticResource(staticResourceName: string): string {
  const parts = staticResourceName.split('_');
  if (parts.length < 5) {
    throw new Error(`Unexpected static resource name: ${staticResourceName}`);
  }
  return parts.slice(4).join(' ');
}
