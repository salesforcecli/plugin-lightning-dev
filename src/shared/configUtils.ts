/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Workspace } from '@lwc/lwc-dev-server';
import { CryptoUtils } from '@salesforce/lwc-dev-mobile-core';
import { Config, ConfigAggregator } from '@salesforce/core';
import configMeta, { ConfigVars, SecureConnectionFiles } from './../configMeta.js';

export const LOCAL_DEV_SERVER_DEFAULT_PORT = 8081;
export const LOCAL_DEV_SERVER_DEFAULT_WORKSPACE = Workspace.SfCli;

export class ConfigUtils {
  static #config: Config;

  public static async getConfig(): Promise<Config> {
    if (this.#config) {
      return this.#config;
    }
    this.#config = await Config.create({ isGlobal: false });
    Config.addAllowedProperties(configMeta);
    return this.#config;
  }

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
    const config = await this.getConfig();
    config.set(ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN, token);
    await config.write();
  }

  public static async getSecureConnectionFiles(): Promise<SecureConnectionFiles | undefined> {
    const config = await this.getConfig();
    const files = config.get(ConfigVars.LOCAL_WEB_SERVER_HTTPS_CERT_AND_KEY_FILES) as SecureConnectionFiles;
    return files;
  }

  public static async writeSecureConnectionFiles(files: SecureConnectionFiles): Promise<void> {
    const config = await this.getConfig();
    config.set(ConfigVars.LOCAL_WEB_SERVER_HTTPS_CERT_AND_KEY_FILES, files);
    await config.write();
  }

  public static async getLocalDevServerPort(): Promise<number> {
    const config = await this.getConfig();
    const configPort = config.get(ConfigVars.LOCAL_DEV_SERVER_PORT) as number;

    return configPort || LOCAL_DEV_SERVER_DEFAULT_PORT;
  }

  public static async getLocalDevServerWorkspace(): Promise<Workspace> {
    const config = await this.getConfig();
    const configWorkspace = config.get(ConfigVars.LOCAL_DEV_SERVER_WORKSPACE) as Workspace;

    return configWorkspace || LOCAL_DEV_SERVER_DEFAULT_WORKSPACE;
  }
}
