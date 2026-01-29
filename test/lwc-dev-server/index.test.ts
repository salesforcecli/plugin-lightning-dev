/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from 'chai';
import type { LWCServer } from '@lwc/sfdx-local-dev-dist';
import { Workspace } from '@lwc/sfdx-local-dev-dist';
import esmock from 'esmock';
import { TestContext } from '@salesforce/core/testSetup';
import * as devServer from '../../src/lwc-dev-server/index.js';
import { ConfigUtils } from '../../src/shared/configUtils.js';

describe('lwc-dev-server', () => {
  const $$ = new TestContext();
  const server = {
    stopServer: () => {},
  } as LWCServer;
  let lwcDevServer: typeof devServer;

  before(async () => {
    lwcDevServer = await esmock<typeof devServer>('../../src/lwc-dev-server/index.js', {
      '@lwc/sfdx-local-dev-dist': {
        startLwcDevServer: async () => server,
      },
    });
  });

  beforeEach(async () => {
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPorts').resolves({ httpPort: 1234, httpsPort: 5678 });
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerWorkspace').resolves(Workspace.SfCli);
  });

  afterEach(() => {
    $$.restore();
  });

  it('exports a startLWCServer function', () => {
    expect(lwcDevServer.startLWCServer).to.be.a('function');
  });

  // it('calling startLWCServer returns an LWCServer', async () => {
  //   const fakeIdentityToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';
  //   const s = await lwcDevServer.startLWCServer(logger, path.resolve(__dirname, './__mocks__'), fakeIdentityToken, '');
  //   expect(s).to.equal(server);
  // });
});
