/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config } from '@salesforce/core';
import configMeta, { ConfigVars } from '../configMeta.js';

export const LOCAL_DEV_SERVER_DEFAULT_PORT = 8081;

export class LwcDevServerUtils {
  public static async getLocalDevServerPort(): Promise<number> {
    // Should this be global or local?
    const config = await Config.create({ isGlobal: true });
    Config.addAllowedProperties(configMeta);
    const configPort = config.get(ConfigVars.LOCAL_DEV_SERVER_PORT) as number;

    return configPort || LOCAL_DEV_SERVER_DEFAULT_PORT;
  }
}
