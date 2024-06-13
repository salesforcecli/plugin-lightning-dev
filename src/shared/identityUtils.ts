/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CryptoUtils } from '@salesforce/lwc-dev-mobile-core';
import { DevServerUtils } from './devServerUtils.js';

class LwrConfigFile {
  public identityToken?: string;
}

export class IdentityUtils {
  public static async updateServerConfigFileWithIdentityToken(): Promise<void> {
    const config = (await DevServerUtils.fetchServerConfigFileContent()) as LwrConfigFile;
    if (config && !config.identityToken) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      config.identityToken = CryptoUtils.generateIdentityToken();
      await DevServerUtils.writeServerConfigFileContent(config);
    }
  }
}
