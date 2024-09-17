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
    const result = await this.org
      .getConnection()
      .query<{ Name: string; LastModifiedDate: string }>(
        `SELECT Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT_experience_%_${this.siteName}'`
      );
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

  // TODO cleanup
  public async getNetworkIdByName(): Promise<string> {
    const conn = this.org.getConnection();
    // try {
    // Query the Network object for the network with the given site name
    const result = await conn.query<{ Id: string }>(`SELECT Id FROM Network WHERE Name = '${this.siteDisplayName}'`);

    const record = result.records[0];
    if (record) {
      let networkId = record.Id;
      // Subtract the last three characters from the Network ID
      networkId = networkId.substring(0, networkId.length - 3);
      return networkId;
    } else {
      throw new Error(`Network with name '${this.siteDisplayName}' not found`);
    }
    // } catch (error) {
    //   // console.error('Error fetching Network ID:', error);
    //   throw error;
    // }
  }

  public async getNewSidToken(networkId: string): Promise<string> {
    // Get the connection and access token from the org
    const conn = this.org.getConnection();
    const identity = await conn.identity();
    if (identity.user_id) {
      // do something
    }
    const orgId = this.org.getOrgId();
    const orgIdMinus3 = orgId.substring(0, orgId.length - 3);
    const accessToken = conn.accessToken;
    const instanceUrl = conn.instanceUrl;

    // Construct the switch URL
    const switchUrl = `${instanceUrl}/servlet/networks/switch?networkId=${networkId}`;

    // try {
    // Make the GET request without following redirects
    if (accessToken) {
      const cookies = [
        `sid=${accessToken}`,
        `oid=${orgIdMinus3}`,
        // 'sid_Client=s000000uuCPw000000I7xV',
        // Include other essential cookies if necessary
        // For example:
        // `oid=${conn.getAuthInfoFields().orgId}`,
        // `sid_Client=${conn.userInfo.id}`,
        // Add any other cookies that might be required
      ]
        .join('; ')
        .trim();
      let response = await axios.get(switchUrl, {
        headers: {
          Cookie: cookies,
          // Include other headers if necessary
          // 'User-Agent': 'Your User Agent String',
          // 'Referer': 'Referer URL if required',
        },
        withCredentials: true,
        maxRedirects: 0, // Prevent axios from following redirects
        validateStatus: (status) => status >= 200 && status < 400, // Accept 3xx status codes
      });

      // Extract the Location header
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const locationHeader = response.headers['location'];

      if (locationHeader) {
        // Parse the URL to extract the 'sid' parameter
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const urlObj = new URL(locationHeader);
        const sid = urlObj.searchParams.get('sid') ?? '';
        const cookies2 = [
          '__Secure-has-sid=1',
          `sid=${sid}`,
          `oid=${orgIdMinus3}`,
          // 'sid_Client=s000000uuCPw000000I7xV',
          // Include other essential cookies if necessary
          // For example:
          // `oid=${conn.getAuthInfoFields().orgId}`,
          // `sid_Client=${conn.userInfo.id}`,
          // Add any other cookies that might be required
        ]
          .join('; ')
          .trim();

        response = await axios.get(urlObj.toString(), {
          headers: {
            Cookie: cookies2,
            // Include other headers if necessary
            // 'User-Agent': 'Your User Agent String',
            // 'Referer': 'Referer URL if required',
          },
          withCredentials: true,
          maxRedirects: 0, // Prevent axios from following redirects
          validateStatus: (status) => status >= 200 && status < 400, // Accept 3xx status codes
        });
        const setCookieHeader = response.headers['set-cookie'];
        if (setCookieHeader) {
          // 'set-cookie' can be an array if multiple cookies are set
          // Find the 'sid' cookie in the set-cookie header
          const sidCookie = setCookieHeader.find((cookieStr: string) => cookieStr.startsWith('sid='));

          if (sidCookie) {
            // Extract the sid value from the cookie string
            const sidMatch = sidCookie.match(/sid=([^;]+)/);
            if (sidMatch?.[1]) {
              const sidToken = sidMatch[1];
              return sidToken;
            }
          }
        } else {
          // eslint-disable-next-line no-console
          console.log('error couldnt find set-cookie header for sid token');
        }

        if (sid) {
          return sid;
        } else {
          throw new Error('SID token not found in Location header');
        }
      } else {
        throw new Error('Location header not found in response');
      }
    }
    return '';
    // } catch (error) {
    //   // Handle errors (e.g., network issues, HTTP errors)
    //   // console.error('Error obtaining new SID token:', error);
    //   throw error;
    // }
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
