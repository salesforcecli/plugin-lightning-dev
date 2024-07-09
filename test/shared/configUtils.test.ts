/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { expect } from 'chai';
import { Workspace } from '@lwc/lwc-dev-server';
import { Config, ConfigAggregator, Connection } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { CryptoUtils } from '@salesforce/lwc-dev-mobile-core';
import {
  ConfigUtils,
  LOCAL_DEV_SERVER_DEFAULT_PORT,
  LOCAL_DEV_SERVER_DEFAULT_WORKSPACE,
  LocalWebServerIdentityData,
} from '../../src/shared/configUtils.js';
import { ConfigVars } from '../../src/configMeta.js';

describe('configUtils', () => {
  const $$ = new TestContext();
  const fakeIdentityToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';
  const username = 'SalesforceDeveloper';

  afterEach(() => {
    $$.restore();
  });

  it('getOrCreateIdentityToken resolves if identity data is found', async () => {
    const identityData = new LocalWebServerIdentityData(fakeIdentityToken);
    identityData.usernameToServerEntityIdMap[username] = 'entityId';
    const stubConnection = $$.SANDBOX.createStubInstance(Connection);
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(identityData);
    $$.SANDBOX.stub(Connection, 'create').resolves(Connection.prototype);

    const resolved = await ConfigUtils.getOrCreateIdentityToken(username, stubConnection);

    expect(resolved).to.equal(fakeIdentityToken);
  });

  it('getOrCreateIdentityToken resolves and writeIdentityData is called when there is no identity data', async () => {
    const stubConnection = $$.SANDBOX.createStubInstance(Connection);
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(undefined);
    $$.SANDBOX.stub(CryptoUtils, 'generateIdentityToken').resolves(fakeIdentityToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(ConfigUtils as any, 'saveIdentityTokenToServer')
      .withArgs(fakeIdentityToken, stubConnection)
      .resolves('entityId');
    const writeIdentityTokenStub = $$.SANDBOX.stub(ConfigUtils, 'writeIdentityData').resolves();

    const resolved = await ConfigUtils.getOrCreateIdentityToken(username, stubConnection);

    expect(resolved).to.equal(fakeIdentityToken);
    expect(writeIdentityTokenStub.calledOnce).to.be.true;
  });

  it('getIdentityData resolves to undefined if identity data is not found', async () => {
    $$.SANDBOX.stub(ConfigAggregator, 'create').resolves(ConfigAggregator.prototype);
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'reload').resolves();
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(undefined);

    const resolved = await ConfigUtils.getIdentityData();
    expect(resolved).to.equal(undefined);
  });

  it('getIdentityData resolves when identity data is available', async () => {
    $$.SANDBOX.stub(ConfigAggregator, 'create').resolves(ConfigAggregator.prototype);
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'reload').resolves();
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(fakeIdentityToken);

    const resolved = await ConfigUtils.getIdentityData();
    expect(resolved).to.equal(fakeIdentityToken);
  });

  it('writeIdentityData resolves', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'set').withArgs(
      ConfigVars.LOCAL_WEB_SERVER_IDENTITY_DATA,
      $$.SANDBOX.match.string
    );
    $$.SANDBOX.stub(Config.prototype, 'write').resolves();
    const identityData = new LocalWebServerIdentityData(fakeIdentityToken);

    const resolved = await ConfigUtils.writeIdentityData(identityData);
    expect(resolved).to.equal(undefined);
  });

  it('getCertData resolves to undefined when value not found in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_HTTPS_CERT_DATA).returns(undefined);
    const resolved = await ConfigUtils.getCertData();

    expect(resolved).to.equal(undefined);
  });

  it('getCertData resolves to value in config', async () => {
    const certData = {
      derCertificate: Buffer.from(Buffer.from('derCertificate').toString('base64'), 'base64'),
      pemCertificate: 'pemCertificate',
      pemPrivateKey: 'pemPrivateKey',
      pemPublicKey: 'pemPublicKey',
    };

    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_HTTPS_CERT_DATA).returns(certData);
    const resolved = await ConfigUtils.getCertData();

    expect(resolved).to.deep.equal(certData);
  });

  it('writeCertData resolves', async () => {
    const certData = {
      derCertificate: Buffer.from('derCertificate', 'utf-8'),
      pemCertificate: 'pemCertificate',
      pemPrivateKey: 'pemPrivateKey',
      pemPublicKey: 'pemPublicKey',
    };

    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'set').withArgs(ConfigVars.LOCAL_DEV_SERVER_HTTPS_CERT_DATA);
    $$.SANDBOX.stub(Config.prototype, 'write').resolves();

    const resolved = await ConfigUtils.writeCertData(certData);
    expect(resolved).to.equal(undefined);
  });

  it('getLocalDevServerPort returns undefined when value not found in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_PORT).returns(undefined);
    const resolved = await ConfigUtils.getLocalDevServerPort();

    expect(resolved).to.be.undefined;
  });

  it('getLocalDevServerPort resolves to port value in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_PORT).returns(123);
    const resolved = await ConfigUtils.getLocalDevServerPort();

    expect(resolved).to.equal(123);
  });

  it('getLocalDevServerWorkspace returns undefined when value not found in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_WORKSPACE).returns(undefined);
    const resolved = await ConfigUtils.getLocalDevServerWorkspace();

    expect(resolved).to.be.undefined;
  });

  it('getLocalDevServerWorkspace resolves to workspace value in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_WORKSPACE).returns(Workspace.SfCli);
    const resolved = await ConfigUtils.getLocalDevServerWorkspace();

    expect(resolved).to.equal(Workspace.SfCli);
  });
});
