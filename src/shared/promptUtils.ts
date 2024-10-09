/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import select from '@inquirer/select';
import { confirm } from '@inquirer/prompts';
import { Connection, Logger, Messages } from '@salesforce/core';
import {
  AndroidDeviceManager,
  AppleDeviceManager,
  BaseDevice,
  Platform,
  Version,
} from '@salesforce/lwc-dev-mobile-core';
import { AppDefinition, OrgUtils } from './orgUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'prompts');

export class PromptUtils {
  public static async promptUserToSelectSite(sites: string[]): Promise<string> {
    const choices = sites.map((site) => ({ value: site }));
    const response = await select({
      message: messages.getMessage('site.select'),
      choices,
    });

    return response;
  }

  public static async promptUserToConfirmUpdate(siteName: string): Promise<boolean> {
    return confirm({
      message: messages.getMessage('site.confirm-update', [siteName]),
      default: true,
    });
  }

  public static async promptUserToSelectPlatform(): Promise<Platform> {
    const choices = [
      { name: messages.getMessage('device-type.choice.desktop'), value: Platform.desktop },
      { name: messages.getMessage('device-type.choice.android'), value: Platform.android },
      { name: messages.getMessage('device-type.choice.ios'), value: Platform.ios },
    ];

    const response = await select({
      message: messages.getMessage('device-type.title'),
      choices,
    });

    return response;
  }

  public static async promptUserToSelectLightningExperienceApp(connection: Connection): Promise<AppDefinition> {
    const apps = await OrgUtils.getLightningExperienceAppList(connection);
    const choices = apps.map((app) => ({ name: app.Label, value: app }));

    const response = await select({
      message: messages.getMessage('lightning-experience-app.title'),
      choices,
    });

    return response;
  }

  public static async promptUserToSelectMobileDevice(
    platform: Platform.ios | Platform.android,
    logger?: Logger
  ): Promise<BaseDevice> {
    const availableDevices =
      platform === Platform.ios
        ? await new AppleDeviceManager(logger).enumerateDevices()
        : await new AndroidDeviceManager(logger).enumerateDevices();

    if (!availableDevices || availableDevices.length === 0) {
      throw new Error(messages.getMessage('error.device.enumeration'));
    }

    const choices = availableDevices.map((device) => ({
      name: `${device.name}, ${device.osType} ${this.getShortVersion(device.osVersion)}`,
      value: device,
    }));

    const response = await select({
      message: messages.getMessage('device-id.title'),
      choices,
    });

    return response;
  }

  // returns the shorthand version of a Version object (eg. 17.0.0 => 17, 17.4.0 => 17.4, 17.4.1 => 17.4.1)
  private static getShortVersion(version: Version | string): string {
    // TODO: consider making this function part of the Version class in @lwc-dev-mobile-core
    if (typeof version === 'string') {
      return version; // codenamed versions will be returned as is
    }

    if (version.patch > 0) {
      return `${version.major}.${version.minor}.${version.patch}`;
    } else if (version.minor > 0) {
      return `${version.major}.${version.minor}`;
    } else {
      return `${version.major}`;
    }
  }
}
