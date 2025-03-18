/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import path from 'node:path';
import { Org, SfError, Logger } from '@salesforce/core';
import axios from 'axios';
import { PromptUtils } from '../promptUtils.js';
import { ExperienceSiteConfigManager } from './expSiteConfig.js';

// New metadata format for sites
export type NewSiteMetadata = {
  name: string;
  orgId: string;
  siteId: string; // From the builderUrl query parameter
  siteZips: Array<{
    filename: string;
    downloadedAt: Date;
    bundleLastModified: Date;
  }>;
  lastModified: Date;
  coreVersion: string;
  needsUpdate: boolean;
  users: AuthUserMap;
  metadata?: ConnectApiSiteMetadata; // Metadata from Connect API
};

// Type for site metadata from Connect API
export type ConnectApiSiteMetadata = {
  id: string;
  name: string;
  description?: string;
  status: string;
  urlPathPrefix?: string;
  siteUrl?: string;
  builderUrl?: string;
  templateName?: string;
  lastModifiedDate?: string;
};

export type AuthUserMap = {
  [username: string]: AuthToken;
};

export type AuthToken = {
  token: string;
  issued: Date;
};

// This is what we have been storing in the sites.json
export type SiteMetadata = {
  bundleName: string;
  bundleLastModified: string;
  coreVersion: string;
};

export type SiteMetadataCache = {
  [key: string]: SiteMetadata | NewSiteMetadata;
};

/**
 * Migrates old metadata format to the new format, adding orgId and siteId
 */
export async function migrateToNewMetadataFormat(
  oldMetadata: SiteMetadata,
  org: Org,
  siteName: string
): Promise<NewSiteMetadata> {
  const functionLogger = Logger.childFromRoot('migrateToNewMetadataFormat');
  functionLogger.debug(`Migrating metadata for site: ${siteName}`);

  // Get the orgId
  const orgId = org.getOrgId();
  functionLogger.debug(`OrgId: ${orgId}`);

  // Get site metadata from Connect API
  let connectApiMetadata: ConnectApiSiteMetadata | undefined;
  let siteId = '';

  try {
    functionLogger.debug('Fetching site details from Connect API');
    const conn = org.getConnection();
    const apiVersion = conn.version;
    const url = `/services/data/v${apiVersion}/connect/communities`;

    const response = await conn.request<{
      communities: ConnectApiSiteMetadata[];
    }>(url);

    if (response?.communities) {
      functionLogger.debug(`Found ${response.communities.length} communities in the org`);
      connectApiMetadata = response.communities.find((site) => site.name === siteName);

      if (connectApiMetadata) {
        functionLogger.debug(`Found site metadata for ${siteName}`);

        if (connectApiMetadata.builderUrl) {
          // Extract siteId from builderUrl query parameter
          const urlObj = new URL(connectApiMetadata.builderUrl);
          siteId = urlObj.searchParams.get('siteId') ?? '';
          functionLogger.debug(`Extracted siteId: ${siteId}`);
        } else {
          functionLogger.debug('No builderUrl found in site metadata');
        }
      } else {
        functionLogger.debug(`Site ${siteName} not found in Connect API response`);
      }
    } else {
      functionLogger.debug('No communities found in Connect API response');
    }
  } catch (error) {
    functionLogger.error('Error fetching site details for migration:');
    functionLogger.error(error);
    // If we can't get the metadata from the Connect API, we'll continue with empty values
  }

  const newMetadata: NewSiteMetadata = {
    name: oldMetadata.bundleName.replace(/^MRT_experience_.*_/, ''),
    orgId,
    siteId,
    siteZips: [
      {
        filename: oldMetadata.bundleName,
        downloadedAt: new Date(),
        bundleLastModified: new Date(oldMetadata.bundleLastModified),
      },
    ],
    lastModified: new Date(oldMetadata.bundleLastModified),
    coreVersion: oldMetadata.coreVersion,
    needsUpdate: false,
    users: {},
    metadata: connectApiMetadata,
  };

  functionLogger.debug('Migration complete. New metadata created.');
  return newMetadata;
}

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
  private configManager: ExperienceSiteConfigManager;
  private config;
  private logger: Logger;

  public constructor(org: Org, siteName: string) {
    this.logger = Logger.childFromRoot(`ExperienceSite:${siteName}`);
    this.logger.debug(`Initializing ExperienceSite with name: ${siteName}`);

    this.org = org;
    this.siteDisplayName = siteName.trim();
    this.siteName = this.siteDisplayName.replace(' ', '_');
    // Replace any special characters in site name with underscore
    this.siteName = this.siteName.replace(/[^a-zA-Z0-9]/g, '_');
    this.logger.debug(`Normalized site name: ${this.siteName}`);

    this.configManager = ExperienceSiteConfigManager.getInstance();
    this.config = this.configManager.getConfig();
    this.logger.debug('Configuration loaded');
  }

  public get apiQueryParams(): string {
    return this.configManager.getApiQueryParams();
  }

  /**
   * Fetches all current experience sites using the Connect API
   *
   * @param org - Salesforce org
   * @returns Array of site names
   */
  public static async getAllExpSites(org: Org): Promise<string[]> {
    const staticLogger = Logger.childFromRoot('ExperienceSite.getAllExpSites');
    staticLogger.debug('Fetching all experience sites');

    try {
      staticLogger.debug('Attempting to fetch sites using Connect API');
      const conn = org.getConnection();
      const apiVersion = conn.version;
      const url = `/services/data/v${apiVersion}/connect/communities`;

      const response = await conn.request<{
        communities: ConnectApiSiteMetadata[];
      }>(url);

      if (!response?.communities) {
        staticLogger.debug('No communities found in Connect API response');
        return [];
      }

      // Filter to only return live sites
      const experienceSites: string[] = response.communities
        .filter((site) => site.status === 'Live')
        .map((site) => site.name);

      staticLogger.debug(`Found ${experienceSites.length} live sites`);
      return experienceSites;
    } catch (error) {
      staticLogger.error('Error fetching sites using Connect API:');
      staticLogger.error(error);

      // Fallback to the original query method
      staticLogger.debug('Falling back to Network query');
      const result = await org.getConnection().query<{
        Id: string;
        Name: string;
        LastModifiedDate: string;
        UrlPathPrefix: string;
        Status: string;
      }>('SELECT Id, Name, LastModifiedDate, UrlPathPrefix, Status FROM Network');

      const experienceSites: string[] = result.records.map((record) => record.Name);
      staticLogger.debug(`Found ${experienceSites.length} sites via Network query`);
      return experienceSites;
    }
  }

  /**
   * Establish a valid token for this local development session
   *
   * @returns sid token for proxied site requests
   */
  public async setupAuth(): Promise<string> {
    this.logger.debug('Setting up authentication token');
    const previewUser = this.config.previewUser.toLocaleLowerCase();
    this.logger.debug(`Preview user: ${previewUser}`);

    // Preview as Guest User (no token)
    if (previewUser === 'guest') {
      this.logger.debug('Guest user selected, returning empty token');
      return '';
    }

    // Preview with supplied user token
    if (this.config.previewToken) {
      this.logger.debug('Using token from configuration');
      // Store the token for future use
      await this.storeAuthToken('Custom', this.config.previewToken);
      return this.config.previewToken;
    }

    // Preview as CLI Admin user (Default)
    if (previewUser === 'admin') {
      this.logger.debug('Attempting to get admin token');
      try {
        // Check if we have a stored token for Admin that's still valid
        const storedToken = await this.getStoredAuthToken('Admin');
        if (storedToken) {
          this.logger.debug('Using stored admin token');
          // TODO: Add token validation logic here
          // For now, just return the stored token if it exists
          return storedToken;
        }

        // If no stored token or it's invalid, get a new one
        this.logger.debug('Getting new admin token');
        const networkId = await this.getNetworkId();
        const sidToken = await this.getNewSidToken(networkId);

        // Store the token for future use
        if (sidToken) {
          this.logger.debug('Storing new admin token');
          await this.storeAuthToken('Admin', sidToken);
        } else {
          this.logger.warn('Failed to obtain admin token');
        }

        return sidToken;
      } catch (e) {
        this.logger.error('Failed to establish authentication for site:');
        this.logger.error(e);
      }
    }

    // Check for a stored token for the requested user
    this.logger.debug(`Checking for stored token for user: ${previewUser}`);
    const storedToken = await this.getStoredAuthToken(previewUser);
    if (storedToken) {
      this.logger.debug('Using stored token for requested user');
      return storedToken;
    }

    // Prompt user for token
    this.logger.debug('Prompting user for authentication token');
    const sidToken = await PromptUtils.promptUserForAuthToken();

    // Store the token for future use
    if (sidToken) {
      this.logger.debug('Storing token provided by user');
      await this.storeAuthToken(previewUser, sidToken);
    } else {
      this.logger.warn('User provided empty or invalid token');
    }

    return sidToken;
  }

  // Is the site extracted locally
  public async isSiteSetup(): Promise<boolean> {
    this.logger.debug('Checking if site is set up');
    const ssrJsPath = path.join(this.getExtractDirectory(), 'ssr.js');

    if (fs.existsSync(ssrJsPath)) {
      this.logger.debug('ssr.js file exists, checking metadata');
      const metadata = await this.getLocalMetadata();
      const isSetup = metadata?.coreVersion === '254';
      this.logger.debug(`Site setup status: ${isSetup}`);
      return isSetup;
    }

    this.logger.debug('ssr.js file does not exist, site is not set up');
    return false;
  }

  // Is the static resource available on the server
  public async isSitePublished(): Promise<boolean> {
    this.logger.debug('Checking if site is published');
    const remoteMetadata = await this.getStaticResourceMetadata();
    const isPublished = !!remoteMetadata;
    this.logger.debug(`Site published status: ${isPublished}`);
    return isPublished;
  }

  // Is there a local gz file of the site
  public async isSiteDownloaded(): Promise<boolean> {
    this.logger.debug('Checking if site is downloaded');
    const metadata = await this.getLocalMetadata();
    if (!metadata) {
      this.logger.debug('No metadata found, site is not downloaded');
      return false;
    }

    const zipPath = this.getSiteZipPath(metadata);
    this.logger.debug(`Checking for zip file at: ${zipPath}`);
    const isDownloaded = fs.existsSync(zipPath);
    this.logger.debug(`Site downloaded status: ${isDownloaded}`);
    return isDownloaded;
  }

  public saveMetadata(metadata: NewSiteMetadata | SiteMetadata): void {
    const siteJsonPath = path.join(this.getSiteDirectory(), 'site.json');
    this.logger.debug(`Saving metadata to: ${siteJsonPath}`);

    // Ensure the directory exists
    fs.mkdirSync(path.dirname(siteJsonPath), { recursive: true });

    // Convert dates to strings for JSON serialization
    const preparedMetadata = JSON.parse(JSON.stringify(metadata)) as SiteMetadata;

    const siteJson = JSON.stringify(preparedMetadata, null, 2);
    fs.writeFileSync(siteJsonPath, siteJson);
    this.logger.debug('Metadata saved successfully');
  }

  public async getLocalMetadata(): Promise<NewSiteMetadata | undefined> {
    this.logger.debug('Getting local metadata');

    if (this.metadataCache.localMetadata) {
      this.logger.debug('Using cached metadata');
      // If we have cached metadata, convert it if it's the old format
      if (!('users' in this.metadataCache.localMetadata)) {
        this.logger.debug('Converting cached metadata from old format to new format');
        this.metadataCache.localMetadata = await migrateToNewMetadataFormat(
          this.metadataCache.localMetadata as unknown as SiteMetadata,
          this.org,
          this.siteDisplayName
        );
        // Save the migrated metadata
        this.saveMetadata(this.metadataCache.localMetadata);
      }
      return this.metadataCache.localMetadata;
    }

    const siteJsonPath = path.join(this.getSiteDirectory(), 'site.json');
    this.logger.debug(`Checking for site metadata at: ${siteJsonPath}`);

    if (fs.existsSync(siteJsonPath)) {
      try {
        this.logger.debug('Reading metadata from file');
        const rawData = JSON.parse(fs.readFileSync(siteJsonPath, 'utf-8')) as SiteMetadata;

        // Check if it's the old format and convert if needed
        if (!('users' in rawData)) {
          this.logger.debug('Converting file metadata from old format to new format');
          const newMetadata = await migrateToNewMetadataFormat(rawData, this.org, this.siteDisplayName);
          this.metadataCache.localMetadata = newMetadata;
          // Save the new format back to disk
          this.saveMetadata(newMetadata);
        } else {
          this.logger.debug('Metadata already in new format');
          this.metadataCache.localMetadata = rawData;
        }

        return this.metadataCache.localMetadata as NewSiteMetadata;
      } catch (error) {
        this.logger.error('Error reading site.json file:');
        this.logger.error(error);
      }
    } else {
      this.logger.debug('No metadata file found');
    }

    return undefined;
  }

  /**
   * Gets metadata from the static resource in the org
   *
   * @returns The static resource metadata if found
   */
  public async getStaticResourceMetadata(): Promise<SiteMetadata | undefined> {
    this.logger.debug('Getting static resource metadata');

    if (this.metadataCache.remoteMetadata) {
      this.logger.debug('Using cached remote metadata');
      return this.metadataCache.remoteMetadata as SiteMetadata;
    }

    this.logger.debug('Querying static resource');
    const result = await this.org
      .getConnection()
      .query<{ Name: string; LastModifiedDate: string }>(
        `SELECT Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT_experience_%_${this.siteName}'`
      );

    if (result.records.length === 0) {
      this.logger.debug('No static resource found');
      return undefined;
    }

    const staticResource = result.records[0];
    this.logger.debug(`Found static resource: ${staticResource.Name}`);

    this.metadataCache.remoteMetadata = {
      bundleName: staticResource.Name,
      bundleLastModified: staticResource.LastModifiedDate,
      coreVersion: '254',
    };

    return this.metadataCache.remoteMetadata;
  }

  /**
   * Fetches metadata for this site from the Connect API
   *
   * @returns The site metadata from Connect API
   */
  public async getSiteMetadataFromConnectApi(): Promise<ConnectApiSiteMetadata | undefined> {
    this.logger.debug('Fetching site metadata from Connect API');

    try {
      const conn = this.org.getConnection();
      const apiVersion = conn.version;
      const url = `/services/data/v${apiVersion}/connect/communities`;
      this.logger.debug(`Connect API URL: ${url}`);

      const response = await conn.request<{
        communities: ConnectApiSiteMetadata[];
      }>(url);

      if (!response?.communities) {
        this.logger.debug('No communities found in Connect API response');
        return undefined;
      }

      this.logger.debug(`Found ${response.communities.length} communities in the org`);

      // Find the site with matching name
      const siteMetadata = response.communities.find((site) => site.name === this.siteDisplayName);

      if (siteMetadata) {
        this.logger.debug(`Found metadata for site: ${this.siteDisplayName}`);
        this.logger.debug(`Site ID: ${siteMetadata.id}`);
        this.logger.debug(`Site status: ${siteMetadata.status}`);
        this.logger.debug(`Template: ${siteMetadata.templateName ?? 'None'}`);
      } else {
        this.logger.debug(`Site ${this.siteDisplayName} not found in Connect API response`);
      }

      return siteMetadata;
    } catch (error) {
      this.logger.error('Error fetching site metadata from Connect API:');
      this.logger.error(error);
      return undefined;
    }
  }

  /**
   * Get the local site directory path
   *
   * @returns the path to the site
   */
  public getSiteDirectory(): string {
    const dirPath = path.join('.localdev', this.siteName);
    this.logger.debug(`Site directory: ${dirPath}`);
    return dirPath;
  }

  public getExtractDirectory(): string {
    const dirPath = path.join('.localdev', this.siteName, 'app');
    this.logger.debug(`Extract directory: ${dirPath}`);
    return dirPath;
  }

  public getSiteZipPath(metadata: NewSiteMetadata | SiteMetadata): string {
    this.logger.debug('Getting site zip path');

    if ('siteZips' in metadata && metadata.siteZips?.length > 0) {
      // New metadata format
      const zipPath = path.join(this.getSiteDirectory(), metadata.siteZips[0].filename);
      this.logger.debug(`Using path from siteZips: ${zipPath}`);
      return zipPath;
    } else {
      // Old metadata format
      const oldMetadata = metadata as SiteMetadata;
      const lastModifiedDate = new Date(oldMetadata.bundleLastModified);
      const timestamp = `${
        lastModifiedDate.getMonth() + 1
      }-${lastModifiedDate.getDate()}_${lastModifiedDate.getHours()}-${lastModifiedDate.getMinutes()}`;
      const fileName = `${oldMetadata.bundleName}_${timestamp}.gz`;
      const zipPath = path.join(this.getSiteDirectory(), fileName);
      this.logger.debug(`Generated zip path: ${zipPath}`);
      return zipPath;
    }
  }

  /**
   * Download and return the site resource bundle
   *
   * @returns path of downloaded site zip
   */
  public async downloadSite(): Promise<string> {
    this.logger.debug('Downloading site');

    let zipPath;
    if (!this.config.apiStaticMode) {
      // Use sites API to download the site bundle on demand
      this.logger.debug('Using sites API to download site');
      zipPath = await this.downloadSiteApi();
    } else {
      // This is for testing purposes only now - not an officially supported external path
      this.logger.debug('Using static resources to download site (testing mode)');
      zipPath = await this.downloadSiteStaticResources();
    }

    this.logger.debug(`Site downloaded to: ${zipPath}`);

    // Get the current orgId
    const orgId = this.org.getOrgId();
    this.logger.debug(`OrgId: ${orgId}`);

    // Get site metadata from Connect API
    this.logger.debug('Fetching site metadata from Connect API');
    const connectApiMetadata = await this.getSiteMetadataFromConnectApi();

    // Extract siteId from builderUrl if available
    let siteId = '';
    if (connectApiMetadata?.builderUrl) {
      try {
        const urlObj = new URL(connectApiMetadata.builderUrl);
        siteId = urlObj.searchParams.get('siteId') ?? '';
        this.logger.debug(`Extracted siteId: ${siteId}`);
      } catch (error) {
        this.logger.error('Error extracting siteId from builderUrl:');
        this.logger.error(error);
      }
    }

    // Get or create metadata
    this.logger.debug('Getting or creating metadata');
    const metadata = (await this.getLocalMetadata()) ?? {
      name: this.siteName,
      orgId,
      siteId,
      siteZips: [],
      lastModified: new Date(),
      coreVersion: '254',
      needsUpdate: false,
      users: {},
      metadata: connectApiMetadata,
    };

    // Update orgId, siteId, and Connect API metadata in case they've changed
    metadata.orgId = orgId;
    if (siteId) {
      metadata.siteId = siteId;
    }
    metadata.metadata = connectApiMetadata ?? metadata.metadata;

    // Get just the filename from the full path
    const filename = path.basename(zipPath);
    this.logger.debug(`Zip filename: ${filename}`);

    // Add this zip to the history
    metadata.siteZips.unshift({
      filename,
      downloadedAt: new Date(),
      bundleLastModified: new Date(metadata.lastModified),
    });
    this.logger.debug('Added zip to history');

    // Limit the history to 5 entries
    if (metadata.siteZips?.length > 5) {
      this.logger.debug(`Zip history has ${metadata.siteZips.length} entries, limiting to 5`);
      const zipsToRemove = metadata.siteZips.slice(5).map((zip) => path.join(this.getSiteDirectory(), zip.filename));

      zipsToRemove.forEach((oldZipPath) => {
        if (fs.existsSync(oldZipPath)) {
          this.logger.debug(`Removing old zip: ${oldZipPath}`);
          fs.unlinkSync(oldZipPath);
        }
      });

      metadata.siteZips = metadata.siteZips.slice(0, 5);
    }

    // Update metadata
    this.logger.debug('Saving updated metadata');
    this.saveMetadata(metadata);

    return zipPath;
  }

  /**
   * Generate a site bundle on demand and download it
   *
   * @returns path of downloaded site zip
   */
  public async downloadSiteApi(): Promise<string> {
    this.logger.debug('Downloading site via API');

    this.logger.debug('Querying site from org');
    const remoteMetadata = await this.org
      .getConnection()
      .query<{ Id: string; Name: string; LastModifiedDate: string; MasterLabel: string }>(
        `Select Id, Name, LastModifiedDate, MasterLabel, UrlPathPrefix, SiteType, Status from Site WHERE Name like '${this.siteName}1'`
      );

    if (!remoteMetadata?.records?.length) {
      const errorMsg = `No published site found for: ${this.siteDisplayName}`;
      this.logger.error(errorMsg);
      throw new SfError(errorMsg);
    }

    const theSite = remoteMetadata.records[0];
    this.logger.debug(`Found site: ${theSite.Name}`);

    // Download the site via API
    const conn = this.org.getConnection();

    // Create temporary metadata for file naming
    const metadata: SiteMetadata = {
      bundleName: theSite.Name,
      bundleLastModified: theSite.LastModifiedDate,
      coreVersion: '254',
    };

    const siteId = theSite.Id;
    const siteIdMinus3 = siteId.substring(0, siteId.length - 3);
    this.logger.debug(`Site ID: ${siteId}, Modified ID: ${siteIdMinus3}`);

    const accessToken = conn.accessToken;
    const instanceUrl = conn.instanceUrl; // Org URL

    if (!accessToken) {
      const errorMsg = `Invalid access token, unable to download site: ${this.siteDisplayName}`;
      this.logger.error(errorMsg);
      throw new SfError(errorMsg);
    }

    const resourcePath = this.getSiteZipPath(metadata);
    this.logger.debug(`Resource will be saved to: ${resourcePath}`);

    try {
      const apiUrl = `${instanceUrl}/services/data/${this.config.apiVersion}/sites/${siteIdMinus3}/preview${this.apiQueryParams}`;
      this.logger.debug(`API URL: ${apiUrl}`);

      this.logger.debug('Sending API request');
      const response = await axios.get(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: 'stream',
      });

      if (response.statusText) {
        this.logger.debug('Creating site directory');
        fs.mkdirSync(this.getSiteDirectory(), { recursive: true });
      }

      this.logger.debug('Streaming response to file');
      const fileStream = fs.createWriteStream(resourcePath);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      response.data.pipe(fileStream);

      await new Promise((resolve, reject) => {
        fileStream.on('finish', () => {
          this.logger.debug('File stream finished successfully');
          resolve(undefined);
        });
        fileStream.on('error', (err) => {
          this.logger.error('File stream error:');
          this.logger.error(err);
          reject(err);
        });
      });

      this.logger.debug('Download complete');
    } catch (error) {
      // Handle axios errors
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with non-200 status
          const errorMsg = `Failed to download site: Server responded with status ${error.response.status} - ${error.response.statusText}`;
          this.logger.error(errorMsg);
          throw new SfError(errorMsg);
        } else if (error.request) {
          // Request was made but no response received
          const errorMsg = 'Failed to download site: No response received from server';
          this.logger.error(errorMsg);
          throw new SfError(errorMsg);
        }
      }
      const errorMsg = `Failed to download site: ${this.siteDisplayName}`;
      this.logger.error(errorMsg);
      this.logger.error(error);
      throw new SfError(errorMsg);
    }

    return resourcePath;
  }

  // Deprecated. Only used internally now for testing. Customer sites will no longer be stored in static resources
  // and are only available via the API.
  public async downloadSiteStaticResources(): Promise<string> {
    this.logger.debug('Downloading site from static resources (deprecated method)');

    const remoteMetadata = await this.getStaticResourceMetadata();
    if (!remoteMetadata) {
      const errorMsg = `No published site found for: ${this.siteDisplayName}`;
      this.logger.error(errorMsg);
      throw new SfError(errorMsg);
    }

    // Download the site from static resources
    const resourcePath = this.getSiteZipPath(remoteMetadata);
    this.logger.debug(`Resource will be saved to: ${resourcePath}`);

    this.logger.debug(`Reading static resource: ${remoteMetadata.bundleName}`);
    const staticresource = await this.org.getConnection().metadata.read('StaticResource', remoteMetadata.bundleName);

    if (staticresource?.content) {
      // Save the static resource
      this.logger.debug('Creating site directory');
      fs.mkdirSync(this.getSiteDirectory(), { recursive: true });

      this.logger.debug('Converting base64 content to buffer');
      const buffer = Buffer.from(staticresource.content, 'base64');

      this.logger.debug('Writing buffer to file');
      fs.writeFileSync(resourcePath, buffer);

      // Save the site's metadata
      this.logger.debug('Saving metadata');
      this.saveMetadata(remoteMetadata);
    } else {
      const errorMsg = `Error occurred downloading your site: ${this.siteDisplayName}`;
      this.logger.error(errorMsg);
      throw new SfError(errorMsg);
    }

    this.logger.debug('Download complete');
    return resourcePath;
  }

  /**
   * Get a stored authentication token for a user
   *
   * @param username The user to get the token for
   * @returns The stored token or undefined
   */
  private async getStoredAuthToken(username: string): Promise<string | undefined> {
    this.logger.debug(`Getting stored auth token for user: ${username}`);

    const metadata = await this.getLocalMetadata();
    if (!metadata?.users?.[username]) {
      this.logger.debug(`No token found for user: ${username}`);
      return undefined;
    }

    const tokenData = metadata.users[username];

    // Check if token is older than 8 hours (token expiry time)
    const tokenAgeMs = Date.now() - new Date(tokenData.issued).getTime();
    const tokenAgeHours = tokenAgeMs / (1000 * 60 * 60);

    if (tokenAgeHours > 8) {
      this.logger.debug(`Token for user ${username} has expired (${tokenAgeHours.toFixed(2)} hours old)`);
      return undefined;
    }

    this.logger.debug(`Found valid token for user: ${username}`);
    return tokenData.token;
  }

  /**
   * Store an authentication token for a user
   *
   * @param username The user to store the token for
   * @param token The token to store
   */
  private async storeAuthToken(username: string, token: string): Promise<void> {
    this.logger.debug(`Storing auth token for user: ${username}`);

    let metadata = await this.getLocalMetadata();

    if (!metadata) {
      this.logger.debug('No existing metadata, creating new metadata');
      const orgId = this.org.getOrgId();
      metadata = {
        name: this.siteName,
        orgId,
        siteId: '',
        siteZips: [],
        lastModified: new Date(),
        coreVersion: '254',
        needsUpdate: false,
        users: {},
      };
    }

    if (!metadata.users) {
      this.logger.debug('No users object in metadata, creating new users object');
      metadata.users = {};
    }

    metadata.users[username] = {
      token,
      issued: new Date(),
    };

    this.logger.debug('Saving updated metadata with token');
    this.saveMetadata(metadata);
  }

  private async getNetworkId(): Promise<string> {
    this.logger.debug('Getting network ID');

    const conn = this.org.getConnection();
    // Query the Network object for the network with the given site name
    const query = `SELECT Id FROM Network WHERE Name = '${this.siteDisplayName}'`;
    this.logger.debug(`Query: ${query}`);

    const result = await conn.query<{ Id: string }>(query);

    const record = result.records?.[0];
    if (record) {
      let networkId = record.Id;
      this.logger.debug(`Found network ID: ${networkId}`);

      // Subtract the last three characters from the Network ID
      networkId = networkId.substring(0, networkId.length - 3);
      this.logger.debug(`Modified network ID: ${networkId}`);

      return networkId;
    } else {
      const errorMsg = `NetworkId for site: '${this.siteDisplayName}' could not be found`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Get a new authentication token for site preview
   *
   * This method can be used for both runtime preview and builder preview contexts.
   * Builder preview requires a special token format that we'll implement in future
   * when API limitations are addressed.
   *
   * @param networkId The network ID for the site
   * @returns The authentication token
   */
  private async getNewSidToken(networkId: string, forBuilder: boolean = false): Promise<string> {
    this.logger.debug(`Getting new SID token for network ID: ${networkId}`);
    if (forBuilder) {
      this.logger.debug('Token is for builder preview');
    }

    // Get the connection and access token from the org
    const conn = this.org.getConnection();
    const orgId = this.org.getOrgId();

    // Not sure if we need to do this
    const orgIdMinus3 = orgId.substring(0, orgId.length - 3);
    const accessToken = conn.accessToken;
    const instanceUrl = conn.instanceUrl; // Org URL
    this.logger.debug(`Instance URL: ${instanceUrl}`);

    // Make the GET request without following redirects
    if (accessToken) {
      // Call out to the switcher servlet to establish a session
      const switchUrl = `${instanceUrl}/servlet/networks/switch?networkId=${networkId}`;
      this.logger.debug(`Switch URL: ${switchUrl}`);

      const cookies = [`sid=${accessToken}`, `oid=${orgIdMinus3}`].join('; ').trim();
      this.logger.debug('Making request to switcher servlet');

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
        this.logger.debug(`Got location header: ${locationHeader}`);
        // Parse the URL to extract the 'sid' parameter
        const urlObj = new URL(locationHeader);
        const sid = urlObj.searchParams.get('sid') ?? '';
        this.logger.debug(`Extracted SID parameter: ${sid}`);

        const cookies2 = ['__Secure-has-sid=1', `sid=${sid}`, `oid=${orgIdMinus3}`].join('; ').trim();

        // Request the location header to establish our session with the servlet
        this.logger.debug(`Making request to location URL: ${urlObj.toString()}`);
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
          this.logger.debug('Found set-cookie header in response');
          // Find the 'sid' cookie in the set-cookie header
          const sidCookie = setCookieHeader.find((cookieStr: string) => cookieStr.startsWith('sid='));
          if (sidCookie) {
            this.logger.debug(`Found SID cookie: ${sidCookie}`);
            // Extract the sid value from the set-cookie string
            const sidMatch = sidCookie.match(/sid=([^;]+)/);
            if (sidMatch?.[1]) {
              const sidToken = sidMatch[1];
              this.logger.debug(`Successfully extracted SID token: ${sidToken.substring(0, 10)}...`);
              return sidToken;
            }
          } else {
            this.logger.debug('No SID cookie found in set-cookie header');
          }
        } else {
          this.logger.debug('No set-cookie header found in response');
        }
      } else {
        this.logger.debug('No location header in response');
      }

      // if we can't establish a valid session this way, lets just warn the user and utilize the guest user context for the site
      this.logger.warn(
        `Warning: could not establish valid auth token for your site '${this.siteDisplayName}'.` +
          'Local Dev proxied requests to your site may fail or return data from the guest user context.'
      );

      return ''; // Site will be guest user access only
    }

    // Not sure what scenarios we don't have an access token at all, but lets output a separate message here so we can distinguish these edge cases
    this.logger.warn(
      'Warning: sf cli org connection missing accessToken. Local Dev proxied requests to your site may fail or return data from the guest user context.'
    );
    return '';
  }
}
