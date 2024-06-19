/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { CryptoUtils } from '@salesforce/lwc-dev-mobile-core';
import { LightningDevConfig } from './lightningDevConfig.js';
import { ConfigVars } from './../configMeta.js';

export class IdentityUtils {
  public static async updateConfigWithIdentityToken(): Promise<void> {
    const token = await this.getIdentityToken();
    if (!token) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const generatedIdentityToken = CryptoUtils.generateIdentityToken();
      await this.writeIdentityToken(generatedIdentityToken);
    }
    return Promise.resolve();
  }

  public static async getIdentityToken(): Promise<string | undefined> {
    const config = await LightningDevConfig.create({
      isGlobal: false,
    });
    await config.read();
    const identityToken = config.get(ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN);

    if (identityToken) {
      const identityTokenAsString = identityToken as string;
      return Promise.resolve(identityTokenAsString);
    }

    return Promise.resolve(undefined);
  }

  public static async writeIdentityToken(token: string): Promise<void> {
    const config = await LightningDevConfig.create({
      isGlobal: false,
    });
    await config.read();
    config.set(ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN, token);
    config.writeSync();
    return Promise.resolve();
  }
}
