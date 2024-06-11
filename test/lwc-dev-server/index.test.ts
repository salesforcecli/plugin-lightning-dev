/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';
import { Logger } from '@salesforce/core';
import { LWCServer } from '@lwc/lwc-dev-server';
import esmock from 'esmock';
import * as devServer from '../../src/lwc-dev-server/index.js';
// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = {
  debug: () => {},
  warn: () => {},
  trace: () => {},
  getLevel: () => 10,
} as Logger;

describe('lwc-dev-server', () => {
  const server = {
    stopServer: () => {},
  } as LWCServer;
  let lwcDevServer: typeof devServer;

  before(async () => {
    lwcDevServer = await esmock<typeof devServer>('../../src/lwc-dev-server/index.js', {
      '@lwc/lwc-dev-server': {
        startLwcDevServer: async () => server,
      },
    });
  });

  it('exports a startLWCServer function', () => {
    expect(lwcDevServer.startLWCServer).to.be.a('function');
  });

  it('calling startLWCServer returns an LWCServer', async () => {
    const s = await lwcDevServer.startLWCServer(path.resolve(__dirname, './__mocks__'), logger);
    expect(s).to.equal(server);
  });
});
