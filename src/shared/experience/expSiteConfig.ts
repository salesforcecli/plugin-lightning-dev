/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import 'dotenv/config';

export type ExperienceSiteConfig = {
  previewUser: string;
  previewToken: string;
  apiStaticMode: boolean;
  apiBundlingGroups: boolean;
  apiVersion: string;
  apiSiteVersion: string;
};

export class ExperienceSiteConfigManager {
  private static instance: ExperienceSiteConfigManager;
  private config: ExperienceSiteConfig;

  private constructor() {
    // Backwards Compat
    if (process.env.SITE_GUEST_ACCESS === 'true') {
      process.env.PREVIEW_USER = 'Guest';
    }
    if (process.env.SID_TOKEN && !process.env.PREVIEW_USER) {
      process.env.PREVIEW_USER = 'Custom';
    }

    this.config = {
      previewUser: process.env.PREVIEW_USER ?? 'Admin',
      previewToken: process.env.SID_TOKEN ?? '',
      apiStaticMode: process.env.API_STATIC_MODE === 'true' ? true : false,
      apiBundlingGroups: process.env.API_BUNDLING_GROUPS === 'true' ? true : false,
      apiVersion: process.env.API_VERSION ?? 'v64.0',
      apiSiteVersion: process.env.API_SITE_VERSION ?? 'published',
    };
  }

  public static getInstance(): ExperienceSiteConfigManager {
    if (!ExperienceSiteConfigManager.instance) {
      ExperienceSiteConfigManager.instance = new ExperienceSiteConfigManager();
    }
    return ExperienceSiteConfigManager.instance;
  }

  public getConfig(): ExperienceSiteConfig {
    return { ...this.config };
  }

  public updateConfig(partialConfig: Partial<ExperienceSiteConfig>): void {
    this.config = { ...this.config, ...partialConfig };
  }

  public getApiQueryParams(): string {
    const retVal = [];

    // Preview is default. If we specify another mode, add it as a query parameter
    if (this.config.apiSiteVersion !== 'preview') {
      retVal.push(this.config.apiSiteVersion);
    }

    // Bundling groups are off by default. Only add if enabled
    if (this.config.apiBundlingGroups) {
      retVal.push('bundlingGroups');
    }

    // If we have query parameters, return them
    if (retVal.length) {
      return '?' + retVal.join('&');
    }

    // Otherwise just return an empty string
    return '';
  }
}

// Export a convenience function to get the config
export function getExperienceSiteConfig(): ExperienceSiteConfig {
  return ExperienceSiteConfigManager.getInstance().getConfig();
}
