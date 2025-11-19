/*
 * Copyright 2025, Salesforce, Inc.
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
import { Org, SfError } from '@salesforce/core';
import axios from 'axios';

/**
 * Experience Site class for Local Dev preview.
 * https://developer.salesforce.com/docs/platform/lwc/guide/get-started-test-components.html#enable-local-dev
 */
export class ExperienceSite {
  public siteDisplayName: string;
  private org: Org;

  public constructor(org: Org, siteName: string) {
    this.org = org;
    this.siteDisplayName = siteName.trim();
  }

  /**
   * Fetches all current experience sites
   *
   * @param {Org} org - Salesforce org object.
   * @returns {Promise<string[]>} - List of experience site names.
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
   * Get the preview URL for the site
   *
   * @returns {Promise<string>} - The preview URL for the site
   */
  public async getPreviewUrl(): Promise<string> {
    const communityId = await this.getNetworkId();
    const conn = this.org.getConnection();
    const accessToken = conn.accessToken;
    const instanceUrl = conn.instanceUrl;

    if (!accessToken) {
      throw new SfError(`Invalid access token, unable to get preview URL for: ${this.siteDisplayName}`);
    }

    try {
      // Call the communities API to get the preview URL
      const apiUrl = `${instanceUrl}/services/data/v64.0/connect/communities/${communityId}/preview-url/pages/Home`;
      const response = await axios.get<{ previewUrl: string }>(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.data?.previewUrl) {
        return response.data.previewUrl;
      } else {
        throw new SfError(`Invalid response from communities API for site: ${this.siteDisplayName}`);
      }
    } catch (error) {
      // Handle axios errors
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with non-200 status
          throw new SfError(
            `Failed to get preview URL: Server responded with status ${error.response.status} - ${error.response.statusText}`
          );
        } else if (error.request) {
          // Request was made but no response received
          throw new SfError('Failed to get preview URL: No response received from server');
        }
      }
      throw new SfError(`Failed to get preview URL for site: ${this.siteDisplayName}`);
    }
  }

  /**
   * Get the Network ID for the site
   *
   * @returns {Promise<string>} - The Network ID (minus last 3 characters)
   */
  private async getNetworkId(): Promise<string> {
    const conn = this.org.getConnection();
    const result = await conn.query<{ Id: string }>(`SELECT Id FROM Network WHERE Name = '${this.siteDisplayName}'`);

    const record = result.records[0];
    if (record) {
      // Remove the last three characters from the Network ID
      const networkId = record.Id.substring(0, record.Id.length - 3);
      return networkId;
    } else {
      throw new SfError(`NetworkId for site: '${this.siteDisplayName}' could not be found`);
    }
  }
}
