/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigFile } from '@salesforce/core';

export const LIGHTNING_DEV_CONFIG = 'lightningDevConfig.json';

export class LightningDevConfig extends ConfigFile {
  public static getFileName(): string {
    return LIGHTNING_DEV_CONFIG;
  }
}
