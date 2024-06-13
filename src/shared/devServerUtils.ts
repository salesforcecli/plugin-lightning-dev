/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { CommonUtils } from '@salesforce/lwc-dev-mobile-core';

export class DevServerUtils {
  public static getServerConfigFileLocation(): string {
    // TODO: When extensibility of sfdx-project.json becomes clear,
    //       use that as a place for reading and writing this plugin's
    //       related values instead of lwr.config.json.
    return path.join(process.cwd(), 'lwr.config.json');
  }

  public static fetchServerConfigFileContent(): unknown {
    const filePath = DevServerUtils.getServerConfigFileLocation();
    return CommonUtils.loadJsonFromFile(filePath) as unknown;
  }

  public static async writeServerConfigFileContent(config: unknown): Promise<void> {
    const filePath = DevServerUtils.getServerConfigFileLocation();
    // create or overwrite the config file
    return CommonUtils.createTextFile(filePath, JSON.stringify(config, undefined, 2));
  }
}
