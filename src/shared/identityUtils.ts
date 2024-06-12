/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { randomBytes } from 'node:crypto';
import { DevServerUtils } from './devServerUtils.js';

class LwrConfigFile {
  public identityToken?: string;
}

// **********************************************************************************************
// * TODO: Move the functionality of creating the token as a method in CryptoUtils of           *
// *       lwc-dev-mobile-core instead. Do so when it's finalized where to stash the token:     *
// *       lwr.config.json vs sfdx-project.json                                                 *
// **********************************************************************************************
export class IdentityUtils {
  public static async updateServerConfigFileWithIdentityToken(byteSize = 32): Promise<void> {
    const config = (await DevServerUtils.fetchServerConfigFileContent()) as LwrConfigFile;
    if (config && !config.identityToken) {
      config.identityToken = randomBytes(byteSize).toString('base64');
      await DevServerUtils.writeServerConfigFileContent(config);
    }
  }
}
