/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { DevServerUtils } from './devServerUtils.js';

class LwrConfigFile {
  public identityToken?: string;
}

export class IdentityUtils {
  public static async createIdentityToken(): Promise<void> {
    const lwrConfigFile = DevServerUtils.getServerConfigFileLocation();
    if (fs.existsSync(lwrConfigFile)) {
      const config = DevServerUtils.fetchServerConfigFileContent() as LwrConfigFile;
      if (config?.identityToken == null) {
        config.identityToken = randomBytes(256).toString();
        try {
          await DevServerUtils.writeServerConfigFileContent(config);
        } catch (err) {
          const error = err as Error;
          throw new Error(`Error thrown while trying to write identity token to lwr.config.js: ${error.message}`);
        }
      }
    }
  }
}
