/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import select from '@inquirer/select';
import { confirm } from '@inquirer/prompts';

export class PromptUtils {
  public static async promptUserToSelectSite(sites: string[]): Promise<string> {
    const choices = sites.map((site) => ({ value: site }));
    const response = await select({
      message: 'Select a site:',
      choices,
    });

    return response;
  }

  public static async promptUserToConfirmUpdate(siteName: string): Promise<boolean> {
    return confirm({
      message: `An updated site bundle is available for "${siteName}". Would you like to download and apply the update?`,
      default: true,
    });
  }
}
