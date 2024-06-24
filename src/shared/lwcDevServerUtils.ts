/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Workspace } from '@lwc/lwc-dev-server';
import { Config } from '@salesforce/core';
import configMeta, { ConfigVars } from '../configMeta.js';

export const LOCAL_DEV_SERVER_DEFAULT_PORT = 8081;
export const LOCAL_DEV_SERVER_DEFAULT_WORKSPACE = Workspace.SfCli;

export class LwcDevServerUtils {
  static #config: Config;

  public static async getConfig(): Promise<Config> {
    if (this.#config) {
      return this.#config;
    }
    this.#config = await Config.create({ isGlobal: false });
    Config.addAllowedProperties(configMeta);
    return this.#config;
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
