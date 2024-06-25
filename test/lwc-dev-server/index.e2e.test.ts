/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';
import sinon from 'sinon';
import { Logger } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { LWCServer, Workspace } from '@lwc/lwc-dev-server';
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

describe('lwc-dev-server e2e', () => {
  const $$ = new TestContext();
  let processExitSpy: sinon.SinonSpy;

  beforeEach(() => {
    processExitSpy = $$.SANDBOX.stub(process, 'exit');
    $$.SANDBOX.stub(ConfigUtils, 'getOrCreateIdentityToken').resolves('testIdentityToken');
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPort').resolves(1234);
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerWorkspace').resolves(Workspace.SfCli);
    $$.SANDBOX.stub(ConfigUtils, 'getSecureConnectionFiles').resolves(undefined);
  });

  afterEach(() => {
    $$.restore();
    $$.SANDBOX.resetHistory();
  });

  it('e2e', async () => {
    const server = await devServer.startLWCServer(path.resolve(__dirname, './__mocks__'), logger);

    expect(server).to.be.an.instanceOf(LWCServer);
    server.stopServer();
    expect(processExitSpy.calledWith(0)).to.be.true;
  });
});
