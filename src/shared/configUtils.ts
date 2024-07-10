/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Workspace } from '@lwc/lwc-dev-server';
import { CryptoUtils, SSLCertificateData } from '@salesforce/lwc-dev-mobile-core';
import { Config, ConfigAggregator, Connection } from '@salesforce/core';
import configMeta, { ConfigVars, SerializedSSLCertificateData } from './../configMeta.js';

export const LOCAL_DEV_SERVER_DEFAULT_PORT = 8081;
export const LOCAL_DEV_SERVER_DEFAULT_WORKSPACE = Workspace.SfCli;

export type LocalWebServerIdentityData = {
  identityToken: string;
  usernameToServerEntityIdMap: Record<string, string>;
};

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

  public static async getOrCreateIdentityToken(username: string, connection: Connection): Promise<string> {
    let identityData = await this.getIdentityData();
    if (!identityData) {
      const token = CryptoUtils.generateIdentityToken();
      const entityId = await this.saveIdentityTokenToServer(token, connection);
      identityData = {
        identityToken: token,
        usernameToServerEntityIdMap: {},
      };
      identityData.usernameToServerEntityIdMap[username] = entityId;
      await this.writeIdentityData(identityData);
      return token;
    } else {
      const existingEntityId = identityData.usernameToServerEntityIdMap[username];
      const entityId = await this.saveIdentityTokenToServer(identityData.identityToken, connection, existingEntityId);
      identityData.usernameToServerEntityIdMap[username] = entityId;
      await this.writeIdentityData(identityData);
      return identityData.identityToken;
    }
  }

  public static async writeIdentityData(identityData: LocalWebServerIdentityData): Promise<void> {
    const config = await this.getConfig();
    config.set(ConfigVars.LOCAL_WEB_SERVER_IDENTITY_DATA, identityData);
    await config.write();
  }

  public static async getCertData(): Promise<SSLCertificateData | undefined> {
    const config = await this.getConfig();
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

  public static async getIdentityData(): Promise<LocalWebServerIdentityData | undefined> {
    const config = await ConfigAggregator.create({ customConfigMeta: configMeta });
    // Need to reload to make sure the values read are decrypted
    await config.reload();
    const identityJson = config.getPropertyValue(ConfigVars.LOCAL_WEB_SERVER_IDENTITY_DATA);

    if (identityJson) {
      return identityJson as LocalWebServerIdentityData;
    }
    return undefined;
  }

  private static async saveIdentityTokenToServer(
    token: string,
    connection: Connection,
    entityId: string = ''
  ): Promise<string> {
    const sobject = connection.sobject('UserLocalWebServerIdentity');
    const result = await sobject.upsert({ LocalWebServerIdentityToken: token, Id: `${entityId}` }, 'ID');
    if (result.success) {
      return result.id;
    }
    throw new Error('Could not save the token to the server');
  }
}
