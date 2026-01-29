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
import { LWCServer, Workspace } from '@lwc/lwc-dev-server';
import esmock from 'esmock';
import sinon from 'sinon';
import { TestContext } from '@salesforce/core/testSetup';
import { AuthInfo, Logger, SfProject } from '@salesforce/core';
import * as devServer from '../../src/lwc-dev-server/index.js';
import { ConfigUtils } from '../../src/shared/configUtils.js';

describe('lwc-dev-server', () => {
  const $$ = new TestContext();
  const server = {
    stopServer: () => {},
  } as LWCServer;
  let lwcDevServer: typeof devServer;
  let mockLogger: Logger;
  let mockProject: Partial<SfProject>;
  let getLocalDevServerPortsStub: sinon.SinonStub;
  let getLocalDevServerWorkspaceStub: sinon.SinonStub;

  before(async () => {
    lwcDevServer = await esmock<typeof devServer>('../../src/lwc-dev-server/index.js', {
      '@lwc/lwc-dev-server': {
        startLwcDevServer: async () => server,
      },
    });
  });

  beforeEach(async () => {
    getLocalDevServerPortsStub = $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPorts').resolves({
      httpPort: 1234,
      httpsPort: 5678,
    });
    getLocalDevServerWorkspaceStub = $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerWorkspace').resolves(
      Workspace.SfCli
    );

    mockLogger = await Logger.child('test');
    mockProject = {
      getDefaultPackage: $$.SANDBOX.stub().returns({ fullPath: '/fake/path' }),
      getPackageDirectories: $$.SANDBOX.stub().returns([{ fullPath: '/fake/path' }]),
      resolveProjectConfig: $$.SANDBOX.stub().resolves({ namespace: '' }),
    };

    $$.SANDBOX.stub(SfProject, 'resolve').resolves(mockProject as unknown as SfProject);
  });

  afterEach(() => {
    $$.restore();
  });

  it('exports a startLWCServer function', () => {
    expect(lwcDevServer.startLWCServer).to.be.a('function');
  });

  describe('JWT Authentication Error Handling', () => {
    it('should throw helpful error when no authorization information is found', async () => {
      const authError = new Error('No authorization information found for user test-user@example.com');
      $$.SANDBOX.stub(AuthInfo, 'create').rejects(authError);

      try {
        await lwcDevServer.startLWCServer(mockLogger, '/fake/path', 'fake-token', 'test-user@example.com');
        expect.fail('Expected function to throw an error');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.include('JWT authentication not found for user test-user@example.com');
        expect((error as Error).message).to.include("Please run 'sf org login jwt' or 'sf org login web' first");
      }
    });

    it('should throw helpful error when JWT token is expired', async () => {
      const authError = new Error('JWT token expired for user test-user@example.com');
      $$.SANDBOX.stub(AuthInfo, 'create').rejects(authError);

      try {
        await lwcDevServer.startLWCServer(mockLogger, '/fake/path', 'fake-token', 'test-user@example.com');
        expect.fail('Expected function to throw an error');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.include(
          'JWT authentication expired or invalid for user test-user@example.com'
        );
        expect((error as Error).message).to.include(
          "Please re-authenticate using 'sf org login jwt' or 'sf org login web'"
        );
      }
    });

    it('should throw helpful error when JWT token is invalid', async () => {
      const authError = new Error('Invalid JWT token for user test-user@example.com');
      $$.SANDBOX.stub(AuthInfo, 'create').rejects(authError);

      try {
        await lwcDevServer.startLWCServer(mockLogger, '/fake/path', 'fake-token', 'test-user@example.com');
        expect.fail('Expected function to throw an error');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.include(
          'JWT authentication expired or invalid for user test-user@example.com'
        );
        expect((error as Error).message).to.include(
          "Please re-authenticate using 'sf org login jwt' or 'sf org login web'"
        );
      }
    });

    it('should throw helpful error for generic authentication failures', async () => {
      const authError = new Error('Some other authentication error');
      $$.SANDBOX.stub(AuthInfo, 'create').rejects(authError);

      try {
        await lwcDevServer.startLWCServer(mockLogger, '/fake/path', 'fake-token', 'test-user@example.com');
        expect.fail('Expected function to throw an error');
      } catch (error) {
        expect(error).to.be.an('error');
        expect((error as Error).message).to.include(
          'JWT authentication not found or invalid for user test-user@example.com'
        );
        expect((error as Error).message).to.include('Some other authentication error');
      }
    });
  });

  it('calling startLWCServer returns an LWCServer', async () => {
    const mockAuthInfo = {
      getUsername: () => 'test-user@example.com',
    };
    const authInfoStub = $$.SANDBOX.stub(AuthInfo, 'create').resolves(mockAuthInfo as unknown as AuthInfo);

    const fakeIdentityToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';

    const s = await lwcDevServer.startLWCServer(mockLogger, '/fake/path', fakeIdentityToken, 'test-user@example.com');

    expect(s).to.equal(server);
    expect(getLocalDevServerPortsStub.calledOnce).to.be.true;
    expect(getLocalDevServerWorkspaceStub.calledOnce).to.be.true;

    expect(authInfoStub.calledOnceWith({ username: 'test-user@example.com' })).to.be.true;
  });
});
