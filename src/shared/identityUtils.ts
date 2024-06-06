/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { randomBytes } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { CommonUtils } from '@salesforce/lwc-dev-mobile-core';

class LwrConfigFile {
  public identityToken?: string;
}

export class IdentityUtils {
  public static async createIdentityToken(): Promise<void> {
    const rootDir = path.resolve(process.cwd());
    const lwrConfigFile = path.join(rootDir, 'lwr.config.json');
    if (fs.existsSync(lwrConfigFile)) {
      const config = this.loadConfigFile(lwrConfigFile);
      if (config?.identityToken == null) {
        config.identityToken = randomBytes(256).toString();
        try {
          await CommonUtils.createTextFile(lwrConfigFile, JSON.stringify(config));
        } catch (err) {
          const error = err as Error;
          throw new Error(`Error thrown while trying to write identity token to lwr.config.js: ${error.message}`);
        }
      }
    }
  }

  private static loadConfigFile(file: string): LwrConfigFile {
    const json = CommonUtils.loadJsonFromFile(file);
    const configFile = Object.assign(new LwrConfigFile(), json);
    return configFile;
  }
}
