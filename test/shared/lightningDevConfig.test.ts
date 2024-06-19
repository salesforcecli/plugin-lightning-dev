/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { LightningDevConfig, LIGHTNING_DEV_CONFIG } from '../../src/shared/lightningDevConfig.js';

describe('lightningDevConfig', () => {
  it('getFileName returns LIGHTNING_DEV_CONFIG', async () => {
    const config = LightningDevConfig.getFileName();

    expect(config).to.equal(LIGHTNING_DEV_CONFIG);
  });
});
