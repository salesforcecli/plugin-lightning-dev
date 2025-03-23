/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-console */
// import { Logger } from '@salesforce/core';
import 'dotenv/config';

export type ExperienceSiteConfig = {
  previewUser: string;
  previewToken: string;
  apiStaticMode: boolean;
  apiBundlingGroups: boolean;
  apiSiteVersion: string;
  logLevel: string;
  port: number;
  openBrowser: boolean;
  lwcConfigEnabled: boolean;
  setupOnly: boolean;
};

/**
 * Environment variables that are considered experimental
 */
const EXPERIMENTAL_ENV_VARS = [
  'PREVIEW_USER',
  'SID_TOKEN',
  'API_STATIC_MODE',
  'API_BUNDLING_GROUPS',
  'API_SITE_VERSION',
  'SETUP_ONLY',
  'LWC_CONFIG_ENABLED',
];

/**
 * Experimental configuration options for Experience Sites local development
 *
 */
export class ExperienceSiteConfigManager {
  private static instance: ExperienceSiteConfigManager;
  private config: ExperienceSiteConfig;

  private constructor() {
    // Show a warning
    checkExperimentalConfig();

    // Backwards Compat
    if (process.env.SITE_GUEST_ACCESS === 'true') {
      process.env.PREVIEW_USER = 'Guest';
    }
    if (process.env.SID_TOKEN && !process.env.PREVIEW_USER) {
      process.env.PREVIEW_USER = 'Custom';
    }

    // Experimental configuration values
    this.config = {
      // what user to preview site with
      previewUser: process.env.PREVIEW_USER ?? 'Admin', // Default: Admin
      // Override the authentication token for this user
      previewToken: process.env.SID_TOKEN ?? '', // Default: No Override (empty string)
      // download from static resources instead of the API
      apiStaticMode: process.env.API_STATIC_MODE === 'true' ? true : false, // Default: false
      // use bundling groups or not - testing purposes only
      apiBundlingGroups: process.env.API_BUNDLING_GROUPS === 'true' ? true : false, // Default: false
      // What version of the API to use
      apiSiteVersion: process.env.API_SITE_VERSION ?? 'published', // Default: published
      // Log level supplied to the LWR server
      logLevel: process.env.LOG_LEVEL ?? 'error', // Default: error
      // Port to run the LWR server
      port: parseInt(process.env.PORT ?? '3000', 10), // Default: 3000
      // Should we automatically open the browser?
      openBrowser: process.env.OPEN_BROWSER === 'false' ? false : true, // Default: true
      // Enable lwc module resolution outside the context of SFDX
      lwcConfigEnabled: process.env.LWC_CONFIG_ENABLED === 'true' ? true : false, // Default: false
      // Skip running the server, just setup the site
      setupOnly: process.env.SETUP_ONLY === 'true' ? true : false, // Default: false
      // TODO Add option for running the site in preview only mode (no local changes included)
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

/**
 * Checks if any experimental environment variables are set and logs a warning if so.
 * The warning is only shown once per command execution.
 */
export function checkExperimentalConfig(): void {
  // Check if any experimental env vars are set
  const usedEnvVars = EXPERIMENTAL_ENV_VARS.filter((envVar) => process.env[envVar] !== undefined);

  if (usedEnvVars.length > 0) {
    // Log a warning
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ EXPERIMENTAL CONFIGURATION OPTIONS DETECTED ⚠️');
    console.warn(
      '\x1b[33m%s\x1b[0m',
      'These configuration options are experimental and may change without notice. Please refer to the official documentation for supported options.'
    );
  }
}
