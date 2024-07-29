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
import { LWCServer, Workspace } from '@lwc/lwc-dev-server';
import esmock from 'esmock';
import { TestContext } from '@salesforce/core/testSetup';
import * as devServer from '../../src/lwc-dev-server/index.js';
import { ConfigUtils } from '../../src/shared/configUtils.js';

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = {
  debug: () => {},
  warn: () => {},
  trace: () => {},
  getLevel: () => 10,
} as Logger;

describe('lwc-dev-server', () => {
  const $$ = new TestContext();
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

  beforeEach(async () => {
    $$.SANDBOX.stub(ConfigUtils, 'getOrCreateIdentityToken').resolves('testIdentityToken');
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPorts').resolves({ httpPort: 1234, httpsPort: 5678 });
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerWorkspace').resolves(Workspace.SfCli);
    $$.SANDBOX.stub(ConfigUtils, 'getCertData').resolves(undefined);
  });

  afterEach(() => {
    $$.restore();
  });

  it('exports a startLWCServer function', () => {
    expect(lwcDevServer.startLWCServer).to.be.a('function');
  });

  it('calling startLWCServer returns an LWCServer', async () => {
    const fakeIdentityToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';
    const s = await lwcDevServer.startLWCServer(logger, path.resolve(__dirname, './__mocks__'), fakeIdentityToken);
    expect(s).to.equal(server);
  });
});
