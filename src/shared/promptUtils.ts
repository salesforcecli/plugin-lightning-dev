/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import select from '@inquirer/select';
import { confirm } from '@inquirer/prompts';
import { Messages } from '@salesforce/core';
import { Platform } from '@salesforce/lwc-dev-mobile-core';

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
}
