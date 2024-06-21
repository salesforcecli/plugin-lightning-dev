/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CryptoUtils } from '@salesforce/lwc-dev-mobile-core';
import { Config, ConfigAggregator } from '@salesforce/core';
import configMeta, { ConfigVars } from './../configMeta.js';

export class IdentityUtils {
  public static async getOrCreateIdentityToken(): Promise<string> {
    let token = await this.getIdentityToken();
    if (!token) {
      token = CryptoUtils.generateIdentityToken();
      await this.writeIdentityToken(token);
    }
    return token;
  }

  public static async getIdentityToken(): Promise<string | undefined> {
    const config = await ConfigAggregator.create({ customConfigMeta: configMeta });
    // Need to reload to make sure the values read are decrypted
    await config.reload();
    const identityToken = config.getPropertyValue(ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN);

    return identityToken as string;
  }

  public static async writeIdentityToken(token: string): Promise<void> {
    const config = await Config.create({ isGlobal: false });
    Config.addAllowedProperties(configMeta);
    config.set(ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN, token);
    await config.write();
  }
}
