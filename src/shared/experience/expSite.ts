/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import path from 'node:path';
import { Org, SfError } from '@salesforce/core';
import axios from 'axios';

export type SiteMetadata = {
  bundleName: string;
  bundleLastModified: string;
};

export type SiteMetadataCache = {
  [key: string]: SiteMetadata;
};

/**
 * Experience Site class.
 * https://developer.salesforce.com/docs/platform/lwc/guide/get-started-test-components.html#enable-local-dev
 *
 * @param {string} siteName - The name of the experience site.
 * @param {string} status - The status of the experience site.
 * @param {string} bundleName - The static resource bundle name.
 * @param {string} bundleLastModified - The lastModifiedDate of the static resource.
 */
export class ExperienceSite {
  public siteDisplayName: string;
  public siteName: string;
  private org: Org;
  private metadataCache: SiteMetadataCache = {};

  public constructor(org: Org, siteName: string) {
    this.org = org;
    this.siteDisplayName = siteName.trim();
    this.siteName = this.siteDisplayName.replace(' ', '_');
  }

  /**
   * Get an experience site bundle by site name.
   *
   * @param conn - Salesforce connection object.
   * @param siteName - The name of the experience site.
   * @returns - The experience site.
   *
   * @param siteName
   * @returns
   */
  public static getLocalExpSite(siteName: string): ExperienceSite {
    const siteJsonPath = path.join('.localdev', siteName.trim().replace(' ', '_'), 'site.json');
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
      (record) => new ExperienceSite(org, getSiteNameFromStaticResource(record.Name))
    );

    return experienceSites;
  }

  /**
   * Fetches all current experience sites
   *
   * @param {Connection} conn - Salesforce connection object.
   * @returns {Promise<string[]>} - List of experience sites.
   */
  public static async getAllExpSites(org: Org): Promise<string[]> {
    const result = await org.getConnection().query<{
      Id: string;
      Name: string;
      LastModifiedDate: string;
      UrlPathPrefix: string;
      Status: string;
    }>('SELECT Id, Name, LastModifiedDate, UrlPathPrefix, Status FROM Network');
    const experienceSites: string[] = result.records.map((record) => record.Name);
    return experienceSites;
  }

  /**
   * Esablish a valid token for this local development session
   *
   * @returns sid token for proxied site requests
   */
  public async setupAuth(): Promise<string> {
    let sidToken = ''; // Default to guest user access only

    // Use environment variable for now if users want to just have guest access only
    if (process.env.SITE_GUEST_ACCESS !== 'true') {
      try {
        const networkId = await this.getNetworkId();
        sidToken = await this.getNewSidToken(networkId);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to establish authentication for site', e);
      }
    }

    return sidToken;
  }

  public async isUpdateAvailable(): Promise<boolean> {
    const localMetadata = this.getLocalMetadata();
    if (!localMetadata) {
      return true; // If no local metadata, assume update is available
    }

    const remoteMetadata = await this.getRemoteMetadata();
    if (!remoteMetadata) {
      return false; // If no org bundle found, no update available
    }

    return new Date(remoteMetadata.bundleLastModified) > new Date(localMetadata.bundleLastModified);
  }

  // Is the site extracted locally
  public isSiteSetup(): boolean {
    return fs.existsSync(path.join(this.getExtractDirectory(), 'ssr.js'));
  }

  // Is the static resource available on the server
  public async isSitePublished(): Promise<boolean> {
    const remoteMetadata = await this.getRemoteMetadata();
    if (!remoteMetadata) {
      return false;
    }
    return true;
  }

  // Is there a local gz file of the site
  public isSiteDownloaded(): boolean {
    const metadata = this.getLocalMetadata();
    if (!metadata) {
      return false;
    }
    return fs.existsSync(this.getSiteZipPath(metadata));
  }

  public saveMetadata(metadata: SiteMetadata): void {
    const siteJsonPath = path.join(this.getSiteDirectory(), 'site.json');
    const siteJson = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(siteJsonPath, siteJson);
  }

  public getLocalMetadata(): SiteMetadata | undefined {
    if (this.metadataCache.localMetadata) return this.metadataCache.localMetadata;
    const siteJsonPath = path.join(this.getSiteDirectory(), 'site.json');
    let siteJson;
    if (fs.existsSync(siteJsonPath)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        siteJson = JSON.parse(fs.readFileSync(siteJsonPath, 'utf-8')) as SiteMetadata;
        this.metadataCache.localMetadata = siteJson;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error reading site.json file', error);
      }
    }
    return siteJson;
  }

  public async getRemoteMetadata(): Promise<SiteMetadata | undefined> {
    if (this.metadataCache.remoteMetadata) return this.metadataCache.remoteMetadata;
    // Check if there are special characters in the site name
    const isInvalidSiteName = hasSpacesOrSpecialChars(this.siteName);
    // const originalSiteName = this.siteName;
    if (isInvalidSiteName) {
      const updatedSiteName = replaceSpacesAndSpecialChars(this.siteName);
      this.siteName = updatedSiteName;
    }
    const result = await this.org
      .getConnection()
      .query<{ Name: string; LastModifiedDate: string }>(
        `SELECT Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT_experience_%_${this.siteName}'`
      );
    // Changing the site name back to original after fetching data from StaticResource so it may not break the flow elsewhere
    // this.siteName = originalSiteName;

    if (result.records.length === 0) {
      return undefined;
    }
    const staticResource = result.records[0];
    this.metadataCache.remoteMetadata = {
      bundleName: staticResource.Name,
      bundleLastModified: staticResource.LastModifiedDate,
    };
    return this.metadataCache.remoteMetadata;
  }

  /**
   * Get the local site directory path
   *
   * @returns the path to the site
   */
  public getSiteDirectory(): string {
    return path.join('.localdev', this.siteName);
  }

  public getExtractDirectory(): string {
    return path.join('.localdev', this.siteName, 'app');
  }

  public getSiteZipPath(metadata: SiteMetadata): string {
    const lastModifiedDate = new Date(metadata.bundleLastModified);
    const timestamp = `${
      lastModifiedDate.getMonth() + 1
    }-${lastModifiedDate.getDate()}_${lastModifiedDate.getHours()}-${lastModifiedDate.getMinutes()}`;
    const fileName = `${metadata.bundleName}_${timestamp}.gz`;
    const resourcePath = path.join(this.getSiteDirectory(), fileName);
    return resourcePath;
  }

  /**
   * Download and return the site resource bundle
   *
   * @returns path of downloaded site zip
   */
  public async downloadSite(): Promise<string> {
    const remoteMetadata = await this.getRemoteMetadata();
    if (!remoteMetadata) {
      throw new SfError(`No published site found for: ${this.siteDisplayName}`);
    }

    // Download the site from static resources
    // eslint-disable-next-line no-console
    console.log('[local-dev] Downloading site...'); // TODO spinner
    const resourcePath = this.getSiteZipPath(remoteMetadata);
    const staticresource = await this.org.getConnection().metadata.read('StaticResource', remoteMetadata.bundleName);
    if (staticresource?.content) {
      // Save the static resource
      fs.mkdirSync(this.getSiteDirectory(), { recursive: true });
      const buffer = Buffer.from(staticresource.content, 'base64');
      fs.writeFileSync(resourcePath, buffer);

      // Save the site's metadata
      this.saveMetadata(remoteMetadata);
    } else {
      throw new SfError(`Error occurred downloading your site: ${this.siteDisplayName}`);
    }

    return resourcePath;
  }

  private async getNetworkId(): Promise<string> {
    const conn = this.org.getConnection();
    // Query the Network object for the network with the given site name
    const result = await conn.query<{ Id: string }>(`SELECT Id FROM Network WHERE Name = '${this.siteDisplayName}'`);

    const record = result.records[0];
    if (record) {
      let networkId = record.Id;
      // Subtract the last three characters from the Network ID
      networkId = networkId.substring(0, networkId.length - 3);
      return networkId;
    } else {
      throw new Error(`NetworkId for site: '${this.siteDisplayName}' could not be found`);
    }
  }

  private async getNewSidToken(networkId: string): Promise<string> {
    // Get the connection and access token from the org
    const conn = this.org.getConnection();
    const orgId = this.org.getOrgId();

    // Not sure if we need to do this
    const orgIdMinus3 = orgId.substring(0, orgId.length - 3);
    const accessToken = conn.accessToken;
    const instanceUrl = conn.instanceUrl; // Org URL

    // Make the GET request without following redirects
    if (accessToken) {
      // TODO should we try and refresh auth here?
      // await conn.refreshAuth();

      // Call out to the switcher servlet to establish a session
      const switchUrl = `${instanceUrl}/servlet/networks/switch?networkId=${networkId}`;
      const cookies = [`sid=${accessToken}`, `oid=${orgIdMinus3}`].join('; ').trim();
      let response = await axios.get(switchUrl, {
        headers: {
          Cookie: cookies,
        },
        withCredentials: true,
        maxRedirects: 0, // Prevent axios from following redirects
        validateStatus: (status) => status >= 200 && status < 400, // Accept 3xx status codes
      });

      // Extract the Location callback header
      const locationHeader = response.headers['location'] as string;
      if (locationHeader) {
        // Parse the URL to extract the 'sid' parameter
        const urlObj = new URL(locationHeader);
        const sid = urlObj.searchParams.get('sid') ?? '';
        const cookies2 = ['__Secure-has-sid=1', `sid=${sid}`, `oid=${orgIdMinus3}`].join('; ').trim();

        // Request the location header to establish our session with the servlet
        response = await axios.get(urlObj.toString(), {
          headers: {
            Cookie: cookies2,
          },
          withCredentials: true,
          maxRedirects: 0, // Prevent axios from following redirects
          validateStatus: (status) => status >= 200 && status < 400, // Accept 3xx status codes
        });
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
          // Find the 'sid' cookie in the set-cookie header
          const sidCookie = setCookieHeader.find((cookieStr: string) => cookieStr.startsWith('sid='));
          if (sidCookie) {
            // Extract the sid value from the set-cookie string
            const sidMatch = sidCookie.match(/sid=([^;]+)/);
            if (sidMatch?.[1]) {
              const sidToken = sidMatch[1];
              return sidToken;
            }
          }
        }
      }

      // if we can't establish a valid session this way, lets just warn the user and utilize the guest user context for the site
      // eslint-disable-next-line no-console
      console.warn(
        `Warning: could not establish valid auth token for your site '${this.siteDisplayName}'.` +
          'Local Dev proxied requests to your site may fail or return data from the guest user context.'
      );

      return ''; // Site will be guest user access only
    }

    // Not sure what scenarios we don't have an access token at all, but lets output a separate message here so we can distinguish these edge cases
    // eslint-disable-next-line no-console
    console.warn(
      'Warning: sf cli org connection missing accessToken. Local Dev proxied requests to your site may fail or return data from the guest user context.'
    );
    return '';
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

export function replaceSpacesAndSpecialChars(value: string): string {
  // Replace any special characters with underscore
  value = value.replace(/[^a-zA-Z0-9]/g, '_');

  // Replace spaces with underscore
  value = value.replace(/ /g, '_');

  return value;
}

export function hasSpacesOrSpecialChars(value: string): boolean {
  // Check for spaces
  if (value.includes(' ')) {
    return true;
  }

  // Check for special characters
  if (/[^\w]/.test(value)) {
    return true;
  }

  return false;
}
