/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Workspace } from '@lwc/lwc-dev-server';
import { Config, ConfigAggregator } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { ConfigUtils, LocalWebServerIdentityData } from '../../src/shared/configUtils.js';
import { ConfigVars } from '../../src/configMeta.js';

describe('configUtils', () => {
  const $$ = new TestContext();
  const fakeIdentityToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';
  const username = 'SalesforceDeveloper';

  afterEach(() => {
    $$.restore();
  });

  it('getIdentityData resolves to undefined if identity data is not found', async () => {
    $$.SANDBOX.stub(ConfigAggregator, 'create').resolves(ConfigAggregator.prototype);
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'reload').resolves();
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(undefined);

    const resolved = await ConfigUtils.getIdentityData();
    expect(resolved).to.equal(undefined);
  });

  it('getIdentityData resolves when identity data is available', async () => {
    const identityData: LocalWebServerIdentityData = {
      identityToken: fakeIdentityToken,
      usernameToServerEntityIdMap: {},
    };
    const stringifiedData = JSON.stringify(identityData);
    $$.SANDBOX.stub(ConfigAggregator, 'create').resolves(ConfigAggregator.prototype);
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'reload').resolves();
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(stringifiedData);

    const resolved = await ConfigUtils.getIdentityData();
    expect(resolved).to.deep.equal(identityData);
  });

  it('writeIdentityData resolves', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'set').withArgs(
      ConfigVars.LOCAL_WEB_SERVER_IDENTITY_DATA,
      $$.SANDBOX.match.string
    );
    $$.SANDBOX.stub(Config.prototype, 'write').resolves();
    const identityData: LocalWebServerIdentityData = {
      identityToken: fakeIdentityToken,
      usernameToServerEntityIdMap: {},
    };
    identityData.usernameToServerEntityIdMap[username] = 'entityId';

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

  it('getLocalDevServerPorts returns undefined when value not found in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_PORT).returns(undefined);
    const resolved = await ConfigUtils.getLocalDevServerPorts();

    expect(resolved).to.be.undefined;
  });

  it('getLocalDevServerPorts resolves to port values in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get')
      .withArgs(ConfigVars.LOCAL_DEV_SERVER_PORT)
      .returns({ httpPort: 123, httpsPort: 456 });
    const resolved = await ConfigUtils.getLocalDevServerPorts();

    expect(resolved).to.deep.equal({ httpPort: 123, httpsPort: 456 });
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
