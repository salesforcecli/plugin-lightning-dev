/*
 * Copyright 2026, Salesforce, Inc.
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

import { Connection, Logger } from '@salesforce/core';

type LightningExperienceSettingsMetadata = {
  [key: string]: unknown;
  fullName?: string;
  enableLightningPreviewPref?: string | boolean;
};

type MyDomainSettingsMetadata = {
  [key: string]: unknown;
  fullName?: string;
  isFirstPartyCookieUseRequired?: string | boolean;
};

type MetadataUpdateResult = {
  success: boolean;
  fullName: string;
  errors?: Array<{ message: string }>;
};

/**
 * Utility class for managing Salesforce metadata settings related to Lightning Development.
 */
export class MetaUtils {
  private static logger = Logger.childFromRoot('metaUtils');

  /**
   * Retrieves the Lightning Experience Settings metadata from the org.
   *
   * @param connection the connection to the org
   * @returns LightningExperienceSettingsMetadata object containing the settings
   * @throws Error if unable to retrieve the metadata
   */
  public static async getLightningExperienceSettings(
    connection: Connection
  ): Promise<LightningExperienceSettingsMetadata> {
    this.logger.debug('Retrieving Lightning Experience Settings metadata');

    const metadata = await connection.metadata.read('LightningExperienceSettings', 'enableLightningPreviewPref');

    if (!metadata) {
      throw new Error('Unable to retrieve Lightning Experience Settings metadata.');
    }

    if (Array.isArray(metadata)) {
      if (metadata.length === 0) {
        throw new Error('Lightning Experience Settings metadata response was empty.');
      }
      return metadata[0] as LightningExperienceSettingsMetadata;
    }

    return metadata as LightningExperienceSettingsMetadata;
  }

  /**
   * Checks if Lightning Preview (Local Dev) is enabled for the org.
   *
   * @param connection the connection to the org
   * @returns boolean indicating whether Lightning Preview is enabled
   */
  public static async isLightningPreviewEnabled(connection: Connection): Promise<boolean> {
    try {
      const settings = await this.getLightningExperienceSettings(connection);
      const flagValue = settings.enableLightningPreviewPref ?? 'false';
      const enabled = String(flagValue).toLowerCase().trim() === 'true';
      this.logger.debug(`Lightning Preview enabled: ${enabled}`);
      return enabled;
    } catch (error) {
      this.logger.warn('Error checking Lightning Preview status, assuming disabled:', error);
      return false;
    }
  }

  /**
   * Enables or disables Lightning Preview (Local Dev) for the org by updating the metadata.
   *
   * @param connection the connection to the org
   * @param enable boolean indicating whether to enable (true) or disable (false) Lightning Preview
   * @throws Error if the metadata update fails
   */
  public static async setLightningPreviewEnabled(connection: Connection, enable: boolean): Promise<void> {
    this.logger.debug(`Setting Lightning Preview enabled to: ${enable}`);

    const updateResult = await connection.metadata.update('LightningExperienceSettings', {
      fullName: 'enableLightningPreviewPref',
      enableLightningPreviewPref: enable ? 'true' : 'false',
    });

    const results = Array.isArray(updateResult) ? updateResult : [updateResult];
    const typedResults = results as MetadataUpdateResult[];
    const errors = typedResults.filter((result) => !result.success);

    if (errors.length > 0) {
      const message = errors
        .flatMap((result) => (Array.isArray(result.errors) ? result.errors : result.errors ? [result.errors] : []))
        .filter((error): error is { message: string } => Boolean(error))
        .map((error) => error.message)
        .join(' ');

      throw new Error(message || 'Failed to update Lightning Preview setting.');
    }

    this.logger.debug('Successfully updated Lightning Preview setting');
  }

  /**
   * Retrieves the My Domain Settings metadata from the org.
   *
   * @param connection the connection to the org
   * @returns MyDomainSettingsMetadata object containing the settings
   * @throws Error if unable to retrieve the metadata
   */
  public static async getMyDomainSettings(connection: Connection): Promise<MyDomainSettingsMetadata> {
    this.logger.debug('Retrieving My Domain Settings metadata');

    const metadata = await connection.metadata.read('MyDomainSettings', 'MyDomain');

    if (!metadata) {
      throw new Error('Unable to retrieve My Domain settings metadata.');
    }

    if (Array.isArray(metadata)) {
      if (metadata.length === 0) {
        throw new Error('My Domain settings metadata response was empty.');
      }
      return metadata[0] as MyDomainSettingsMetadata;
    }

    return metadata as MyDomainSettingsMetadata;
  }

  /**
   * Checks if first-party cookies are required for the org.
   *
   * @param connection the connection to the org
   * @returns boolean indicating whether first-party cookies are required
   */
  public static async isFirstPartyCookieRequired(connection: Connection): Promise<boolean> {
    try {
      const settings = await this.getMyDomainSettings(connection);
      const flagValue = settings.isFirstPartyCookieUseRequired ?? 'false';
      const required = String(flagValue).toLowerCase().trim() === 'true';
      this.logger.debug(`First-party cookie required: ${required}`);
      return required;
    } catch (error) {
      this.logger.warn('Error checking first-party cookie requirement, assuming not required:', error);
      return false;
    }
  }

  /**
   * Updates the My Domain setting that controls whether first-party cookies are required.
   *
   * @param connection the connection to the org
   * @param requireFirstPartyCookies boolean indicating whether to require first-party cookies
   * @throws Error if the metadata update fails
   */
  public static async setMyDomainFirstPartyCookieRequirement(
    connection: Connection,
    requireFirstPartyCookies: boolean
  ): Promise<void> {
    this.logger.debug(`Setting first-party cookie requirement to: ${requireFirstPartyCookies}`);

    const updateResult = await connection.metadata.update('MyDomainSettings', {
      fullName: 'MyDomain',
      isFirstPartyCookieUseRequired: requireFirstPartyCookies ? 'true' : 'false',
    });

    const results = Array.isArray(updateResult) ? updateResult : [updateResult];
    const typedResults = results as MetadataUpdateResult[];
    const errors = typedResults.filter((result) => !result.success);

    if (errors.length > 0) {
      const message = errors
        .flatMap((result) => (Array.isArray(result.errors) ? result.errors : result.errors ? [result.errors] : []))
        .filter((error): error is { message: string } => Boolean(error))
        .map((error) => error.message)
        .join(' ');

      throw new Error(message || 'Failed to update My Domain first-party cookie requirement.');
    }

    this.logger.debug('Successfully updated first-party cookie requirement');
  }

  /**
   * Ensures Lightning Preview is enabled for the org. If it's not enabled, this method will enable it.
   *
   * @param connection the connection to the org
   * @returns boolean indicating whether Lightning Preview was already enabled (true) or had to be enabled (false)
   */
  public static async ensureLightningPreviewEnabled(connection: Connection): Promise<boolean> {
    const isEnabled = await this.isLightningPreviewEnabled(connection);

    if (!isEnabled) {
      this.logger.info('Lightning Preview is not enabled. Enabling it now...');
      await this.setLightningPreviewEnabled(connection, true);
      return false;
    }

    this.logger.debug('Lightning Preview is already enabled');
    return true;
  }

  /**
   * Ensures first-party cookies are not required for the org. If they are required, this method will disable the requirement.
   *
   * @param connection the connection to the org
   * @returns boolean indicating whether first-party cookies were already not required (true) or had to be disabled (false)
   */
  public static async ensureFirstPartyCookiesNotRequired(connection: Connection): Promise<boolean> {
    const isRequired = await this.isFirstPartyCookieRequired(connection);

    if (isRequired) {
      this.logger.info('First-party cookies are required. Disabling requirement...');
      await this.setMyDomainFirstPartyCookieRequirement(connection, false);
      return false;
    }

    this.logger.debug('First-party cookies are not required');
    return true;
  }
}
