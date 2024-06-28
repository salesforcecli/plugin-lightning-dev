/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Workspace } from '@lwc/lwc-dev-server';
import { CryptoUtils, SSLCertificateData } from '@salesforce/lwc-dev-mobile-core';
import { Config, ConfigAggregator } from '@salesforce/core';
import configMeta, { ConfigVars, SerializedSSLCertificateData } from './../configMeta.js';

export const LOCAL_DEV_SERVER_DEFAULT_PORT = 8081;
export const LOCAL_DEV_SERVER_DEFAULT_WORKSPACE = Workspace.SfCli;

export class ConfigUtils {
  static #config: Config;
  static #globalConfig: Config;

  public static async getConfig(): Promise<Config> {
    if (this.#config) {
      return this.#config;
    }
    this.#config = await Config.create({ isGlobal: false });
    Config.addAllowedProperties(configMeta);
    return this.#config;
  }

  public static async getGlobalConfig(): Promise<Config> {
    if (this.#globalConfig) {
      return this.#globalConfig;
    }
    this.#globalConfig = await Config.create({ isGlobal: true });
    Config.addAllowedProperties(configMeta);
    return this.#globalConfig;
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

  public static async getCertData(): Promise<SSLCertificateData | undefined> {
    const config = await this.getGlobalConfig();
    const serializedData = config.get(ConfigVars.LOCAL_DEV_SERVER_HTTPS_CERT_DATA) as SerializedSSLCertificateData;
    if (serializedData) {
      const deserializedData: SSLCertificateData = {
        derCertificate: Buffer.from(serializedData.derCertificate, 'base64'),
        pemCertificate: serializedData.pemCertificate,
        pemPrivateKey: serializedData.pemPrivateKey,
        pemPublicKey: serializedData.pemPublicKey,
      };

      return deserializedData;
    }

    return undefined;
  }

  public static async writeCertData(data: SSLCertificateData): Promise<void> {
    const config = await this.getGlobalConfig();
    const serializedData: SerializedSSLCertificateData = {
      derCertificate: data.derCertificate.toString('base64'),
      pemCertificate: data.pemCertificate,
      pemPrivateKey: data.pemPrivateKey,
      pemPublicKey: data.pemPublicKey,
    };
    config.set(ConfigVars.LOCAL_DEV_SERVER_HTTPS_CERT_DATA, serializedData);
    await config.write();
  }

  public static async getLocalDevServerPort(): Promise<number | undefined> {
    const config = await this.getConfig();
    const configPort = config.get(ConfigVars.LOCAL_DEV_SERVER_PORT) as number;

    return configPort;
  }

  public static async getLocalDevServerWorkspace(): Promise<Workspace | undefined> {
    const config = await this.getConfig();
    const configWorkspace = config.get(ConfigVars.LOCAL_DEV_SERVER_WORKSPACE) as Workspace;

    return configWorkspace;
  }
}
